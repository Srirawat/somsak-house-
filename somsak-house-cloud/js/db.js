// db.js — Google Sheets adapter ผ่าน Google Apps Script
// คง API เดิมไว้เพื่อให้ทุกหน้าของเว็บทำงานต่อได้โดยไม่ต้องเปลี่ยนโค้ดหน้า UI
import { callSheetsApi } from './sheets-api.js';

export const STORES = ['users', 'products', 'stock_moves', 'sales', 'expenses', 'rental_records', 'settings'];

export function uuid() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export async function openDB() { return true; }

export async function dbPut(store, value) {
  await callSheetsApi('dbPut', { store, value });
}

export async function dbGet(store, key) {
  const value = await callSheetsApi('dbGet', { store, key: String(key) });
  if (value !== null && (typeof value !== 'object' || Array.isArray(value))) {
    throw new Error(`Google Sheets ส่งข้อมูล ${store} ไม่ถูกต้อง`);
  }
  return value ?? undefined;
}

export async function dbAll(store) {
  const rows = await callSheetsApi('dbAll', { store });
  if (!Array.isArray(rows)) throw new Error(`Google Sheets ส่งรายการ ${store} ไม่ถูกต้อง`);
  return rows;
}

export async function dbAllBy(store, indexName, val) {
  const rows = await callSheetsApi('dbAllBy', { store, indexName, value: val });
  if (!Array.isArray(rows)) throw new Error(`Google Sheets ส่งรายการ ${store} ไม่ถูกต้อง`);
  return rows;
}

export async function dbDel(store, key) {
  await callSheetsApi('dbDel', { store, key: String(key) });
}

export async function dbClear(store) {
  if (store === 'users') return;
  await callSheetsApi('dbClear', { store });
}
