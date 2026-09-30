/**
 * Somsak House — Google Sheets data API
 *
 * Bound to the "Somsak House Data" spreadsheet. Supabase remains the
 * identity provider; every private API request carries a short-lived Supabase
 * access token that is verified with Supabase Auth before data is returned.
 */

const SPREADSHEET_ID = '1gTlJG7PrRP65so4Ahz8wQoBltOw-_ZgsgtNJiagg9iY';
const SUPABASE_URL = 'https://tziauqvkkxqihrbmladq.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_yFMuAqFksRD4PGEEQSFHNw_Ice6oA09';
const STORES = ['users', 'products', 'stock_moves', 'sales', 'expenses', 'rental_records', 'settings'];
const ALL_SHEETS = ['README'].concat(STORES, ['meta']);

function setup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const first = ss.getSheets()[0];
  if (first.getName() !== 'README') first.setName('README');

  const readme = sheet_('README');
  readme.clear();
  readme.getRange('A1:C1').merge().setValue('Somsak House — Google Sheets Data Store');
  readme.getRange('A3:C8').setValues([
    ['หัวข้อ', 'รายละเอียด', 'หมายเหตุ'],
    ['หน้าที่ไฟล์', 'ฐานข้อมูลหลักของเว็บ Somsak House', 'Supabase ใช้เฉพาะ Authentication'],
    ['รูปแบบแท็บข้อมูล', 'แต่ละแท็บใช้คอลัมน์ id, data, updatedAt', 'data เป็น JSON ที่ Apps Script จัดการ'],
    ['การแก้ข้อมูล', 'แนะนำให้แก้ผ่านเว็บแอป', 'หากแก้ในชีต ต้องรักษา JSON ให้ถูกต้อง'],
    ['ความปลอดภัย', 'Apps Script ตรวจ Supabase access token ก่อนอ่าน/เขียน', 'ไม่บันทึกรหัสผ่านหรือ access token ลงชีต'],
    ['ผู้ใช้เริ่มต้น', 'Chai = tester, test = member', 'รหัสผ่านยังคงอยู่ใน Supabase Auth'],
  ]);
  readme.setHiddenGridlines(true);
  readme.setFrozenRows(3);
  readme.setColumnWidth(1, 190);
  readme.setColumnWidth(2, 480);
  readme.setColumnWidth(3, 360);
  readme.getRange('A1:C1').setBackground('#16324f').setFontColor('#ffffff').setFontWeight('bold').setFontSize(16);
  readme.getRange('A3:C3').setBackground('#2f80ed').setFontColor('#ffffff').setFontWeight('bold');
  readme.getRange('A4:C8').setBackground('#eaf3ff').setWrap(true).setVerticalAlignment('top');

  STORES.concat(['meta']).forEach(function(name) {
    const sh = sheet_(name);
    ensureHeader_(sh);
    sh.setHiddenGridlines(true);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 280);
    sh.setColumnWidth(2, 720);
    sh.setColumnWidth(3, 190);
    sh.getRange('A1:C1').setBackground('#16324f').setFontColor('#ffffff').setFontWeight('bold');
    sh.getRange('B:B').setWrap(true).setVerticalAlignment('top');
  });

  seedUser_({
    id: '6051fc84-ebe4-4ffd-8551-555104b95a94',
    username: 'Chai',
    email: 'srirawat.pan@gmail.com',
    role: 'tester',
    active: true,
    perms: null,
    room: null,
    createdAt: Date.parse('2026-07-31T15:36:41.349Z'),
  });
  seedUser_({
    id: '0a224c00-5697-4777-9aee-0efc9deafcef',
    username: 'test',
    email: 'test@somsak.local',
    role: 'member',
    active: true,
    perms: null,
    room: null,
    createdAt: Date.parse('2026-08-27T02:06:26Z'),
  });
  if (!getRecord_('meta', 'billCounter')) putRecord_('meta', 'billCounter', { value: 0 });

  ss.setActiveSheet(readme);
  return 'Somsak House data store is ready.';
}

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');
    if (action === 'health') return json_({ ok: true, data: { status: 'ready', sheets: ALL_SHEETS } });
    if (action === 'emailForUsername') {
      const username = String((e.parameter && e.parameter.username) || '').trim();
      return json_({ ok: true, data: emailForUsername_(username) });
    }
    throw new Error('Unknown public action.');
  } catch (err) {
    return json_({ ok: false, error: errorMessage_(err) });
  }
}

