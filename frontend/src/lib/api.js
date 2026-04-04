import axios from 'axios';

const api = axios.create({
  baseURL: '/docs/api',
  withCredentials: true, // ส่ง session cookie
  headers: { 'Content-Type': 'application/json' },
});

// Auto redirect ไป login เมื่อ 401
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.endsWith('/login')) {
      window.location.replace('/docs/login');
    }
    return Promise.reject(err);
  }
);

export default api;
