// Hey Bori Cash Flow — zero-dependency Node server
// Endpoints:
// GET /health
// GET / -> small help
// POST /api/ledger/add -> {type:'income'|'expense', amount, category, note?, date?, team?, league?}
// GET /api/ledger/list -> {entries:[...]}
// GET /api/ledger/summary?range=30 -> totals by type/category (last N days; default 30)
// GET /api/ledger/export.csv -> CSV of all entries
// DELETE /api/ledger/delete?id=... -> remove one entry by id
//
// Render settings:
// Build: true
// Start: node server.js
// Env: DATA_DIR=/data (and attach a Disk mounted at /data)

process.on('uncaughtException', e => console.error('[uncaughtException]', e));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));

const http = require('http');
const { URL }= require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 10000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const LEDGER_FN = path.join(DATA_DIR, 'ledger.json');

// ---------- storage ----------
function ensureStore(){
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});
if (!fs.existsSync(LEDGER_FN)) fs.writeFileSync(LEDGER_FN, JSON.stringify({entries:[]}, null, 2));
}
function readDB(){ ensureStore(); return JSON.parse(fs.readFileSync(LEDGER_FN, 'utf8')); }
function writeDB(db){ fs.writeFileSync(LEDGER_FN, JSON.stringify(db, null, 2)); }

// ---------- helpers ----------
function send(res, code, headers, body){ res.writeHead(code, headers); res.end(body); }
function text(res, code, s){ send(res, code, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}, String(s)); }
function json(res, code, obj){ send(res, code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}, JSON.stringify(obj)); }

function parseBody(req){
return new Promise(resolve=>{
let b=''; req.on('data',c=>b+=c); req.on('end', ()=>{
try{ resolve(b ? JSON.parse(b) : {}); }catch(e){ resolve({__parseError:String(e)}) }
});
});
}
function uuid(){ return crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36)+Math.random().toString(36).slice(2)); }
function toNumber(x){ const n = Number(x); return isFinite(n) ? n : NaN; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function clampISODate(s){
if (!s || typeof s !== 'string') return todayISO();
const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? s : todayISO();
}
function csvEsc(s){
s = (s==null ? '' : String(s));
if (/[",\n]/.test(s)) return `"${s.replace(/"/g,'""')}"`;
return s;
}

// ---------- API logic ----------
async function handleAdd(req, res){
const body = await parseBody(req);
if (body.__parseError) return json(res,400,{ok:false,error:'invalid JSON'});

const type = String(body.type||'').toLowerCase();
if (!['income','expense'].includes(type)) return json(res,400,{ok:false,error:'type must be income|expense'});

const amount = toNumber(body.amount);
if (isNaN(amount) || amount <= 0) return json(res,400,{ok:false,error:'amount must be a positive number'});

const entry = {
id: uuid(),
type, // 'income' | 'expense'
amount: Number(amount.toFixed(2)),
category: (body.category||'').trim() || '(uncategorized)',
note: (body.note||'').trim(),
date: clampISODate(body.date),
team: (body.team||'').trim(),
league: (body.league||'').trim(),
createdAt: Date.now(),
updatedAt: Date.now()
};

const db = readDB();
db.entries.unshift(entry); // newest first
writeDB(db);
return json(res,200,{ok:true, entry});
}

function listEntries(req, res){
const db = readDB();
// Always sort newest first by date then createdAt
const out = [...(db.entries||[])].sort((a,b)=>{
const d = String(b.date||'').localeCompare(String(a.date||''));
return d || (b.createdAt||0) - (a.createdAt||0);
});
return json(res,200,{ok:true, entries: out});
}

function summarize(req, res, u){
const days = Math.max(1, Math.min(365, Number(u.searchParams.get('range') || 30)));
const cutoff = Date.now() - days*24*60*60*1000;

const db = readDB();
const within = (db.entries||[]).filter(e=>{
const t = new Date(e.date||todayISO()).getTime();
return isFinite(t) && t >= cutoff;
});

let income=0, expense=0;
const byCat = {};
for (const e of within){
if (e.type==='income') income += e.amount;
else expense += e.amount;
const k = e.category||'(uncategorized)';
byCat[k] = byCat[k] || {income:0,expense:0};
byCat[k][e.type] += e.amount;
}
const net = Number((income - expense).toFixed(2));
return json(res,200,{ok:true, rangeDays:days, totals:{income:+income.toFixed(2), expense:+expense.toFixed(2), net}, byCategory:byCat, count:within.length});
}

function exportCSV(req, res){
const db = readDB();
const rows = [
['id','date','type','amount','category','note','team','league','createdAt','updatedAt'].map(csvEsc).join(',')
];
for (const e of (db.entries||[])){
rows.push([
e.id, e.date, e.type, String(e.amount),
e.category||'', e.note||'',
e.team||'', e.league||'',
String(e.createdAt||''), String(e.updatedAt||'')
].map(csvEsc).join(','));
}
const csv = rows.join('\n');
send(res,200,{
'Content-Type':'text/csv; charset=utf-8',
'Content-Disposition':'attachment; filename="hey-bori-cashflow.csv"',
'Cache-Control':'no-store'
}, csv);
}

function deleteOne(req, res, u){
const id = (u.searchParams.get('id')||'').trim();
if (!id) return json(res,400,{ok:false,error:'id required'});

const db = readDB();
const before = db.entries.length;
db.entries = db.entries.filter(e => String(e.id)!==id);
writeDB(db);
return json(res,200,{ok:true, removed: before - db.entries.length});
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
try{
const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

// Basic CORS (safe for your own origin; adjust if embedding elsewhere)
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
if (req.method === 'OPTIONS') return send(res,204,{},'');

// Health
if (req.method === 'GET' && u.pathname === '/health') return text(res,200,'OK');

// Tiny home/help
if (req.method === 'GET' && u.pathname === '/')
return text(res,200,'Hey Bori Cash Flow — POST /api/ledger/add, GET /api/ledger/list, GET /api/ledger/summary?range=30, GET /api/ledger/export.csv, DELETE /api/ledger/delete?id=');

// API routes
if (req.method === 'POST' && u.pathname === '/api/ledger/add') return handleAdd(req,res);
if (req.method === 'GET' && u.pathname === '/api/ledger/list') return listEntries(req,res);
if (req.method === 'GET' && u.pathname === '/api/ledger/summary') return summarize(req,res,u);
if (req.method === 'GET' && u.pathname === '/api/ledger/export.csv') return exportCSV(req,res);
if (req.method === 'DELETE' && u.pathname === '/api/ledger/delete') return deleteOne(req,res,u);

return text(res,404,'Not Found');
}catch(e){
console.error(e);
return text(res,500,'Server error');
}
});

server.listen(PORT, ()=> {
ensureStore();
console.log('💵 Hey Bori Cash Flow listening on '+PORT);
});
