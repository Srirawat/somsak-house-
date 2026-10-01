// app.js — bootstrap + router + header (เวอร์ชัน Cloud: Supabase)
import { openDB } from './db.js';
import { configOK } from './supabase.js';
import { dataConfigOK } from './sheets-api.js';
import {
  seed, currentUser, login, register, logout, can, MENUS,
  resetPassword, updatePassword, onPasswordRecovery,
} from './auth.js';
import { toast, h, esc, modal } from './ui.js';
import { exportAll, importAll } from './backup.js';

import renderPos from './pages/pos.js';
import renderProducts from './pages/products.js';
import renderStock from './pages/stock.js';
import renderSales from './pages/sales.js';
import renderExpenses from './pages/expenses.js';
import renderCopay from './pages/copay.js';
import renderRentalCalc from './pages/rental-calc.js';
import renderRentalRecords from './pages/rental-records.js';
import renderUsers from './pages/users.js';

const PAGES = {
  'pos': renderPos,
  'products': renderProducts,
  'stock': renderStock,
  'sales': renderSales,
  'expenses': renderExpenses,
  'copay': renderCopay,
  'rental-calc': renderRentalCalc,
  'rental-records': renderRentalRecords,
  'users': renderUsers,
};

const app = document.getElementById('app');
let user = null;
let shellKeyHandler = null;
let routeSeq = 0;

async function main() {
  if (!configOK() || !dataConfigOK()) {
    app.innerHTML = `<div class="boot">⚙️ ยังตั้งค่าระบบ Cloud ไม่ครบ<br><br>
      เปิดไฟล์ <b>js/config.js</b> แล้วตรวจ Supabase และ GOOGLE_SCRIPT_URL<br>
      ดูขั้นตอนทั้งหมดใน <b>SETUP.md</b></div>`;
    return;
  }
  // รองรับลิงก์รีเซ็ตรหัสผ่านจากอีเมล
  onPasswordRecovery(async () => {
    const pw = prompt('ตั้งรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร):');
    if (!pw) return;
    try { await updatePassword(pw); toast('เปลี่ยนรหัสผ่านแล้ว เข้าสู่ระบบได้เลย'); }
    catch (err) { toast(err.message, 'err'); }
  });
  await openDB();
  await seed();
  user = await currentUser();
  if (!user) renderLogin();
  else { renderShell(); route(); }
}

window.addEventListener('hashchange', () => { if (user) route(); });

function firstAllowed() {
  return MENUS.find(m => can(user, m.id))?.id || 'copay';
}

