import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import api from './axios';
import axios from 'axios';

// Mock axios globally
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: {
      ...actual.default,
      post: vi.fn(),
    },
  };
});

describe('Axios interceptors', () => {
  let originalLocation;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Mock window.location
    originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };

    // Set a dummy adapter to intercept requests on the api instance
    api.defaults.adapter = vi.fn();

    // Spy on console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    window.location = originalLocation;
    vi.restoreAllMocks();
  });

  it('should have correct base URL and headers', () => {
    expect(api.defaults.baseURL).toBe('/api');
    expect(api.defaults.headers['Content-Type']).toBe('application/json');
  });

  describe('Request Interceptor', () => {
    it('should add Authorization header if access_token exists', async () => {
      localStorage.setItem('access_token', 'test_token');
      api.defaults.adapter.mockResolvedValue({ status: 200, data: 'ok' });

      await api.get('/test');

      const config = api.defaults.adapter.mock.calls[0][0];
      expect(config.headers.Authorization).toBe('Bearer test_token');
    });

    it('should not add Authorization header if access_token does not exist', async () => {
      api.defaults.adapter.mockResolvedValue({ status: 200, data: 'ok' });

      await api.get('/test');

      const config = api.defaults.adapter.mock.calls[0][0];
      expect(config.headers.Authorization).toBeUndefined();
    });
  });

  describe('Response Interceptor', () => {
    it('should return response if successful', async () => {
      const mockResponse = { status: 200, data: 'success' };
      api.defaults.adapter.mockResolvedValue(mockResponse);

      const response = await api.get('/test');
      expect(response.data).toBe('success');
    });

    it('should handle 500+ errors by logging to console', async () => {
      const mockError = {
        response: {
          status: 500,
          data: { detail: 'Server crashed' }
        },
        config: {}
      };
      api.defaults.adapter.mockRejectedValue(mockError);

      await expect(api.get('/test')).rejects.toEqual(mockError);

      expect(console.error).toHaveBeenCalledWith('Server Error (500):', 'Server crashed');
    });

    it('should handle 401 error and refresh token successfully', async () => {
      localStorage.setItem('refresh_token', 'refresh_token_value');

      const mock401Error = {
        response: { status: 401 },
        config: { headers: {} }
      };

      api.defaults.adapter
        .mockRejectedValueOnce(mock401Error)
        .mockResolvedValueOnce({ status: 200, data: 'retried_success' });

      // @ts-ignore
      axios.post.mockResolvedValueOnce({
        data: { access: 'new_access_token' }
      });

      const response = await api.get('/test');

      expect(response.data).toBe('retried_success');
      expect(axios.post).toHaveBeenCalledWith('/api/auth/refresh/', { refresh: 'refresh_token_value' });
      expect(localStorage.getItem('access_token')).toBe('new_access_token');

      const retryConfig = api.defaults.adapter.mock.calls[1][0];
      expect(retryConfig.headers.Authorization).toBe('Bearer new_access_token');
    });

    it('should logout if refresh token fails on 401', async () => {
      localStorage.setItem('access_token', 'old_access');
      localStorage.setItem('refresh_token', 'refresh_token_value');

      const mock401Error = {
        response: { status: 401 },
        config: { headers: {} }
      };

      api.defaults.adapter.mockRejectedValueOnce(mock401Error);

      // @ts-ignore
      axios.post.mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(api.get('/test')).rejects.toEqual(mock401Error);

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('should reject normally if 401 and no refresh token exists', async () => {
      const mock401Error = {
        response: { status: 401 },
        config: { headers: {} }
      };

      api.defaults.adapter.mockRejectedValueOnce(mock401Error);

      await expect(api.get('/test')).rejects.toEqual(mock401Error);

      expect(axios.post).not.toHaveBeenCalled();
    });
  });
});
