/**
 * Component แจ้งเตือนสำหรับหน้าที่ต้องใช้ Desktop เท่านั้น
 */
export default function MobileWarning({ feature = 'ฟีเจอร์นี้' }) {
    return (
        <div className="lg:hidden min-h-screen flex items-center justify-center p-4 bg-gray-50">
            <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
                <div className="text-6xl mb-4">💻</div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                    ต้องใช้หน้าจอขนาดใหญ่
                </h2>
                <p className="text-gray-600 mb-4">
                    {feature} ต้องใช้หน้าจอขนาดใหญ่ (Tablet หรือ Desktop)
                    เพื่อการทำงานที่สะดวกและแม่นยำ
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    <p className="font-medium mb-1">💡 แนะนำ:</p>
                    <p>กรุณาเปิดใช้งานบนอุปกรณ์ที่มีหน้าจอขนาดอย่างน้อย 1024px</p>
                </div>
            </div>
        </div>
    );
}
