# Somsak House — Supabase Auth + Google Sheets

สถาปัตยกรรมเวอร์ชันนี้แบ่งหน้าที่ชัดเจน:

- **Supabase Auth** เก็บบัญชี อีเมล และรหัสผ่านเท่านั้น
- **Google Sheets** เก็บข้อมูลร้าน/ห้องเช่าทั้งหมด
- **Google Apps Script** เป็น API กลาง ตรวจ Supabase access token ก่อนอ่านหรือเขียนข้อมูล
- **GitHub Pages** โฮสต์หน้าเว็บ

รหัสผ่านและ access token จะไม่ถูกบันทึกลง Google Sheets

## 1. Supabase Auth

สร้าง Supabase project หรือใช้โปรเจกต์เดิม แล้วเปิด Email provider ที่ **Authentication → Sign In / Providers**

นำค่าจาก **Settings → API** มาใส่ใน `js/config.js`:

```js
export const SUPABASE_URL = 'https://PROJECT.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_...';
```

ใช้เฉพาะ publishable/anon key ในเว็บ ห้ามนำ `service_role` key มาใส่

## 2. Google Sheet และ Apps Script

1. สร้าง Google Sheet ชื่อ `Somsak House Data`
2. เปิด **ส่วนขยาย → Apps Script**
3. แทนโค้ดใน `Code.gs` ด้วยไฟล์ `apps-script/Code.gs`
4. แก้ `SPREADSHEET_ID` ให้ตรงกับรหัสใน URL ของ Google Sheet
5. เลือกฟังก์ชัน `setup` แล้วกด **Run** หนึ่งครั้ง จากนั้นอนุญาตสิทธิ์ที่จำเป็น
6. กด **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
7. คัดลอก URL ที่ลงท้ายด้วย `/exec` มาใส่ `js/config.js`:

```js
export const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/DEPLOYMENT_ID/exec';
```

แม้ Web App จะรับคำขอจากอินเทอร์เน็ต แต่ข้อมูลส่วนตัวจะถูกส่งกลับเมื่อ Apps Script ตรวจ Supabase access token สำเร็จเท่านั้น การค้นอีเมลจากชื่อผู้ใช้เปิดเฉพาะการจับคู่ชื่อแบบตรงเพื่อให้ล็อกอินด้วยชื่อผู้ใช้ได้

## 3. ผู้ใช้และสิทธิ์

แท็บ `users` เก็บเฉพาะโปรไฟล์ เช่น username, role, active, perms และ room ส่วนรหัสผ่านยังอยู่ใน Supabase Auth

บทบาทหลัก:

- `tester`: จัดการได้ทั้งหมด
- `admin`: จัดการข้อมูลทั่วไปและสมาชิก
- `member`: ใช้เมนูที่ได้รับสิทธิ์ และอ่านข้อมูลห้องของตนเอง

สมาชิกใหม่ที่สมัครผ่านหน้าเว็บจะถูกสร้างเป็น `member` อัตโนมัติเมื่อเข้าสู่ระบบครั้งแรก

## 4. GitHub Pages

อัปโค้ดขึ้น branch ที่ GitHub Pages ใช้ แล้วตรวจว่า URL ของเว็บเปิด `index.html` ในโฟลเดอร์ `somsak-house-cloud` ตามการตั้งค่า repository ปัจจุบัน

หลัง deploy ให้ทดสอบ:

1. ล็อกอินด้วยบัญชี Supabase เดิม
2. เปิดหน้าสินค้า/POS และบันทึกรายการทดลอง
3. ตรวจว่ามีแถวใหม่ในแท็บที่เกี่ยวข้องของ Google Sheet
4. ทดสอบทั้งหน้าจอมือถือและคอมพิวเตอร์

## ปัญหาที่พบบ่อย

| อาการ | วิธีแก้ |
|---|---|
| ขึ้นว่ายังตั้งค่า Cloud ไม่ครบ | ตรวจ `SUPABASE_URL`, `SUPABASE_ANON_KEY` และ `GOOGLE_SCRIPT_URL` |
| ล็อกอินได้แต่โหลดข้อมูลไม่ได้ | ตรวจว่า Apps Script deploy เป็น Web app และ URL ลงท้าย `/exec` |
| ชีตยังไม่มีแท็บข้อมูล | เปิด Apps Script แล้วรันฟังก์ชัน `setup` หนึ่งครั้ง |
| แก้ Apps Script แล้วเว็บยังใช้ของเดิม | Deploy เวอร์ชันใหม่ แล้วใช้ URL deployment เดิมหรืออัปเดต `config.js` |
| แก้เว็บแล้วไม่เปลี่ยน | รอ GitHub Pages deploy เสร็จ แล้วรีเฟรชแบบไม่ใช้ cache |
