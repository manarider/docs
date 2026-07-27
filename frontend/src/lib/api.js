import axios from 'axios';

const api = axios.create({
  baseURL: '/docs/api',
  withCredentials: true, // ส่ง session cookie
  headers: { 'Content-Type': 'application/json' },
});

// Auto redirect ไป login เมื่อ 401 (ยกเว้น public download, auth-callback, project tracker)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const path = window.location.pathname;
    const isPublic = path.includes('/download/');
    const isAuthCallback = path.endsWith('/auth-callback');
    const isProjectPage = path.includes('/projects/') || path.endsWith('/project-access');
    if (err.response?.status === 401 && !path.endsWith('/login') && !isPublic && !isAuthCallback && !isProjectPage) {
      window.location.replace('/docs/login');
    }
    return Promise.reject(err);
  }
);

export default api;