async function route() {
  const seq = ++routeSeq;
  let id = location.hash.replace(/^#\/?/, '');
  if (!PAGES[id]) id = firstAllowed();
  if (!can(user, id)) {
    toast('คุณไม่มีสิทธิ์เข้าถึงเมนูนี้', 'err');
    id = firstAllowed();
  }
  const want = '#/' + id;
  if (location.hash !== want) { location.hash = want; return; }
  document.querySelectorAll('.nav a').forEach(a => a.classList.toggle('active', a.dataset.id === id));
  const main = document.getElementById('main');
  main.innerHTML = '<div class="muted">กำลังโหลด...</div>';
  const view = document.createElement('div');
  try {
    await PAGES[id](view, { user });
    if (seq !== routeSeq) return;
    view.querySelectorAll('table').forEach(makeTableScrollable);
    main.replaceChildren(...view.childNodes);
  } catch (err) {
    if (seq !== routeSeq) return;
    console.error(err);
    main.innerHTML = `<div class="card">เกิดข้อผิดพลาด: ${esc(err.message)}</div>`;
  }
}

function renderLogin() {
  app.innerHTML = `
  <div class="login-wrap"><div class="login-card">
    <h1>🏠 Somsak House</h1>
    <p>ระบบจัดการร้าน/ที่พัก (Supabase Auth + Google Sheets)</p>
    <form id="loginForm">
      <div><label>ชื่อผู้ใช้</label><input id="lu" required autocomplete="username" autocapitalize="none" spellcheck="false"></div>
      <div><label>รหัสผ่าน</label><input id="lp" type="password" required autocomplete="current-password"></div>
      <button class="primary" type="submit">เข้าสู่ระบบ</button>
      <button type="button" id="btnReg">สมัครสมาชิก</button>
      <button type="button" class="ghost" id="btnForgot" style="font-size:13px">ลืมรหัสผ่าน?</button>
    </form>
  </div></div>`;

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    try {
      user = await login(document.getElementById('lu').value, document.getElementById('lp').value);
      renderShell(); route();
      toast(`ยินดีต้อนรับ ${user.username}`);
    } catch (err) { toast(err.message, 'err'); }
  });

  document.getElementById('btnForgot').addEventListener('click', async () => {
    const email = prompt('กรอกอีเมลที่ผูกไว้กับบัญชี ระบบจะส่งลิงก์รีเซ็ตรหัสผ่านให้\n(ถ้าสมัครโดยไม่ได้ใส่อีเมล ให้แจ้งผู้ดูแลระบบแทน):', '');
    if (!email) return;
    try { await resetPassword(email); toast('ส่งลิงก์รีเซ็ตรหัสผ่านไปที่อีเมลแล้ว'); }
    catch (err) { toast(err.message, 'err'); }
  });

  document.getElementById('btnReg').addEventListener('click', () => {
    const m = modal(`
      <h3>สมัครสมาชิก (บทบาท member)</h3>
      <form id="regForm">
        <div><label>ชื่อผู้ใช้ (ใช้ล็อกอิน — ภาษาอังกฤษ/ตัวเลข ไม่มีช่องว่าง)</label>
          <input id="ru" required minlength="3" autocapitalize="none" spellcheck="false"></div>
        <div><label>รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)</label><input id="rp" type="password" required minlength="6"></div>
        <div><label>ยืนยันรหัสผ่าน</label><input id="rp2" type="password" required></div>
        <div><label>อีเมล (ไม่บังคับ — ใส่ไว้เผื่อลืมรหัสผ่าน)</label><input id="re" type="email"></div>
        <div class="actions"><button type="button" id="regCancel">ยกเลิก</button>
        <button class="primary" type="submit">สมัคร</button></div>
      </form>`);
    m.el.querySelector('#regCancel').onclick = m.close;
    m.el.querySelector('#regForm').addEventListener('submit', async e => {
      e.preventDefault();
      const p1 = m.el.querySelector('#rp').value, p2 = m.el.querySelector('#rp2').value;
      if (p1 !== p2) return toast('รหัสผ่านไม่ตรงกัน', 'err');
      try {
        await register(m.el.querySelector('#ru').value, p1, m.el.querySelector('#re').value);
        m.close();
        toast('สมัครสำเร็จ — เข้าสู่ระบบด้วยชื่อผู้ใช้และรหัสผ่านได้เลย');
      } catch (err) { toast(err.message, 'err'); }
    });
  });
}

