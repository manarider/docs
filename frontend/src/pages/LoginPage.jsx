export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = '/docs/api/auth/login';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-sm text-center">
        <div className="mb-6">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-800">ระบบบริหารจัดการคลังเอกสาร</h1>
          <p className="text-sm text-gray-500 mt-1">เทศบาลนครนครสวรรค์</p>
        </div>

        <button
          onClick={handleLogin}
          className="w-full bg-primary hover:bg-primary/90 text-white font-medium py-3 px-6 rounded-xl transition-colors"
        >
          เข้าสู่ระบบด้วย UMS
        </button>

        <p className="text-xs text-gray-400 mt-4">
          © 2026 งานจัดทำและพัฒนาระบบข้อมูลสารสนเทศ<br />กลุ่มงานสถิติข้อมูลและสารสนเทศ เทศบาลนครนครสวรรค์ by manarider
        </p>
      </div>
    </div>
  );
}
