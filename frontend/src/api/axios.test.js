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
  let originalCookie;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.location
    originalLocation = window.location;
    delete window.location;
    window.location = { href: '' };

    // Mock document.cookie
    originalCookie = document.cookie;
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });

    // Set a dummy adapter to intercept requests on the api instance
    api.defaults.adapter = vi.fn();

    // Spy on console.error
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    window.location = originalLocation;
    document.cookie = originalCookie;
    vi.restoreAllMocks();
  });

  it('should have correct base URL and headers', () => {
    expect(api.defaults.baseURL).toBe('/api');
    expect(api.defaults.headers['Content-Type']).toBe('application/json');
    expect(api.defaults.withCredentials).toBe(true);
  });

  describe('Request Interceptor', () => {
    it('should add X-CSRFToken header if csrftoken cookie exists', async () => {
      document.cookie = 'csrftoken=test_csrf_token; other=value';
      api.defaults.adapter.mockResolvedValue({ status: 200, data: 'ok' });

      await api.get('/test');

      const config = api.defaults.adapter.mock.calls[0][0];
      expect(config.headers['X-CSRFToken']).toBe('test_csrf_token');
    });

    it('should not add X-CSRFToken header if csrftoken cookie does not exist', async () => {
      document.cookie = 'other=value';
      api.defaults.adapter.mockResolvedValue({ status: 200, data: 'ok' });

      await api.get('/test');

      const config = api.defaults.adapter.mock.calls[0][0];
      expect(config.headers['X-CSRFToken']).toBeUndefined();
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
      const mock401Error = {
        response: { status: 401 },
        config: { headers: {}, url: '/test' }
      };

      api.defaults.adapter
        .mockRejectedValueOnce(mock401Error)
        .mockResolvedValueOnce({ status: 200, data: 'retried_success' });

      // @ts-ignore
      axios.post.mockResolvedValueOnce({ status: 200 });

      const response = await api.get('/test');

      expect(response.data).toBe('retried_success');
      expect(axios.post).toHaveBeenCalledWith('/api/auth/refresh/', {}, { withCredentials: true });
    });

    it('should redirect to login if refresh token fails on 401', async () => {
      const mock401Error = {
        response: { status: 401 },
        config: { headers: {}, url: '/test' }
      };

      api.defaults.adapter.mockRejectedValueOnce(mock401Error);

      // @ts-ignore
      axios.post.mockRejectedValueOnce(new Error('Refresh failed'));

      await expect(api.get('/test')).rejects.toEqual(mock401Error);

      expect(window.location.href).toBe('/login');
    });

    it('should not retry on 401 if original request was for login', async () => {
      const mock401Error = {
        response: { status: 401 },
        config: { headers: {}, url: '/auth/login/' }
      };

      api.defaults.adapter.mockRejectedValueOnce(mock401Error);

      await expect(api.get('/auth/login/')).rejects.toEqual(mock401Error);

      expect(axios.post).not.toHaveBeenCalled();
    });
  });
});
