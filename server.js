// Hey Bori Cash Flow — full app with diagnostics (no external deps)
//
// Endpoints:
// GET /health
// GET / -> HTML UI (add/list/summary/export + filters + diagnostics)
// POST /api/ledger/add -> {type:'income'|'expense', amount, category, note?, date?, team?, league?}
// GET /api/ledger/list
// GET /api/ledger/list.filter -> ?team=&league=&from=YYYY-MM-DD&to=YYYY-MM-DD
// GET /api/ledger/meta
// GET /api/ledger/summary -> ?range=30
// GET /api/ledger/export.csv
// DELETE /api/ledger/delete -> ?id=...

process.on('uncaughtException', e => console.error('[uncaughtException]', e));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));

const http = require('http');
const { URL }= require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 10000);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data'); // mount a Render Disk at /data
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
let b=''; req.on('data',c=>{ b+=c; if (b.length>1e6) req.destroy(); }); // ~1MB guard
req.on('end', ()=>{
const ct = String(req.headers['content-type']||'').toLowerCase();
// JSON
if (b && ct.includes('application/json')){
try{ return resolve(JSON.parse(b)); }catch(e){ return resolve({__parseError:'invalid JSON: '+e.message}); }
}
// form-encoded
if (b && ct.includes('application/x-www-form-urlencoded')){
const out={};
b.split('&').forEach(kv=>{
const [k,v=''] = kv.split('=');
out[decodeURIComponent(k||'')] = decodeURIComponent(v.replace(/\+/g,' ')||'');
});
return resolve(out);
}
// fallback
try{ return resolve(b?JSON.parse(b):{}); }catch{ return resolve({}); }
});
});
}

function uuid(){ return crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36)+Math.random().toString(36).slice(2)); }
function toNumber(x){ const n = Number(x); return isFinite(n) ? n : NaN; }
function todayISO(){ return new Date().toISOString().slice(0,10); }
function clampISODate(s){ return (/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))) ? s : todayISO(); }
function csvEsc(s){ s=(s==null?'':String(s)); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }

