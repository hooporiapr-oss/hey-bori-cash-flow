// server.js — Hey Bori Cash Flow™ (English-only UI)
// Zero dependencies. Render-ready. Works with ledger.js.
//
// ENV:
// PORT (injected by Render)
// DATA_DIR=/data (for persistence; mount a disk at /data)
// FORCE_DOMAIN=cash.heybori.co (optional; enable after TLS on custom domain)
// CSP_ANCESTORS="https://heybori.co https://www.heybori.co https://chat.heybori.co https://cash.heybori.co" (optional)

process.on('uncaughtException', e => console.error('[uncaughtException]', e));
process.on('unhandledRejection', e => console.error('[unhandledRejection]', e));

const http = require('http');
const { URL } = require('url');
const ledger = require('./ledger');

const PORT = Number(process.env.PORT || 10000);
const FORCE_DOMAIN = (process.env.FORCE_DOMAIN || '').trim();
const CSP_ANCESTORS_RAW = process.env.CSP_ANCESTORS ||
'https://heybori.co https://www.heybori.co https://chat.heybori.co https://cash.heybori.co';

// ---------- helpers ----------
function sanitizeSpace(s){ return String(s||'').replace(/[\r\n'"]/g,' ').replace(/\s+/g,' ').trim(); }
function buildFrameAncestors(raw){
const list = sanitizeSpace(raw).split(/[,\s]+/).filter(Boolean);
return 'frame-ancestors ' + (list.length ? list : ['https://heybori.co','https://cash.heybori.co']).join(' ');
}
const CSP_VALUE = buildFrameAncestors(CSP_ANCESTORS_RAW);

function send(res, code, headers, body){ res.writeHead(code, headers); res.end(body); }
function html(res, s){ send(res, 200, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':CSP_VALUE}, s); }
function json(res, code, obj){ send(res, code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':CSP_VALUE}, JSON.stringify(obj)); }
function text(res, code, s){ send(res, code, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':CSP_VALUE}, String(s)); }

// Optional: redirect *.onrender.com → FORCE_DOMAIN
function maybeRedirectToCustomDomain(req, res, u){
if (!FORCE_DOMAIN) return false;
const host = (u.host||'').toLowerCase();
if (host.endsWith('.onrender.com')) {
const loc = 'https://' + FORCE_DOMAIN + (u.pathname || '/') + (u.search || '');
res.writeHead(301, {'Location': loc, 'Cache-Control':'no-store','Content-Security-Policy':CSP_VALUE});
res.end();
return true;
}
return false;
}

// ---------- UI ----------
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Hey Bori Cash Flow™</title>
<meta name="theme-color" content="#0a3a78">
<style>
:root{--deep:#0a3a78;--sky:#1c64ff;--white:#fff;--text:#101114;--border:#e6e6e6}
*{box-sizing:border-box}
html,body{margin:0;height:100%;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:linear-gradient(180deg,var(--deep),var(--sky));color:var(--text)}
.app{min-height:100svh;display:flex;flex-direction:column}
header{display:flex;justify-content:space-between;align-items:center;padding:14px 16px;background:rgba(10,58,120,.82);color:#fff;border-bottom:1px solid rgba(255,255,255,.25);backdrop-filter:saturate(120%) blur(6px)}
h1{margin:0;font:800 18px/1.2 system-ui}
.sub{margin:2px 0 0 0;font:700 12px/1.4 system-ui;opacity:.95}
main{padding:12px 14px;display:grid;gap:12px}
.card{background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px}
label{font:700 12px system-ui;display:block;margin-bottom:6px;color:#223}
.row{display:flex;gap:8px;flex-wrap:wrap}
input,select{padding:10px;border:1px solid #ddd;border-radius:10px;font:600 14px system-ui}
input[type="number"],input[type="text"][inputmode="decimal"]{max-width:160px}
button.primary{background:#0a3a78;color:#fff;border:1px solid #0c2a55;border-radius:10px;padding:10px 14px;font:800 14px system-ui;cursor:pointer}
button{cursor:pointer}
.table{width:100%;border-collapse:collapse}
.table th,.table td{border-bottom:1px solid #eee;padding:8px 6px;text-align:left;font:600 13px system-ui}
.kpis{display:flex;gap:10px;flex-wrap:wrap}
.kpi{flex:1 1 120px;background:#fff;border:1px solid var(--border);border-radius:12px;padding:12px}
.kpi h3{margin:0 0 6px 0;font:800 12px system-ui;color:#334}
.kpi .val{font:800 18px system-ui}
footer{padding:14px 16px;color:#fff;opacity:.92}
.small{font:600 12px/1.4 system-ui}
.notice{margin-top:6px;color:#0a3a78;min-height:18px}
@media (max-width:480px){
header{padding:12px}
main{padding:10px}
}
</style>
</head>
<body>
<section class="app">
<header>
<div>
<h1>Hey Bori Cash Flow™</h1>
<div class="sub">Simple, fast ledger for youth basketball teams</div>
</div>
<div>
<button id="btnExport" class="primary" title="Export CSV">Export CSV</button>
</div>
</header>

<main>
<div class="card">
<label>Add transaction</label>
<div class="row">
<select id="type" title="Type">
<option value="income">Income</option>
<option value="expense">Expense</option>
</select>

<input id="amount" type="text" inputmode="decimal" placeholder="Amount (e.g. 10 or $10)" title="Amount">

<!-- Category dropdown with income/expense groups and Custom -->
<select id="category" title="Category">
<option value="">Select category</option>
<optgroup label="Income">
<option>Donations</option>
<option>Sponsorships</option>
<option>Fundraisers</option>
<option>Concessions</option>
<option>Ticket Sales</option>
<option>Registration Fees</option>
</optgroup>
<optgroup label="Expenses">
<option>Uniforms</option>
<option>Referee Fees</option>
<option>Travel</option>
<option>Tournament Fees</option>
<option>Equipment</option>
<option>Facility Rentals</option>
<option>Miscellaneous</option>
</optgroup>
<option value="Custom">Custom</option>
</select>

<input id="note" placeholder="Note (optional)" title="Note">
<input id="date" type="date" title="Date">
<button id="btnAdd" class="primary">Add</button>
</div>
<div id="msg" class="small notice"></div>
</div>

<div class="kpis">
<div class="kpi"><h3>Income (30d)</h3><div class="val" id="kIncome">$0.00</div></div>
<div class="kpi"><h3>Expenses (30d)</h3><div class="val" id="kExpense">$0.00</div></div>
<div class="kpi"><h3>Net (30d)</h3><div class="val" id="kNet">$0.00</div></div>
</div>

<div class="card">
<label>Recent transactions</label>
<table class="table" id="tbl">
<thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Amount</th><th>Note</th></tr></thead>
<tbody></tbody>
</table>
</div>
</main>

<footer class="small">— Hey Bori Cash Flow™ — Bori Labs LLC — Let’s Go Pa’lante</footer>
</section>

<script>
async function api(path, opt){ const r=await fetch(path, opt); if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); }
function fmt(n){ return '$'+(Number(n||0)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function td(s){ const c=document.createElement('td'); c.textContent=s; return c; }

async function refresh(){
try{
const s = await api('/api/ledger/summary?range=30');
document.getElementById('kIncome').textContent = fmt(s.income||0);
document.getElementById('kExpense').textContent = fmt(s.expense||0);
document.getElementById('kNet').textContent = fmt(s.net||0);
}catch(e){ console.warn('summary failed', e); }

try{
const list = await api('/api/ledger/list');
const tbody = document.querySelector('#tbl tbody');
tbody.innerHTML='';
(list.rows||[]).slice(-50).reverse().forEach(r=>{
const tr=document.createElement('tr');
tr.appendChild(td(new Date(r.date).toLocaleDateString()));
tr.appendChild(td(r.type));
tr.appendChild(td(r.category||''));
tr.appendChild(td(fmt(r.amount)));
tr.appendChild(td(r.note||''));
tbody.appendChild(tr);
});
}catch(e){ console.warn('list failed', e); }
}

// Optional: nudge category list to top group based on type (visual aid)
document.getElementById('type').addEventListener('change', ()=>{
const type = document.getElementById('type').value;
const cat = document.getElementById('category');
// If current selection doesn't match group, reset to placeholder
const incomeSet = new Set(['Donations','Sponsorships','Fundraisers','Concessions','Ticket Sales','Registration Fees']);
const expenseSet = new Set(['Uniforms','Referee Fees','Travel','Tournament Fees','Equipment','Facility Rentals','Miscellaneous']);
const v = cat.value;
if (type === 'income' && (expenseSet.has(v) || v === '')) { cat.value=''; }
if (type === 'expense' && (incomeSet.has(v) || v === '')) { cat.value=''; }
});

document.getElementById('btnAdd').addEventListener('click', async ()=>{
const type = (document.getElementById('type').value || '').trim();

// Accept $10 or 10
const amtRaw = (document.getElementById('amount').value || '').toString().replace(/[^0-9.\-]/g,'');
const amount = parseFloat(amtRaw);

let category = (document.getElementById('category').value || '').trim();
const note = (document.getElementById('note').value || '').trim();
const dateEl = (document.getElementById('date').value || '').trim();
const date = dateEl ? new Date(dateEl + 'T12:00:00Z').toISOString() : null;

const msg = document.getElementById('msg');
msg.textContent = '';

if (category === 'Custom') {
const custom = prompt('Enter custom category:');
if (custom && custom.trim()) category = custom.trim();
else { msg.textContent = 'Category required'; return; }
}

if (!category) { msg.textContent = 'Category required'; return; }
if (!isFinite(amount) || amount <= 0) { msg.textContent = 'Amount invalid — use 10.00'; return; }

try{
const r = await fetch('/api/ledger/add', {
method: 'POST',
headers: {'content-type':'application/json'},
body: JSON.stringify({ type, amount, category, note, date })
});
const data = await r.json().catch(()=>({ok:false, error:'Invalid server response'}));

if (!r.ok || !data.ok) {
msg.textContent = 'Error: ' + (data.error || r.statusText || 'check input');
return;
}

msg.textContent = 'Recorded ✓';
document.getElementById('amount').value='';
document.getElementById('category').value='';
document.getElementById('note').value='';
document.getElementById('date').value='';
refresh();
}catch(e){
msg.textContent = 'Error: ' + (e.message || 'network');
}
});

document.getElementById('btnExport').addEventListener('click', ()=>{
window.location.href='/api/ledger/export.csv';
});

refresh();
</script>
</body>
</html>`;

// ---------- server & routes ----------
const server = http.createServer((req, res) => {
const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

// Optional redirect to custom domain
if (maybeRedirectToCustomDomain(req, res, u)) return;

// Health
if (req.method === 'GET' && u.pathname === '/health') {
return text(res, 200, 'OK');
}

// UI
if (req.method === 'GET' && u.pathname === '/') {
return html(res, PAGE);
}

// --- API: add entry (robust parse & validate) ---
if (req.method === 'POST' && u.pathname === '/api/ledger/add') {
let body = '';
req.on('data', c => body += c);
req.on('end', () => {
try {
const j = JSON.parse(body || '{}');

const type = (j.type === 'expense') ? 'expense' : 'income';

// Accept "10", "10.00", "$10"
const amount = parseFloat(String(j.amount ?? '').replace(/[^0-9.\-]/g, ''));
const category = String(j.category ?? '').trim();
const note = String(j.note ?? '').trim();

// Date: ISO, "YYYY-MM-DD", or now
let d = j.date ? new Date(j.date) : new Date();
if (String(j.date || '').match(/^\d{4}-\d{2}-\d{2}$/)) {
d = new Date(String(j.date) + 'T12:00:00Z');
}
if (isNaN(d.getTime())) d = new Date();

if (!isFinite(amount) || amount <= 0) throw new Error('Amount must be a number greater than 0');
if (!category) throw new Error('Category is required');

const entry = ledger.add({ type, amount, category, note, date: d });
return json(res, 200, { ok: true, entry });
} catch (e) {
return json(res, 400, { ok: false, error: String(e.message || e) });
}
});
return;
}

// List
if (req.method === 'GET' && u.pathname === '/api/ledger/list') {
try { return json(res, 200, { ok:true, rows: ledger.list() }); }
catch(e){ return json(res, 500, { ok:false, error:String(e) }); }
}

// Summary
if (req.method === 'GET' && u.pathname === '/api/ledger/summary') {
try {
const days = Math.max(1, Math.min(365, Number(u.searchParams.get('range')||30)));
return json(res, 200, ledger.summary(days));
} catch(e){
return json(res, 500, { ok:false, error:String(e) });
}
}

// Export CSV
if (req.method === 'GET' && u.pathname === '/api/ledger/export.csv') {
try{
const csv = ledger.toCSV();
res.writeHead(200, {
'Content-Type':'text/csv; charset=utf-8',
'Content-Disposition':'attachment; filename="ledger.csv"',
'Cache-Control':'no-store',
'Content-Security-Policy':CSP_VALUE
});
return res.end(csv);
}catch(e){
return json(res, 500, { ok:false, error:String(e) });
}
}

// 404
return text(res, 404, 'Not Found');
});

server.listen(PORT, () => console.log('✅ Hey Bori Cash Flow™ listening on ' + PORT));
