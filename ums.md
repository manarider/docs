เมื่อมีการ login จากภายนอกมายัง ums ฉันอยากรู้ว่า ums ส่งข้อมูลอะไรกลับไปบ้าง

จากโค้ดที่เราทำกันล่าสุดใน Login.jsx คำตอบคือ:

UMS ส่งกลับไปแค่ "Token" อย่างเดียวครับ

1. สิ่งที่ส่งกลับไปทาง URL
เมื่อ Login สำเร็จ ระบบจะ Redirect กลับไปยังเว็บปลายทางด้วยรูปแบบนี้:

https://web-teesabal.com/auth-callback?token=eyJhbGciOiJIUzI1NiIsInR...

สิ่งที่ส่ง: token (JWT String ยาวๆ)

สิ่งที่ไม่ได้ส่ง: ข้อมูลส่วนตัว, User ID, Permissions, ชื่อ-สกุล (เพื่อความปลอดภัย ไม่ควรส่งข้อมูลพวกนี้ลอยๆ มาใน URL ครับ)

2. แอปภายนอกจะได้ข้อมูล "จริง" ตอนไหน?
แอปภายนอกจะได้ข้อมูลทั้งหมด ก็ต่อเมื่อนำ Token นั้น ยิงกลับมาถาม UMS ผ่าน API /api/auth/me ครับ

ข้อมูลที่จะได้รับกลับมา (JSON response) จะมีหน้าตาประมาณนี้ครับ:
{
  "status": "success",
  "user": {
    "_id": "65a123456789...",
    "username": "admin_somchai",
    "email": "somchai@nsm.go.th",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "phone": "081-234-5678",
    "systemRole": "member",  // Role ในระบบ UMS (เช่น superadmin หรือ member)
    
    // ✅ นี่คือส่วนสำคัญที่คุณเอาไปใช้ต่อ
    "projectPermissions": [
      {
        "project": "project_id_of_booking_system", // ID ของโปรเจกต์จองห้องประชุม
        "role": "admin",      // เป็น Admin ในระบบจอง
        "subDepartment": null
      },
      {
        "project": "project_id_of_saraban", 
        "role": "user",       // เป็น User ธรรมดาในระบบสารบรรณ
        "subDepartment": "สำนักปลัด"
      }
    ]
  }
}

สรุป Flow การทำงาน
UMS: ส่ง กุญแจ (Token) ให้แอปภายนอก

แอปภายนอก: เอากุญแจไปไขตู้เซฟ UMS (API /api/auth/me)

UMS: เปิดตู้เซฟแล้วส่ง ข้อมูลผู้ใช้ทั้งหมด (User Object) ให้แอปภายนอกครับ