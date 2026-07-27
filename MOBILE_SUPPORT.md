# Mobile Support Guidelines

## ✅ สถานะปัจจุบัน

### ส่วนที่รองรับ Mobile อย่างสมบูรณ์

1. **Layout & Navigation**
   - ✅ Responsive hamburger menu
   - ✅ Sidebar drawer (mobile)
   - ✅ Navbar responsive
   - ✅ Touch-friendly tap targets

2. **Core Features**
   - ✅ หน้าหลัก (Home)
   - ✅ การเข้าสู่ระบบ (Login)
   - ✅ ค้นหาเอกสาร (Search)
   - ✅ รายการเอกสาร (Documents List)
   - ✅ รายละเอียดเอกสาร (Document Detail)
   - ✅ ค้นหาครุภัณฑ์ (Equipment Search)

### ส่วนที่ต้องใช้ Desktop

3. **Desktop-Only Features** 
   - 💻 **Template Designer** - ต้องใช้หน้าจอใหญ่สำหรับการจัดวาง field อย่างแม่นยำ
   - 💻 **Report Manager** - การจัดการ template ต้องใช้พื้นที่มาก
   - 💻 **Admin Settings** (บางส่วน) - การตั้งค่าระดับสูงควรใช้ desktop

---

## 📱 Responsive Design Principles

### Breakpoints (Tailwind CSS)
```
sm: 640px   // Mobile landscape, small tablets
md: 768px   // Tablets
lg: 1024px  // Desktop, laptops
xl: 1280px  // Large desktop
2xl: 1536px // Extra large screens
```

### Best Practices

#### 1. Layout
```jsx
// ❌ ไม่ดี - Fixed width
<div className="w-1200">

// ✅ ดี - Responsive
<div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
```

#### 2. Grid/Columns
```jsx
// ❌ ไม่ดี - Fixed columns
<div className="grid grid-cols-3">

// ✅ ดี - Responsive columns
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
```

#### 3. Typography
```jsx
// ❌ ไม่ดี - Fixed text size
<h1 className="text-4xl">

// ✅ ดี - Responsive text
<h1 className="text-2xl md:text-3xl lg:text-4xl">
```

#### 4. Spacing
```jsx
// ❌ ไม่ดี - เว้นวรรคเยอะบน mobile
<div className="p-8">

// ✅ ดี - เว้นวรรคพอดี
<div className="p-4 md:p-6 lg:p-8">
```

#### 5. Tables
```jsx
// ❌ ไม่ดี - Table overflow บน mobile
<table className="w-full">

// ✅ ดี - Responsive table หรือ card view
<div className="overflow-x-auto">
  <table className="min-w-full">
  
// หรือ
<div className="hidden md:block">
  <table /> // Desktop table
</div>
<div className="md:hidden">
  <CardView /> // Mobile cards
</div>
```

#### 6. Forms
```jsx
// ❌ ไม่ดี - Horizontal form บน mobile
<div className="flex gap-4">
  <input />
  <input />
</div>

// ✅ ดี - Stack บน mobile
<div className="flex flex-col sm:flex-row gap-4">
  <input />
  <input />
</div>
```

#### 7. Buttons
```jsx
// ❌ ไม่ดี - ปุ่มเล็กเกินไป
<button className="px-2 py-1 text-xs">

// ✅ ดี - Touch-friendly (min 44x44px)
<button className="px-4 py-2 text-sm min-h-[44px]">
```

---

## 🛠️ Components ที่สร้างสำหรับ Mobile

### MobileWarning Component
ใช้แสดงข้อความแจ้งเตือนสำหรับฟีเจอร์ที่ต้องใช้ Desktop

```jsx
import MobileWarning from '../components/MobileWarning';

export default function SomePage() {
  return (
    <>
      <MobileWarning feature="ชื่อฟีเจอร์" />
      <div className="hidden lg:block">
        {/* Desktop UI */}
      </div>
    </>
  );
}
```

---

## 📋 Checklist การทำ Mobile-Friendly

### สำหรับทุกหน้า
- [ ] ทดสอบบนหน้าจอ 375px (iPhone SE)
- [ ] ทดสอบบนหน้าจอ 768px (iPad)
- [ ] ตรวจสอบ overflow (scroll ไม่พอ)
- [ ] ตรวจสอบ tap targets (min 44x44px)
- [ ] ตรวจสอบ font size (อ่านง่าย)
- [ ] ทดสอบ landscape mode
- [ ] ทดสอบ zoom in/out

### สำหรับ Forms
- [ ] Input fields stack แนวตั้งบน mobile
- [ ] Labels อ่านชัดเจน
- [ ] Error messages แสดงชัดเจน
- [ ] Submit button ใหญ่พอกด
- [ ] Keyboard เปิดได้ถูกต้อง (type="tel", "email", etc.)

### สำหรับ Lists/Tables
- [ ] มี card view สำหรับ mobile
- [ ] หรือ horizontal scroll ถ้าเป็น table
- [ ] Infinite scroll หรือ pagination ที่เหมาะสม
- [ ] Loading state ชัดเจน

---

## 🚀 การใช้งาน Tailwind Responsive Utilities

### Hide/Show Elements
```jsx
// แสดงเฉพาะบน mobile
<div className="lg:hidden">Mobile only</div>

// แสดงเฉพาะบน desktop
<div className="hidden lg:block">Desktop only</div>

// แสดงเฉพาะบน tablet ขึ้นไป
<div className="hidden md:block">Tablet & Desktop</div>
```

### Conditional Classes
```jsx
// เปลี่ยน layout ตามขนาดหน้าจอ
<div className="
  flex-col        // Mobile: stack vertically
  md:flex-row     // Tablet+: horizontal
  gap-2           // Mobile: small gap
  md:gap-4        // Tablet+: medium gap
  lg:gap-6        // Desktop: large gap
">
```

---

## 🧪 การทดสอบ

### Chrome DevTools
1. เปิด DevTools (F12)
2. กด Toggle device toolbar (Ctrl+Shift+M)
3. เลือกอุปกรณ์ หรือปรับขนาดเอง
4. ทดสอบ touch events

### ขนาดหน้าจอที่ควรทดสอบ
- **375x667** - iPhone SE, 6, 7, 8
- **390x844** - iPhone 12, 13 Pro
- **768x1024** - iPad
- **360x740** - Samsung Galaxy S8+
- **1024x768** - iPad Landscape

### คำสั่งทดสอบ
```bash
# Run dev server
npm run dev

# Build สำหรับ production
npm run build
npm run preview
```

---

## 📚 เอกสารอ้างอิง

- [Tailwind CSS Responsive Design](https://tailwindcss.com/docs/responsive-design)
- [Web.dev - Responsive Web Design](https://web.dev/responsive-web-design-basics/)
- [MDN - Mobile First](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Responsive/Mobile_first)
- [Google - Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)

---

## 🔧 TODO List

### ปรับปรุงในอนาคต
- [ ] Implement pull-to-refresh
- [ ] เพิ่ม offline support (Service Worker)
- [ ] Optimize images สำหรับ mobile
- [ ] เพิ่ม haptic feedback
- [ ] Support dark mode
- [ ] Improve load time บน 3G/4G
- [ ] Add install prompt (PWA)

---

**อัปเดตล่าสุด:** 2026-07-27
**ผู้ดูแล:** Development Team
