import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useNotifications } from './useNotifications'
import toast from 'react-hot-toast'

// Mock react-hot-toast
vi.mock('react-hot-toast', () => {
  const mockToast = vi.fn()
  mockToast.error = vi.fn()
  mockToast.success = vi.fn()
  return { default: mockToast }
})

describe('useNotifications hook', () => {
  let mockNotificationConstructor
  let originalNotification

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()

    // Reset mocks
    vi.clearAllMocks()

    // Setup fake timers
    vi.useFakeTimers()

    // Mock window.Notification
    originalNotification = window.Notification
    mockNotificationConstructor = vi.fn()

    Object.defineProperty(window, 'Notification', {
      writable: true,
      configurable: true,
      value: Object.assign(mockNotificationConstructor, {
        permission: 'default',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      })
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    localStorage.clear()

    // Restore window.Notification
    Object.defineProperty(window, 'Notification', {
      writable: true,
      configurable: true,
      value: originalNotification
    })
  })

  it('handles browser not supporting notifications', async () => {
    // Remove Notification from window
    Object.defineProperty(window, 'Notification', {
      writable: true,
      configurable: true,
      value: undefined
    })

    const { result } = renderHook(() => useNotifications())

    let added
    await act(async () => {
      added = await result.current.addReminder({ api_id: '123', name: 'Test Launch', launch_date: new Date().toISOString() })
    })

    expect(added).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('Browser notifications are not supported')
  })

  it('handles permission denied', async () => {
    window.Notification.requestPermission.mockResolvedValue('denied')

    const { result } = renderHook(() => useNotifications())

    let added
    await act(async () => {
      added = await result.current.addReminder({ api_id: '123', name: 'Test Launch', launch_date: new Date().toISOString() })
    })

    expect(added).toBe(false)
    expect(toast.error).toHaveBeenCalledWith('Notification permission denied')
  })

  it('adds a reminder when permission is granted', async () => {
    const { result } = renderHook(() => useNotifications())

    const launch = {
      api_id: 'launch-1',
      name: 'Falcon 9 Launch',
      launch_date: new Date(Date.now() + 1000000).toISOString()
    }

    let added
    await act(async () => {
      added = await result.current.addReminder(launch)
    })

    expect(added).toBe(true)
    expect(toast.success).toHaveBeenCalledWith('Reminder set! You will be notified 30 min and 5 min before launch.')

    const reminders = JSON.parse(localStorage.getItem('space_tracker_reminders'))
    expect(reminders).toHaveLength(1)
    expect(reminders[0].api_id).toBe('launch-1')

    expect(result.current.hasReminder('launch-1')).toBe(true)
  })

  it('avoids duplicate reminders', async () => {
    const { result } = renderHook(() => useNotifications())

    const launch = {
      api_id: 'launch-2',
      name: 'Starship Launch',
      launch_date: new Date(Date.now() + 1000000).toISOString()
    }

    await act(async () => {
      await result.current.addReminder(launch)
    })

    let secondAdd
    await act(async () => {
      // Trying to add the same launch
      secondAdd = await result.current.addReminder(launch)
    })

    expect(secondAdd).toBe(true)
    // Need to test that it didn't call success toast again, but didn't error out
    expect(toast.success).toHaveBeenCalledTimes(1)
    expect(toast).toHaveBeenCalledWith('Reminder already set for this launch', { icon: '🔔' })

    const reminders = JSON.parse(localStorage.getItem('space_tracker_reminders'))
    expect(reminders).toHaveLength(1)
  })

  it('removes a reminder', async () => {
    const { result } = renderHook(() => useNotifications())

    const launch = {
      api_id: 'launch-3',
      name: 'Atlas V Launch',
      launch_date: new Date(Date.now() + 1000000).toISOString()
    }

    await act(async () => {
      await result.current.addReminder(launch)
    })

    expect(result.current.hasReminder('launch-3')).toBe(true)

    act(() => {
      result.current.removeReminder('launch-3')
    })

    expect(result.current.hasReminder('launch-3')).toBe(false)
    expect(toast.success).toHaveBeenCalledWith('Reminder removed')
  })

  it('triggers notifications at 30 min and 5 min before launch', async () => {
    // Set current time to a specific mock value to make calculations easy
    const now = Date.now()
    vi.setSystemTime(now)

    const { result } = renderHook(() => useNotifications())

    // Launch is 35 minutes from now
    const launchTime = now + (35 * 60000)

    const launch = {
      api_id: 'launch-4',
      name: 'Delta IV Launch',
      launch_date: new Date(launchTime).toISOString()
    }

    await act(async () => {
      await result.current.addReminder(launch)
    })

    // Advance time by 6 minutes (now 29 minutes before launch)
    act(() => {
      vi.advanceTimersByTime(6 * 60000)
    })

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(1)
    expect(mockNotificationConstructor).toHaveBeenCalledWith('Launch in 30 minutes!', expect.objectContaining({
      body: 'Delta IV Launch'
    }))

    // Advance time by another 25 minutes (now 4 minutes before launch)
    act(() => {
      vi.advanceTimersByTime(25 * 60000)
    })

    expect(mockNotificationConstructor).toHaveBeenCalledTimes(2)
    expect(mockNotificationConstructor).toHaveBeenCalledWith('Launch in 5 minutes!', expect.objectContaining({
      body: 'Delta IV Launch'
    }))
  })

  it('cleans up past launches', async () => {
    const now = Date.now()
    vi.setSystemTime(now)

    const { result } = renderHook(() => useNotifications())

    // Launch is 1 minute from now
    const launchTime = now + (1 * 60000)

    const launch = {
      api_id: 'launch-5',
      name: 'Electron Launch',
      launch_date: new Date(launchTime).toISOString()
    }

    await act(async () => {
      await result.current.addReminder(launch)
    })

    expect(result.current.hasReminder('launch-5')).toBe(true)

    // Advance time to 6 minutes after launch (which is 7 minutes from start)
    // Clean up threshold is 5 minutes (300000 ms) after launch
    act(() => {
      vi.advanceTimersByTime(7 * 60000)
    })

    // Wait for the next check interval to happen (runs every 30s)
    act(() => {
      vi.advanceTimersByTime(30000)
    })

    expect(result.current.hasReminder('launch-5')).toBe(false)
  })
})