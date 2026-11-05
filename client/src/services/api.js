import axios from 'axios';
import { sessionVersion, isCurrentSession, sessionSignal } from './session.js';

export const API_BASE_URL = import.meta.env?.VITE_API_URL || '/api';
export const SERVER_URL = import.meta.env?.VITE_SERVER_URL || window.location.origin;
export const fileUrl = url => url.startsWith('/') ? new URL(url, SERVER_URL).href : url;
const api = axios.create({ baseURL: API_BASE_URL, timeout: 15000 });
let refreshing = null;
const stale = () => new axios.CanceledError('Phiên đăng nhập đã thay đổi.');
const currentRequest = config => isCurrentSession(config?.sessionVersion);
api.interceptors.request.use(config => {
  if (config.sessionVersion !== undefined && !currentRequest(config)) throw stale();
  config.sessionVersion ??= sessionVersion();
  config.signal = config.signal ? AbortSignal.any([config.signal, sessionSignal()]) : sessionSignal();
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = 'Bearer ' + token;
  else delete config.headers.Authorization;
  return config;
});
api.interceptors.response.use(response => {
  if (!currentRequest(response.config)) throw stale();
  return response;
}, async error => {
  const request = error.config;
  if (!request || axios.isCancel(error)) throw error;
  if (!currentRequest(request)) throw stale();
  const authEndpoint = /\/auth\/(login|register|refresh-token)$/.test(request.url || '');
  if (error.response?.status !== 401 || request._retry || authEndpoint) throw error;
  request._retry = true;
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    window.dispatchEvent(new Event('auth:unauthorized'));
    throw error;
  }
  const version = request.sessionVersion;
  if (!refreshing || refreshing.version !== version) {
    const job = { version, promise: null };
    job.promise = axios.post(API_BASE_URL + '/auth/refresh-token', { refreshToken }, { timeout: 10000, signal: sessionSignal() }).then(({ data }) => {
      if (!isCurrentSession(version)) throw stale();
      if (!data.success || !data.data?.accessToken || !data.data?.refreshToken) throw new Error('Phản hồi gia hạn phiên không hợp lệ.');
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      window.dispatchEvent(new Event('auth:refreshed'));
      return data.data.accessToken;
    }).catch(reason => {
      if (isCurrentSession(version) && [401, 403].includes(reason.response?.status)) {
        localStorage.removeItem('accessToken'); localStorage.removeItem('refreshToken');
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
      throw reason;
    }).finally(() => { if (refreshing === job) refreshing = null; });
    refreshing = job;
  }
  const token = await refreshing.promise;
  if (!isCurrentSession(version)) throw stale();
  request.headers.Authorization = 'Bearer ' + token;
  return api(request);
});
export default api;
