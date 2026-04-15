import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import api from '../api/axios'

// Mock the API module
vi.mock('../api/axios', () => {
  return {
    default: {
      get: vi.fn(),
      post: vi.fn(),
    }
  }
})

function TestComponent() {
  const { user, loading, login, register, logout } = useAuth()

  return (
    <div>
      <div data-testid="loading">{loading ? 'true' : 'false'}</div>
      <div data-testid="user">{user ? user.username : 'null'}</div>
      <button onClick={() => login('testuser', 'password')}>Login</button>
      <button onClick={() => register('testuser', 'test@test.com', 'password', 'password')}>Register</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    cleanup()
  })

  it('initially sets loading to false if no token is in localStorage', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    expect(screen.getByTestId('loading')).toHaveTextContent('false')
    expect(screen.getByTestId('user')).toHaveTextContent('null')
    expect(api.get).not.toHaveBeenCalled()
  })

  it('rehydrates user if token exists in localStorage', async () => {
    localStorage.setItem('access_token', 'test-token')
    api.get.mockResolvedValueOnce({ data: { username: 'rehydrated_user' } })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    // Wait for effect to finish
    await act(async () => {
      // Small delay to allow promise resolution
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(api.get).toHaveBeenCalledWith('/auth/me/')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
    expect(screen.getByTestId('user')).toHaveTextContent('rehydrated_user')
  })

  it('clears localStorage and sets loading to false if rehydration fails', async () => {
    localStorage.setItem('access_token', 'test-token')
    localStorage.setItem('refresh_token', 'refresh-token')
    api.get.mockRejectedValueOnce(new Error('Unauthorized'))

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(api.get).toHaveBeenCalledWith('/auth/me/')
    expect(screen.getByTestId('loading')).toHaveTextContent('false')
    expect(screen.getByTestId('user')).toHaveTextContent('null')
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
  })

  it('handles login properly', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    api.post.mockResolvedValueOnce({ data: { access: 'new-access', refresh: 'new-refresh' } })
    api.get.mockResolvedValueOnce({ data: { username: 'testuser' } })

    await act(async () => {
      screen.getByText('Login').click()
    })

    expect(api.post).toHaveBeenCalledWith('/auth/login/', { username: 'testuser', password: 'password' })
    expect(localStorage.getItem('access_token')).toBe('new-access')
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh')
    expect(api.get).toHaveBeenCalledWith('/auth/me/')
    expect(screen.getByTestId('user')).toHaveTextContent('testuser')
  })

  it('handles register properly', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    api.post.mockResolvedValueOnce({ data: {} }) // register response
    api.post.mockResolvedValueOnce({ data: { access: 'reg-access', refresh: 'reg-refresh' } }) // login response
    api.get.mockResolvedValueOnce({ data: { username: 'testuser' } }) // me response

    await act(async () => {
      screen.getByText('Register').click()
    })

    expect(api.post).toHaveBeenCalledWith('/auth/register/', {
      username: 'testuser',
      email: 'test@test.com',
      password: 'password',
      password2: 'password'
    })
    // It should also call login implicitly
    expect(api.post).toHaveBeenCalledWith('/auth/login/', { username: 'testuser', password: 'password' })
    expect(localStorage.getItem('access_token')).toBe('reg-access')
    expect(screen.getByTestId('user')).toHaveTextContent('testuser')
  })

  it('handles logout properly with refresh token', async () => {
    localStorage.setItem('access_token', 'test-access')
    localStorage.setItem('refresh_token', 'test-refresh')
    api.get.mockResolvedValueOnce({ data: { username: 'testuser' } })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    expect(screen.getByTestId('user')).toHaveTextContent('testuser')

    api.post.mockResolvedValueOnce({})

    await act(async () => {
      screen.getByText('Logout').click()
    })

    expect(api.post).toHaveBeenCalledWith('/auth/logout/', { refresh: 'test-refresh' })
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(screen.getByTestId('user')).toHaveTextContent('null')
  })

  it('handles logout gracefully if token is already expired', async () => {
    localStorage.setItem('access_token', 'test-access')
    localStorage.setItem('refresh_token', 'test-refresh')
    api.get.mockResolvedValueOnce({ data: { username: 'testuser' } })

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    api.post.mockRejectedValueOnce(new Error('Invalid token'))

    await act(async () => {
      screen.getByText('Logout').click()
    })

    expect(api.post).toHaveBeenCalledWith('/auth/logout/', { refresh: 'test-refresh' })
    // It should still clear tokens and user
    expect(localStorage.getItem('access_token')).toBeNull()
    expect(localStorage.getItem('refresh_token')).toBeNull()
    expect(screen.getByTestId('user')).toHaveTextContent('null')
  })
})
