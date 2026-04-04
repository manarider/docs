import { useEffect } from 'react';

export default function AuthCallbackPage() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (!token) {
      window.location.replace('/docs/?error=missing_token');
      return;
    }

    // ส่ง token ไปให้ backend สร้าง session
    window.location.replace(`/docs/api/auth/callback?token=${encodeURIComponent(token)}`);
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 mt-4 text-sm">กำลังยืนยันตัวตน...</p>
      </div>
    </div>
  );
}