function doPost(e) {
  try {
    const request = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const authUser = verifySupabaseToken_(request.token);
    const profile = ensureProfile_(authUser);
    if (!profile.active) throw new Error('บัญชีนี้ถูกระงับ');

    let data;
    switch (request.action) {
      case 'profile':
      case 'registerProfile':
        data = profile;
        break;
      case 'dbGet':
        data = dbGet_(profile, request.store, request.key);
        break;
      case 'dbAll':
        data = dbAll_(profile, request.store);
        break;
      case 'dbAllBy':
        data = dbAllBy_(profile, request.store, request.indexName, request.value);
        break;
      case 'dbPut':
        data = dbPut_(profile, request.store, request.value);
        break;
      case 'dbDel':
        data = dbDel_(profile, request.store, request.key);
        break;
      case 'dbClear':
        data = dbClear_(profile, request.store);
        break;
      case 'nextBillNo':
        data = nextBillNo_();
        break;
      default:
        throw new Error('Unknown private action.');
    }
    return json_({ ok: true, data: data === undefined ? null : data });
  } catch (err) {
    return json_({ ok: false, error: errorMessage_(err) });
  }
}

function verifySupabaseToken_(token) {
  if (!token) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  const response = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/user', {
    method: 'get',
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: 'Bearer ' + token,
    },
    muteHttpExceptions: true,
  });
  if (response.getResponseCode() !== 200) throw new Error('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
  return JSON.parse(response.getContentText());
}

function ensureProfile_(authUser) {
  let profile = getRecord_('users', authUser.id);
  if (!profile) {
    const metadata = authUser.user_metadata || {};
    profile = {
      id: authUser.id,
      username: String(metadata.username || String(authUser.email || '').split('@')[0] || 'user'),
      email: authUser.email || '',
      role: 'member',
      active: true,
      perms: null,
      room: null,
      createdAt: Date.now(),
    };
    assertUniqueUsername_(profile.username, profile.id);
    putRecord_('users', profile.id, profile);
  } else if (!profile.email && authUser.email) {
    profile.email = authUser.email;
    putRecord_('users', profile.id, profile);
  }
  return profile;
}

function emailForUsername_(username) {
  if (!username) return null;
  const wanted = username.toLowerCase();
  const profile = allRecords_('users').map(function(r) { return r.data; })
    .find(function(p) { return String(p.username || '').toLowerCase() === wanted; });
  return profile ? (profile.email || null) : null;
}

function dbGet_(profile, store, key) {
  assertStore_(store);
  const value = getRecord_(store, String(key));
  if (!value) return null;
  if (store === 'users' && !isAdmin_(profile) && value.id !== profile.id) return null;
  if (store === 'rental_records' && profile.role === 'member' && value.room !== profile.room) return null;
  return value;
}

function dbAll_(profile, store) {
  assertStore_(store);
  let values = allRecords_(store).map(function(r) { return r.data; });
  if (store === 'users' && !isAdmin_(profile)) values = values.filter(function(v) { return v.id === profile.id; });
  if (store === 'rental_records' && profile.role === 'member') values = values.filter(function(v) { return profile.room && v.room === profile.room; });
  return values;
}

function dbAllBy_(profile, store, indexName, value) {
  return dbAll_(profile, store).filter(function(record) {
    return String(record && record[indexName]) === String(value);
  });
}

function dbPut_(profile, store, value) {
  assertStore_(store);
  if (!value || typeof value !== 'object') throw new Error('ข้อมูลไม่ถูกต้อง');
  const key = String(store === 'settings' ? value.key : value.id);
  if (!key || key === 'undefined') throw new Error('ข้อมูลไม่มีรหัสอ้างอิง');
  const existing = getRecord_(store, key);

  if (store === 'users') {
    assertCanManageUser_(profile, value, existing);
    assertUniqueUsername_(value.username, value.id);
  } else if (!isAdmin_(profile)) {
    if (store === 'products') {
      if (!existing || !onlyStockChanged_(existing, value)) throw new Error('บัญชีนี้แก้ไขได้เฉพาะจำนวนสต๊อกจากหน้า POS');
    } else if (['sales', 'stock_moves', 'expenses'].indexOf(store) >= 0) {
      if (existing) throw new Error('บัญชีนี้ไม่มีสิทธิ์แก้ไขรายการเดิม');
    } else {
      throw new Error('บัญชีนี้ไม่มีสิทธิ์บันทึกข้อมูลส่วนนี้');
    }
  }

  putRecord_(store, key, value);
  return value;
}

