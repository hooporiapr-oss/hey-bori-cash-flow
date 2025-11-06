// ledger.js — tiny JSON “database” stored on a mounted disk
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'ledger.json');

function ensureStorage(){
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ rows: [] }, null, 2));
}

function load(){
ensureStorage();
const raw = fs.readFileSync(FILE, 'utf8');
try { return JSON.parse(raw); } catch { return { rows: [] }; }
}

function save(db){ fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); }

function add({ type, amount, category, note, date }){
const db = load();
const entry = {
id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
type: (type === 'expense' ? 'expense' : 'income'),
amount: Number(amount || 0),
category: (category || '').trim(),
note: (note || '').trim(),
date: date ? new Date(date).toISOString() : new Date().toISOString()
};
db.rows.push(entry);
save(db);
return entry;
}

function list(){ return load().rows || []; }

function summary(days = 30){
const cutoff = Date.now() - Number(days)*24*3600*1000;
let income = 0, expense = 0;
for (const r of list()){
const t = new Date(r.date).getTime();
if (isNaN(t) || t < cutoff) continue;
if (r.type === 'income') income += Number(r.amount || 0);
else expense += Number(r.amount || 0);
}
return { days, income, expense, net: income - expense };
}

function toCSV(){
const rows = list();
const header = ['id','date','type','category','amount','note'].join(',');
const body = rows.map(r => [
r.id,
r.date,
r.type,
JSON.stringify(r.category || ''),
Number(r.amount || 0),
JSON.stringify(r.note || '')
].join(',')).join('\n');
return header + '\n' + body + '\n';
}

module.exports = { add, list, summary, toCSV };