// ---------- API handlers ----------
async function handleAdd(req, res){
try{
const body = await parseBody(req);
console.log('[ADD] headers=', req.headers, 'body=', body);
if (body.__parseError) return json(res,400,{ok:false,error:body.__parseError});

const type = String(body.type||'').toLowerCase();
if (!['income','expense'].includes(type)) return json(res,400,{ok:false,error:'type must be income|expense'});

const amount = toNumber(body.amount);
if (isNaN(amount) || amount <= 0) return json(res,400,{ok:false,error:'amount must be a positive number'});

const entry = {
id: uuid(),
type,
amount: Number(Number(amount).toFixed(2)),
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
console.log('[ADD ok]', entry.id);
return json(res,200,{ok:true, entry});
}catch(e){
console.error('[ADD error]', e);
return json(res,500,{ok:false,error:'server add error: '+(e.message||e)});
}
}

function listEntries(req, res){
try{
const db = readDB();
const out = [...(db.entries||[])].sort((a,b)=>{
const d = String(b.date||'').localeCompare(String(a.date||''));
return d || ((b.createdAt||0) - (a.createdAt||0));
});
return json(res,200,{ok:true, entries: out});
}catch(e){
return json(res,500,{ok:false,error:'server list error: '+(e.message||e)});
}
}

function listEntriesFiltered(req, res, u){
try{
const team = (u.searchParams.get('team')||'').trim();
const league = (u.searchParams.get('league')||'').trim();
const from = u.searchParams.get('from');
const to = u.searchParams.get('to');
const fromT = from ? new Date(from).getTime() : -Infinity;
const toT = to ? new Date(to).getTime()+86400000-1 : +Infinity;

const db = readDB();
let rows = [...(db.entries||[])];
if (team) rows = rows.filter(e=> (e.team||'')===team);
if (league) rows = rows.filter(e=> (e.league||'')===league);
if (from || to){
rows = rows.filter(e=>{
const t = new Date(e.date||todayISO()).getTime();
return isFinite(t) && t>=fromT && t<=toT;
});
}
rows.sort((a,b)=>{
const d = String(b.date||'').localeCompare(String(a.date||''));
return d || ((b.createdAt||0) - (a.createdAt||0));
});
return json(res,200,{ok:true, entries: rows});
}catch(e){
return json(res,500,{ok:false,error:'server list(filter) error: '+(e.message||e)});
}
}

function meta(req, res){
try{
const db = readDB();
const teams = new Set(), leagues = new Set(), cats = new Set();
for (const e of (db.entries||[])){
if (e.team) teams.add(e.team);
if (e.league) leagues.add(e.league);
if (e.category) cats.add(e.category);
}
return json(res,200,{ok:true,
teams:[...teams].sort((a,b)=>a.localeCompare(b)),
leagues:[...leagues].sort((a,b)=>a.localeCompare(b)),
categories:[...cats].sort((a,b)=>a.localeCompare(b))
});
}catch(e){
return json(res,500,{ok:false,error:'server meta error: '+(e.message||e)});
}
}

function summarize(req, res, u){
try{
const days = Math.max(1, Math.min(365, Number(u.searchParams.get('range') || 30)));
const cutoff = Date.now() - days*24*60*60*1000;
const db = readDB();
const within = (db.entries||[]).filter(e=>{
const t = new Date(e.date||todayISO()).getTime();
return isFinite(t) && t >= cutoff;
});

let income=0, expense=0;
const byCat = {}, byTL = {};
for (const e of within){
if (e.type==='income') income += e.amount; else expense += e.amount;
const k = e.category||'(uncategorized)';
byCat[k] = byCat[k] || {income:0,expense:0}; byCat[k][e.type]+=e.amount;
const tl = (e.team||'-')+' | '+(e.league||'-');
byTL[tl] = byTL[tl] || {income:0,expense:0}; byTL[tl][e.type]+=e.amount;
}
const net = Number((income - expense).toFixed(2));
return json(res,200,{
ok:true,
rangeDays:days,
totals:{income:+income.toFixed(2), expense:+expense.toFixed(2), net},
byCategory:byCat, byTeamLeague:byTL,
count:within.length
});
}catch(e){
return json(res,500,{ok:false,error:'server summary error: '+(e.message||e)});
}
}

function exportCSV(req, res){
try{
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
}catch(e){
return text(res,500,'CSV error: '+(e.message||e));
}
}

function deleteOne(req, res, u){
try{
const id = (u.searchParams.get('id')||'').trim();
if (!id) return json(res,400,{ok:false,error:'id required'});
const db = readDB();
const before = db.entries.length;
db.entries = db.entries.filter(e => String(e.id)!==id);
writeDB(db);
return json(res,200,{ok:true, removed: before - db.entries.length});
}catch(e){
return json(res,500,{ok:false,error:'server delete error: '+(e.message||e)});
}
}

// ---------- HTML UI (includes Diagnostics) ----------
function uiHTML(){
return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Hey Bori Cash Flow</title>
<style>
:root{
--bg:#0e1116; --card:#151a22; --line:#1f2733; --text:#e8edf4; --muted:#a7b1c2;
--accent:#2dd4bf; --accent2:#60a5fa; --danger:#f87171;
}
*{box-sizing:border-box}
body{margin:0;background:linear-gradient(180deg,#0b0f14,#0e1116);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Inter,Roboto,Arial,sans-serif}
header{padding:16px;border-bottom:1px solid var(--line);background:#0c1016;position:sticky;top:0;z-index:10}
h1{margin:0;font-size:20px}
.sub{color:var(--muted);font-size:12px;margin-top:4px}
main{max-width:980px;margin:16px auto;padding:0 12px 80px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin:12px 0}
label{display:block;font-size:12px;color:var(--muted);margin:6px 0 4px}
input,select,button,textarea{width:100%;font-size:15px;border-radius:10px;border:1px solid #233040;background:#0d1220;color:var(--text);padding:10px 12px;outline:none}
input:focus,select:focus,textarea:focus{border-color:#35507a}
button{cursor:pointer}
.row{display:flex;gap:8px;flex-wrap:wrap}
.col{flex:1;min-width:140px}
.primary{background:linear-gradient(90deg,var(--accent),var(--accent2));border:none;color:#071318;font-weight:700}
.danger{background:#2b0f12;border:1px solid #71212a;color:#ffd3d6}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border-bottom:1px solid var(--line);padding:8px 6px;font-size:13px;text-align:left;vertical-align:top}
th{color:#c8d3e6;font-weight:600}
.pill{display:inline-block;background:#0d1220;border:1px solid #233040;color:#b9c6db;border-radius:999px;padding:4px 10px;font-size:12px;margin-right:6px;white-space:nowrap}
.right{text-align:right}
.small{font-size:12px;color:var(--muted)}
a{color:#80bfff}
.err{color:#ffd3d6}
</style>
</head>
<body>
<header>
<h1>Hey Bori Cash Flow</h1>
<div class="sub">Simple • Fast • For youth teams & leagues</div>
</header>
<main>
<section class="card">
<div class="row">
<div class="col">
<label>Type</label>
<select id="type">
<option value="income">Income</option>
<option value="expense">Expense</option>
</select>
</div>
<div class="col">
<label>Amount (USD)</label>
<input id="amount" type="number" inputmode="decimal" placeholder="e.g., 25.00"/>
</div>
<div class="col">
<label>Category</label>
<select id="category">
<option value="registration">Registration</option>
<option value="dues">Dues</option>
<option value="uniforms">Uniforms</option>
<option value="equipment">Equipment</option>
<option value="tournament">Tournament</option>
<option value="travel">Travel</option>
<option value="coaching">Coaching</option>
<option value="donation">Donation</option>
<option value="sponsorship">Sponsorship</option>
<option value="misc">Misc</option>
</select>
</div>
<div class="col">
<label>Date</label>
<input id="date" type="date"/>
</div>
<div class="col">
<label>Team (optional)</label>
<input id="team" placeholder="e.g., U14 Girls"/>
</div>
<div class="col">
<label>League (optional)</label>
<input id="league" placeholder="e.g., LBJP"/>
</div>
</div>
<label>Note (optional)</label>
<textarea id="note" rows="2" placeholder="e.g., 3 jerseys @ $20"></textarea>
<div class="row" style="margin-top:10px">
<div class="col"><button class="primary" id="addBtn">Add Entry</button></div>
<div class="col"><a class="pill" href="/api/ledger/export.csv">Export CSV</a></div>
<div class="col"><span class="small" id="status"></span></div>
</div>
</section>

<section class="card">
<h3 style="margin:0 0 8px 0">Summary (Last <span id="rangeSpan">30</span> days)</h3>
<div class="row">
<div class="col">
<label>Range (days)</label>
<input id="range" type="number" min="1" max="365" value="30"/>
</div>
<div class="col">
<button id="sumBtn">Refresh Summary</button>
</div>
</div>
<div id="summaryBox" class="small" style="margin-top:8px">Loading…</div>
</section>

<section class="card">
<h3 style="margin:0 0 8px 0">Ledger</h3>
<div class="row">
<div class="col">
<label>Team filter</label>
<select id="fTeam"><option value="">All teams</option></select>
</div>
<div class="col">
<label>League filter</label>
<select id="fLeague"><option value="">All leagues</option></select>
</div>
<div class="col">
<label>From</label>
<input id="fFrom" type="date"/>
</div>
<div class="col">
<label>To</label>
<input id="fTo" type="date"/>
</div>
<div class="col" style="align-self:end">
<button id="fApply">Apply</button>
</div>
<div class="col" style="align-self:end">
<button id="fClear">Clear</button>
</div>
</div>
<div id="tableBox" style="margin-top:8px">Loading…</div>
</section>

<section class="card">
<h3 style="margin:0 0 8px 0">Diagnostics</h3>
<div class="row">
<div class="col"><button id="diagSeed">Seed $50 income</button></div>
<div class="col"><button id="diagList">GET /list</button></div>
<div class="col"><button id="diagSummary">GET /summary</button></div>
<div class="col"><button id="diagAddBad">Add (bad body)</button></div>
</div>
<pre id="diagOut" class="small" style="white-space:pre-wrap;margin-top:8px;background:#0d1220;padding:8px;border-radius:8px;border:1px solid #233040;max-height:220px;overflow:auto"></pre>
</section>
</main>

<script>
const $ = sel => document.querySelector(sel);
function fmt(n){ return (Number(n)||0).toFixed(2); }

async function fetchWithTimeout(url, opts={}, ms=12000){
const ctrl = new AbortController();
const t = setTimeout(()=>ctrl.abort(), ms);
try{ return await fetch(url, {...opts, signal: ctrl.signal}); }
finally{ clearTimeout(t); }
}

async function addEntry(){
const body = {
type: $('#type').value,
amount: Number($('#amount').value),
category: $('#category').value,
note: $('#note').value.trim(),
date: $('#date').value || null,
team: $('#team').value.trim(),
league: $('#league').value.trim()
};
$('#status').textContent = 'Adding…';
try{
const r = await fetchWithTimeout('/api/ledger/add', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
const txt = await r.text(); let j;
try{ j = JSON.parse(txt); }catch{ j = {ok:false,error:'non-JSON', raw:txt}; }
if (!j.ok){ $('#status').textContent = 'Error: ' + (j.error||('HTTP '+r.status)); return; }
$('#status').textContent = 'Added ✓';
$('#amount').value=''; $('#note').value=''; document.querySelector('#amount')?.focus();
loadMeta(); loadLedgerFiltered(); loadSummary();
}catch(err){
$('#status').textContent = 'Network/timeout: ' + (err?.message||String(err));
}
}

async function loadSummary(){
try{
const days = Math.max(1, Math.min(365, Number($('#range')?.value||30)));
$('#rangeSpan').textContent = String(days);
$('#summaryBox').textContent = 'Loading…';
const resp = await fetchWithTimeout('/api/ledger/summary?range='+encodeURIComponent(days), {cache:'no-store'});
if (!resp.ok){ $('#summaryBox').textContent = 'HTTP '+resp.status; return; }
const j = await resp.json(); if (!j.ok){ $('#summaryBox').textContent = 'Error: '+(j.error||'summary'); return; }
const t = j.totals || {income:0,expense:0,net:0};
let html = '<div><b>Totals</b> — Income: $'+fmt(t.income)+' · Expense: $'+fmt(t.expense)+' · Net: $'+fmt(t.net)+'</div>';
const byCat = j.byCategory || {}; const byTL = j.byTeamLeague || {};
html += '<div style="height:10px"></div><div><b>By Category</b></div>';
if (Object.keys(byCat).length===0){ html += '<div class="small">none</div>'; }
else {
html += '<table><thead><tr><th>Category</th><th class="right">Income</th><th class="right">Expense</th></tr></thead><tbody>';
for (const k of Object.keys(byCat)){
const row = byCat[k] || {}; html += '<tr><td>'+k+'</td><td class="right">$'+fmt(row.income||0)+'</td><td class="right">$'+fmt(row.expense||0)+'</td></tr>';
}
html += '</tbody></table>';
}
html += '<div style="height:10px"></div><div><b>By Team | League</b></div>';
if (Object.keys(byTL).length===0){ html += '<div class="small">none</div>'; }
else {
html += '<table><thead><tr><th>Team | League</th><th class="right">Income</th><th class="right">Expense</th></tr></thead><tbody>';
for (const k of Object.keys(byTL)){
const row = byTL[k] || {}; html += '<tr><td>'+k+'</td><td class="right">$'+fmt(row.income||0)+'</td><td class="right">$'+fmt(row.expense||0)+'</td></tr>';
}
html += '</tbody></table>';
}
$('#summaryBox').innerHTML = html;
}catch(err){ $('#summaryBox').textContent = 'Timeout/Network: '+(err?.message||String(err)); }
}

async function loadMeta(){
try{
const r = await fetchWithTimeout('/api/ledger/meta',{cache:'no-store'});
const j = await r.json();
if (!j.ok) return;
const tSel = $('#fTeam'); const lSel = $('#fLeague');
if (tSel){ tSel.innerHTML = '<option value="">All teams</option>' + (j.teams||[]).map(v=>'<option>'+v+'</option>').join(''); }
if (lSel){ lSel.innerHTML = '<option value="">All leagues</option>' + (j.leagues||[]).map(v=>'<option>'+v+'</option>').join(''); }
}catch(e){}
}

async function loadLedgerFiltered(){
const team = $('#fTeam')?.value || ''; const league = $('#fLeague')?.value || '';
const from = $('#fFrom')?.value || ''; const to = $('#fTo')?.value || '';
const qs = new URLSearchParams(); if (team) qs.set('team',team); if (league) qs.set('league',league);
if (from) qs.set('from',from); if (to) qs.set('to',to);
const box = $('#tableBox'); box.textContent = 'Loading…';
try{
const url = qs.toString() ? '/api/ledger/list.filter?'+qs.toString() : '/api/ledger/list';
const r = await fetchWithTimeout(url,{cache:'no-store'});
const j = await r.json();
if (!j.ok){ box.textContent = 'Failed: '+(j.error||'unknown'); return; }
const rows = j.entries || [];
if (!rows.length){ box.textContent = 'No entries for these filters.'; return; }
let html = '<table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Category</th><th>Team</th><th>League</th><th>Note</th><th>Actions</th></tr></thead><tbody>';
for (const e of rows){
html += '<tr>'+
'<td>'+ (e.date||'') +'</td>'+
'<td>'+ e.type +'</td>'+
'<td class="right">$'+ fmt(e.amount) +'</td>'+
'<td>'+ (e.category||'') +'</td>'+
'<td>'+ (e.team||'') +'</td>'+
'<td>'+ (e.league||'') +'</td>'+
'<td>'+ (e.note||'') +'</td>'+
'<td><button class="danger" onclick="deleteEntry(\''+e.id+'\')">Delete</button></td>'+
'</tr>';
}
html += '</tbody></table>';
box.innerHTML = html;
}catch(e){ box.textContent = 'Timeout/Network: '+(e?.message||String(e)); }
}

async function deleteEntry(id){
if(!confirm('Delete this entry?')) return;
try{
const r = await fetchWithTimeout('/api/ledger/delete?id='+encodeURIComponent(id), {method:'DELETE'});
const j = await r.json();
if (!j.ok){ alert('Delete failed: ' + (j.error||'unknown')); return; }
loadMeta(); loadLedgerFiltered(); loadSummary();
}catch(e){ alert('Timeout/Network: '+(e?.message||String(e))); }
}

// Diagnostics helpers
async function diagSeed(){
const body = {type:'income', amount:50, category:'registration', note:'seed', date: (new Date()).toISOString().slice(0,10)};
const r = await fetchWithTimeout('/api/ledger/add', {method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body)});
const t = await r.text(); $('#diagOut').textContent = 'POST /api/ledger/add → '+t;
loadMeta(); loadLedgerFiltered(); loadSummary();
}
async function diagList(){
const r = await fetchWithTimeout('/api/ledger/list'); const t = await r.text(); $('#diagOut').textContent = 'GET /api/ledger/list → '+t;
}
async function diagSummary(){
const r = await fetchWithTimeout('/api/ledger/summary?range='+(Number($('#range').value||30))); const t = await r.text(); $('#diagOut').textContent = 'GET /api/ledger/summary → '+t;
}
async function diagAddBad(){
const r = await fetchWithTimeout('/api/ledger/add', {method:'POST', headers:{'content-type':'application/json'}, body:'{"type":"income","amount":"BAD"}'});
const t = await r.text(); $('#diagOut').textContent = 'POST /api/ledger/add (bad) → '+t;
}

document.addEventListener('click', (e)=>{
if (e.target && e.target.id==='addBtn') addEntry();
if (e.target && e.target.id==='sumBtn') loadSummary();
if (e.target && e.target.id==='fApply') loadLedgerFiltered();
if (e.target && e.target.id==='fClear'){
$('#fTeam').value=''; $('#fLeague').value=''; $('#fFrom').value=''; $('#fTo').value='';
loadLedgerFiltered();
}
if (e.target && e.target.id==='diagSeed') diagSeed();
if (e.target && e.target.id==='diagList') diagList();
if (e.target && e.target.id==='diagSummary') diagSummary();
if (e.target && e.target.id==='diagAddBad') diagAddBad();
});
document.addEventListener('keydown', (e)=>{
if (e.key==='Enter' && document.activeElement && document.activeElement.tagName!=='TEXTAREA'){
e.preventDefault(); addEntry();
}
});
window.addEventListener('load', ()=>{
$('#date').value = (new Date()).toISOString().slice(0,10);
loadMeta(); loadLedgerFiltered(); loadSummary();
});
</script>
</body></html>`;
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
try{
const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

// CORS (ok for same-origin; widen if embedding elsewhere)
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
if (req.method === 'OPTIONS') return send(res,204,{},'');

if (req.method === 'GET' && u.pathname === '/health') return text(res,200,'OK');
if (req.method === 'GET' && u.pathname === '/') return send(res,200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}, uiHTML());

// API
if (req.method === 'POST' && u.pathname === '/api/ledger/add') return handleAdd(req,res);
if (req.method === 'GET' && u.pathname === '/api/ledger/list') return listEntries(req,res);
if (req.method === 'GET' && u.pathname === '/api/ledger/list.filter') return listEntriesFiltered(req,res,u);
if (req.method === 'GET' && u.pathname === '/api/ledger/meta') return meta(req,res);
if (req.method === 'GET' && u.pathname === '/api/ledger/summary') return summarize(req,res,u);
if (req.method === 'GET' && u.pathname === '/api/ledger/export.csv') return exportCSV(req,res);
if (req.method === 'DELETE' && u.pathname === '/api/ledger/delete') return deleteOne(req,res,u);

return text(res,404,'Not Found');
}catch(e){
console.error(e);
return text(res,500,'Server error');
}
});

server.listen(PORT, ()=>{
try{
ensureStore();
console.log('💵 Hey Bori Cash Flow listening on '+PORT+' | DATA_DIR='+DATA_DIR);
}catch(e){
console.error('Startup store error', e);
}
});