function renderShell() {
  const menus = MENUS.filter(m => can(user, m.id));
  app.innerHTML = `
  <header class="topbar">
    <button class="nav-toggle" id="navToggle" type="button" aria-controls="appNav"
      aria-expanded="false" aria-label="เปิดเมนูหลัก">☰</button>
    <div class="brand">🏠 <span>Somsak House</span> <small>CLOUD</small></div>
    <div class="usermenu">
      <button id="userBtn" aria-expanded="false">👤 <span class="user-name">${esc(user.username)}</span>
        <span class="user-role">(${esc(user.role)})</span> ▾</button>
      <div class="dropdown" id="userDrop" hidden>
        <button id="btnExport">⬇️ สำรองข้อมูล (Export)</button>
        <button id="btnImport">⬆️ นำเข้าข้อมูล (Import)</button>
        <button id="btnPw">🔑 เปลี่ยนรหัสผ่าน</button>
        <button id="btnLogout">🚪 ออกจากระบบ</button>
      </div>
    </div>
  </header>
  <div class="layout">
    <nav class="nav" id="appNav" aria-label="เมนูหลัก">${menus.map(m => `<a href="#/${m.id}" data-id="${m.id}">${m.label}</a>`).join('')}</nav>
    <button class="nav-backdrop" id="navBackdrop" type="button" aria-label="ปิดเมนู" tabindex="-1"></button>
    <main id="main"></main>
  </div>
  <input type="file" id="importFile" accept="application/json" hidden>`;

  const drop = document.getElementById('userDrop');
  const userBtn = document.getElementById('userBtn');
  userBtn.onclick = () => {
    drop.hidden = !drop.hidden;
    userBtn.setAttribute('aria-expanded', String(!drop.hidden));
  };
  document.addEventListener('click', e => {
    if (!e.target.closest('.usermenu')) {
      drop.hidden = true;
      userBtn.setAttribute('aria-expanded', 'false');
    }
  });

  const navToggle = document.getElementById('navToggle');
  const closeNav = () => {
    document.body.classList.remove('nav-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'เปิดเมนูหลัก');
  };
  const toggleNav = () => {
    const open = document.body.classList.toggle('nav-open');
    navToggle.setAttribute('aria-expanded', String(open));
    navToggle.setAttribute('aria-label', open ? 'ปิดเมนูหลัก' : 'เปิดเมนูหลัก');
  };
  navToggle.onclick = toggleNav;
  document.getElementById('navBackdrop').onclick = closeNav;
  document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', closeNav));
  if (shellKeyHandler) document.removeEventListener('keydown', shellKeyHandler);
  shellKeyHandler = e => { if (e.key === 'Escape') closeNav(); };
  document.addEventListener('keydown', shellKeyHandler);

  document.getElementById('btnExport').onclick = async () => {
    drop.hidden = true;
    try { await exportAll(); toast('สำรองข้อมูลเรียบร้อย (ดาวน์โหลดไฟล์ JSON)'); }
    catch (err) { toast(err.message, 'err'); }
  };

  const fileInput = document.getElementById('importFile');
  document.getElementById('btnImport').onclick = () => { drop.hidden = true; fileInput.click(); };
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0];
    if (!f) return;
    if (!confirm('นำเข้าข้อมูลจะเขียนทับข้อมูลปัจจุบันทั้งหมด (ยกเว้นบัญชีผู้ใช้) ยืนยันหรือไม่?')) { fileInput.value = ''; return; }
    try {
      await importAll(f);
      toast('นำเข้าข้อมูลสำเร็จ — กำลังรีโหลด');
      setTimeout(() => location.reload(), 900);
    } catch (err) { toast(err.message, 'err'); }
    fileInput.value = '';
  });

  document.getElementById('btnPw').onclick = async () => {
    drop.hidden = true;
    const pw = prompt('ตั้งรหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร):');
    if (!pw) return;
    try { await updatePassword(pw); toast('เปลี่ยนรหัสผ่านแล้ว'); }
    catch (err) { toast(err.message, 'err'); }
  };

  document.getElementById('btnLogout').onclick = async () => {
    closeNav();
    await logout(); user = null; location.hash = ''; renderLogin();
  };
}

function makeTableScrollable(table) {
  if (table.parentElement?.classList.contains('table-scroll')) return;
  const wrap = document.createElement('div');
  wrap.className = 'table-scroll';
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', 'ตารางข้อมูล เลื่อนซ้ายขวาได้');
  table.before(wrap);
  wrap.appendChild(table);
}

main().catch(err => {
  console.error(err);
  app.innerHTML = `<div class="boot">เชื่อมต่อระบบไม่สำเร็จ: ${esc(err.message)}<br>
  ตรวจค่าใน js/config.js, Supabase Auth และ Google Apps Script ตาม SETUP.md</div>`;
});
