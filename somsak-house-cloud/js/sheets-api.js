// sheets-api.js — Google Apps Script data API, authenticated by Supabase JWT
import { GOOGLE_SCRIPT_URL } from './config.js';
import { supabase } from './supabase.js';

export function dataConfigOK() {
  return GOOGLE_SCRIPT_URL &&
    !GOOGLE_SCRIPT_URL.includes('YOUR-') &&
    /^https:\/\/script\.google\.com\/macros\/s\//.test(GOOGLE_SCRIPT_URL);
}

async function parseResponse(response) {
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new Error('Google Apps Script ตอบกลับไม่ถูกต้อง — ตรวจ URL deployment'); }
  if (!payload.ok) throw new Error(payload.error || 'Google Sheets API เกิดข้อผิดพลาด');
  return payload.data;
}

export async function publicSheetsApi(action, params = {}) {
  if (!dataConfigOK()) throw new Error('ยังไม่ได้ตั้งค่า Google Apps Script URL');
  const url = new URL(GOOGLE_SCRIPT_URL);
  url.searchParams.set('action', action);
  url.searchParams.set('_', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value ?? '')));
  try {
    return await parseResponse(await fetch(url, { cache: 'no-store' }));
  } catch (err) {
    if (/Google Apps Script|deployment|Sheets API/.test(err.message)) throw err;
    throw new Error('เชื่อมต่อ Google Sheets ไม่ได้ — ตรวจอินเทอร์เน็ตและ Apps Script deployment');
  }
}

export async function callSheetsApi(action, payload = {}) {
  if (!dataConfigOK()) throw new Error('ยังไม่ได้ตั้งค่า Google Apps Script URL');
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  try {
    const url = new URL(GOOGLE_SCRIPT_URL);
    url.searchParams.set('_', `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: session.access_token, ...payload }),
      cache: 'no-store',
    });
    return await parseResponse(response);
  } catch (err) {
    if (/Google Apps Script|deployment|Sheets API|เซสชัน|สิทธิ์|บัญชี|ข้อมูล|ผู้ใช้|สต๊อก/.test(err.message)) throw err;
    throw new Error('เชื่อมต่อ Google Sheets ไม่ได้ — ตรวจอินเทอร์เน็ตและ Apps Script deployment');
  }
}