function dbDel_(profile, store, key) {
  assertStore_(store);
  if (!isAdmin_(profile)) throw new Error('ไม่มีสิทธิ์ลบข้อมูล');
  if (store === 'users') {
    const target = getRecord_('users', String(key));
    assertCanManageUser_(profile, target, target);
  }
  deleteRecord_(store, String(key));
  return true;
}

function dbClear_(profile, store) {
  assertStore_(store);
  if (store === 'users') return true;
  if (!isAdmin_(profile)) throw new Error('ไม่มีสิทธิ์ล้างข้อมูล');
  const sh = sheet_(store);
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 3).clearContent();
  return true;
}

function nextBillNo_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const current = getRecord_('meta', 'billCounter') || { value: 0 };
    const number = Number(current.value || 0) + 1;
    putRecord_('meta', 'billCounter', { value: number });
    return 'INV-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd') + '-' + String(number).padStart(4, '0');
  } finally {
    lock.releaseLock();
  }
}

function assertCanManageUser_(actor, target, existing) {
  if (!target) throw new Error('ไม่พบผู้ใช้');
  if (actor.role === 'tester') return;
  if (actor.role === 'admin' && target.role === 'member' && (!existing || existing.role === 'member')) return;
  throw new Error('ไม่มีสิทธิ์จัดการผู้ใช้นี้');
}

function onlyStockChanged_(before, after) {
  const a = JSON.parse(JSON.stringify(before));
  const b = JSON.parse(JSON.stringify(after));
  delete a.stock;
  delete b.stock;
  return stableStringify_(a) === stableStringify_(b) && Number.isFinite(Number(after.stock));
}

function stableStringify_(value) {
  if (Array.isArray(value)) return '[' + value.map(stableStringify_).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(function(k) { return JSON.stringify(k) + ':' + stableStringify_(value[k]); }).join(',') + '}';
  }
  return JSON.stringify(value);
}

function isAdmin_(profile) {
  return profile && (profile.role === 'tester' || profile.role === 'admin');
}

function assertUniqueUsername_(username, exceptId) {
  const wanted = String(username || '').trim().toLowerCase();
  if (!wanted) throw new Error('กรุณาระบุชื่อผู้ใช้');
  const duplicate = allRecords_('users').map(function(r) { return r.data; }).find(function(p) {
    return p.id !== exceptId && String(p.username || '').toLowerCase() === wanted;
  });
  if (duplicate) throw new Error('ชื่อผู้ใช้นี้ถูกใช้แล้ว');
}

function seedUser_(profile) {
  if (!getRecord_('users', profile.id)) putRecord_('users', profile.id, profile);
}

function assertStore_(store) {
  if (STORES.indexOf(store) < 0) throw new Error('Unknown data store.');
}

function sheet_(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  return sh;
}

function ensureHeader_(sh) {
  if (sh.getRange('A1').getValue() !== 'id') sh.getRange('A1:C1').setValues([['id', 'data', 'updatedAt']]);
}

function allRecords_(store) {
  const sh = sheet_(store);
  ensureHeader_(sh);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 3).getValues().map(function(row, index) {
    if (!row[0]) return null;
    try {
      return { row: index + 2, id: String(row[0]), data: JSON.parse(String(row[1] || '{}')), updatedAt: row[2] };
    } catch (err) {
      throw new Error('JSON ไม่ถูกต้องในแท็บ ' + store + ' แถว ' + (index + 2));
    }
  }).filter(Boolean);
}

function getRecord_(store, key) {
  const found = allRecords_(store).find(function(r) { return r.id === String(key); });
  return found ? found.data : null;
}

function putRecord_(store, key, value) {
  const sh = sheet_(store);
  ensureHeader_(sh);
  const found = allRecords_(store).find(function(r) { return r.id === String(key); });
  const row = found ? found.row : sh.getLastRow() + 1;
  sh.getRange(row, 1, 1, 3).setValues([[String(key), JSON.stringify(value), new Date()]]);
}

function deleteRecord_(store, key) {
  const found = allRecords_(store).find(function(r) { return r.id === String(key); });
  if (found) sheet_(store).deleteRow(found.row);
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function errorMessage_(err) {
  return err && err.message ? err.message : String(err || 'Unknown error');
}
