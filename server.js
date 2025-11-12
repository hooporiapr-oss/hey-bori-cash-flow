function uiHTML(){
return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Basketball Cash Flow</title>
<style>
:root{
--bg:#0e1116; --card:#151a22; --line:#1f2733; --text:#e8edf4; --muted:#a7b1c2;
--accent:#2dd4bf; --accent2:#60a5fa; --danger:#f87171;
}
*{box-sizing:border-box}
body{margin:0;background:linear-gradient(180deg,#0b0f14,#0e1116);color:var(--text);font-family:system-ui,-apple-system,Segoe UI,Inter,Roboto,Arial,sans-serif}
header{padding:16px;border-bottom:1px solid var(--line);background:#0c1016;position:sticky;top:0;z-index:10}
h1{margin:0;font-size:20px;position:relative;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.sub{color:var(--muted);font-size:12px;margin-top:4px}
#privacyBanner{
display:none;
background:#0b1320;
border:1px solid #29415f;
color:#bcd3f0;
padding:10px 12px;
border-radius:10px;
margin:12px 12px 0 12px;
font-size:13px;
}
#privacyBanner b{ color:#9fc1ff }

#helpLink{ display:inline-block; margin:8px 12px 0 12px; font-size:13px; color:#9fc1ff; cursor:pointer; }
#helpLink:hover{ text-decoration:underline; }

#helpModal{
display:none; position:fixed; inset:0; z-index:9999;
background:rgba(0,0,0,.55); padding:20px;
}
#helpCard{
max-width:680px; margin:40px auto; background:#0c1016; color:#e8edf4;
border:1px solid #29415f; border-radius:12px; padding:16px;
box-shadow:0 10px 30px rgba(0,0,0,.35);
}
#helpCard h3{ margin:0 0 8px 0; font-size:18px }
#helpCard p, #helpCard li{ color:#c9d7ea; font-size:14px; line-height:1.45 }
#helpClose{
float:right; border:1px solid #2a3b55; background:#0d1320; color:#cfe2ff;
border-radius:8px; padding:6px 10px; cursor:pointer;
}
#helpFooter{ margin-top:10px; font-size:12px; color:#9db3d8 }
kbd{
background:#0d1320; border:1px solid #2a3b55; border-radius:6px; padding:1px 6px; font-family:ui-monospace, SFMono-Regular, Menlo, monospace;
}

main{max-width:980px;margin:16px auto;padding:0 12px 100px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin:12px 0}
label{display:block;font-size:12px;color:var(--muted);margin:6px 0 4px}
input,select,button,textarea{width:100%;font-size:15px;border-radius:10px;border:1px solid #233040;background:#0d1220;color:var(--text);padding:10px 12px;outline:none}
input:focus,select:focus,textarea:focus{border-color:#35507a}
button{cursor:pointer}
.row{display:flex;gap:8px;flex-wrap:wrap}
.col{flex:1;min-width:160px}
.primary{background:linear-gradient(90deg,var(--accent),var(--accent2));border:none;color:#071318;font-weight:700}
.small{font-size:12px;color:var(--muted)}
table{width:100%;border-collapse:collapse;margin-top:8px}
th,td{border-bottom:1px solid var(--line);padding:8px 6px;font-size:13px;text-align:left;vertical-align:top}
th{color:#c8d3e6;font-weight:600}
.right{text-align:right}
canvas{width:100%;max-width:680px;height:280px;background:#0d1220;border:1px solid #233040;border-radius:10px}
.hidden{display:none}
.pill{display:inline-block;padding:2px 8px;border:1px solid #29415f;border-radius:999px;background:#0b1320;color:#bcd3f0;font-size:12px}
#signedAs{color:#9fc1ff;font-size:12px}
#signout button{padding:6px 10px;border-radius:8px;border:1px solid #2a3b55;background:#0d1320;color:#cfe2ff}
#signout button:hover{border-color:#3c5d8a}
.hdr-right{margin-left:auto;display:flex;gap:10px;align-items:center}

/* ——— Request PIN Access responsiveness ——— */
.form-grid{ display:grid; gap:10px; grid-template-columns:1fr; }
.form-actions{ display:flex; gap:10px; flex-wrap:wrap; }
.form-actions button{ width:100%; }
@media (min-width: 720px){
.form-grid.two-col{ grid-template-columns: 1fr 1fr; }
.form-actions button{ width:auto; }
}
</style>
</head>
<body>
<header>
<h1>
Basketball Cash Flow
<span id="scopePill" class="pill hidden"></span>
<span class="hdr-right">
<span id="signedAs" class="hidden"></span>
<span id="signout" class="hidden"><button id="signoutBtn" title="Sign out">Sign Out</button></span>
</span>
</h1>
<div class="sub">Simple • Fast • For youth teams & leagues</div>
<div id="privacyBanner">🔒 Private Space</div>
<div id="helpLink" role="button" tabindex="0" aria-controls="helpModal" aria-expanded="false">Need help?</div>
</header>

<main>
<!-- Login -->
<section id="loginCard" class="card hidden">
<h3 style="margin:0 0 8px 0">Secure Coach Access</h3>
<label>PIN</label>
<input id="pin" type="password" placeholder="Enter PIN"/>
<div class="row" style="margin-top:10px">
<div class="col"><button id="loginBtn" class="primary">Sign In</button></div>
<div class="col"><span id="loginStatus" class="small"></span></div>
</div>
<div id="modeInfo" class="small" style="margin-top:6px;color:#8ca3c9"></div>
</section>

<!-- ✅ Request PIN Access (new) -->
<section id="requestPin" class="card" style="margin-top:10px;">
<h3 style="margin:0 0 8px 0;">Request PIN Access</h3>
<p class="small" style="margin-bottom:10px;">
New program? Complete this quick form and we’ll email your secure Basketball Cash Flow access details.
</p>

<form action="mailto:FiatPalante@gmail.com?subject=PIN%20Access%20Request%20-%20Basketball%20Cash%20Flow"
method="post" enctype="text/plain">
<div class="form-grid two-col">
<div>
<label>Program Name</label>
<input type="text" name="Program Name" placeholder="e.g., Arecibo Youth Basketball" required autocomplete="organization">
</div>
<div>
<label>Location</label>
<input type="text" name="Location" placeholder="City, Region" required autocomplete="address-level2">
</div>
</div>

<div class="form-grid" style="margin-top:10px;">
<div>
<label>Email</label>
<input type="email" name="Email" placeholder="your@email.com" required inputmode="email" autocomplete="email">
</div>
</div>

<div class="form-actions" style="margin-top:10px;">
<button type="submit" class="primary">Request Access</button>
</div>
</form>

<p class="small" style="margin-top:10px;">⚡ A confirmation window will open in your email app.</p>
</section>

<!-- Charts -->
<section id="chartsCard" class="card hidden">
<h3 style="margin:0 0 8px 0">Dashboard</h3>
<div class="row">
<div class="col">
<label>Range (days)</label>
<input id="rangeChart" type="number" min="1" max="365" value="30"/>
</div>
<div class="col" style="align-self:end">
<button id="chartRefresh">Refresh</button>
</div>
</div>
<canvas id="chart"></canvas>
</section>

<!-- Add Entry -->
<section id="addCard" class="card hidden">
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
<div class="col">
<label>Program (optional)</label>
<input id="program" list="programList" placeholder="e.g., Hey Bori Main"/>
<datalist id="programList"></datalist>
</div>
</div>
<label>Note (optional)</label>
<textarea id="note" rows="2" placeholder="e.g., 3 jerseys @ $20"></textarea>
<div class="row" style="margin-top:10px">
<div class="col"><button class="primary" id="addBtn">Add Entry</button></div>
<div class="col"><a id="csvLink" class="small" href="/api/ledger/export.csv">Download CSV</a></div>
<div class="col"><span class="small" id="status"></span></div>
</div>
</section>

<!-- Summary -->
<section id="summaryCard" class="card hidden">
<h3 style="margin:0 0 8px 0">Summary (Last <span id="rangeSpan">30</span> days)</h3>
<div class="row">
<div class="col"><label>Range (days)</label><input id="range" type="number" min="1" max="365" value="30"/></div>
<div class="col"><button id="sumBtn">Refresh Summary</button></div>
</div>
<div id="summaryBox" class="small" style="margin-top:8px">Loading…</div>
</section>

<!-- Ledger -->
<section id="ledgerCard" class="card hidden">
<h3 style="margin:0 0 8px 0">Ledger</h3>
<div id="miniTotals" class="small" style="margin-bottom:8px"></div>
<div id="tableBox">Loading…</div>
</section>

<!-- Help modal -->
<div id="helpModal" aria-hidden="true" aria-label="Help dialog">
<div id="helpCard">
<button id="helpClose" aria-label="Close help">Close</button>
<h3>How to use Basketball Cash Flow</h3>
<p><b>Private Mode:</b> You’re in a locked space. Each coach/program sees only their own data.</p>
<ol>
<li><b>Sign In:</b> Enter your PIN and click <i>Sign In</i>. You’ll see <i>Program</i> in the header.</li>
<li><b>Add an Entry:</b> Choose <i>Type</i> (Income/Expense), enter <i>Amount</i>, pick a <i>Category</i>, set <i>Date</i>, and optionally <i>Team</i>, <i>League</i>, <i>Note</i>. Click <i>Add Entry</i>.</li>
<li><b>Summary & Charts:</b> Pick <i>Range (days)</i>, click <i>Refresh</i>/<i>Refresh Summary</i> to update totals, categories, and bar chart.</li>
<li><b>Export CSV:</b> Click <i>Download CSV</i> to get your program’s data for spreadsheets or reports.</li>
<li><b>Sign Out:</b> Use the <i>Sign Out</i> button in the top-right when you’re done.</li>
</ol>
<p><b>Tips</b></p>
<ul>
<li>Press <kbd>?</kbd> to open this help. Press <kbd>Esc</kbd> to close.</li>
<li>Entries are scoped to your <b>Program</b> automatically in multi-PIN mode.</li>
<li>Use consistent categories (Registration, Dues, Uniforms, etc.) for cleaner reports.</li>
</ul>
<div id="helpFooter">
Need more help? Email us anytime at
<a href="mailto:FiatPalante@gmail.com" target="_blank" rel="noopener noreferrer" style="color:#9fc1ff;text-decoration:underline;">FiatPalante@gmail.com</a>
— Hooporia Institute Inc.
</div>
</div>
</div>
</main>

<script>
const $ = sel => document.querySelector(sel);
let TOKEN = localStorage.getItem('hb_token') || null;
let SESSION = {authRequired:false, mode:'none', programScope:null};

function authHeaders(h={}){ if (TOKEN) h['x-auth'] = TOKEN; return h; }
async function fetchAuthed(url, opts={}){ opts.headers = authHeaders(opts.headers || {}); return fetch(url, opts); }

// --- Silent CSV downloader using existing auth (X-Auth) ---
const IS_IOS = /iP(hone|ad|od)/i.test(navigator.userAgent);
function saveBlob(blob, filename) {
const url = URL.createObjectURL(blob);
if (IS_IOS) {
window.location.href = url;
setTimeout(() => URL.revokeObjectURL(url), 4000);
} else {
const a = document.createElement('a');
a.href = url; a.download = filename;
document.body.appendChild(a); a.click(); a.remove();
setTimeout(() => URL.revokeObjectURL(url), 1000);
}
}
async function secureCsvDownload(url, filename = 'hey-bori-cashflow.csv') {
try {
const r = await fetchAuthed(url, { method: 'GET', cache: 'no-store' });
if (!r.ok) return;
const blob = await r.blob();
saveBlob(blob, filename);
} catch {}
}

// show() also controls display for the privacy banner
function show(el, vis){ el.classList.toggle('hidden', !vis); if (el && el.id==='privacyBanner') el.style.display = vis ? 'block' : 'none'; }

function showApp(vis){
['chartsCard','addCard','summaryCard','ledgerCard'].forEach(id=> show($('#'+id), vis));
const showSecureBits = vis && SESSION.authRequired;
show($('#signout'), showSecureBits);
show($('#signedAs'), showSecureBits && !!SESSION.programScope);
updatePrivacyBanner(); // keep banner in sync
}

function setHeaderBadges(scope){
const pill = $('#scopePill');
if (scope){
pill.textContent = 'Program: '+scope;
show(pill, true);
const s = $('#signedAs');
if (s){ s.textContent = 'Signed in as: ' + scope; }
}else{
show(pill, false);
}
updatePrivacyBanner();
}

function updatePrivacyBanner(){
const b = document.getElementById('privacyBanner');
if (!b) return;
const authed = (SESSION.authRequired && (TOKEN && (SESSION.mode==='single' || SESSION.programScope!==null)));
if (!authed){ b.style.display='none'; return; }
if (SESSION.mode==='multi' && SESSION.programScope){
b.innerHTML = '🔒 Private Program Space — <b>'+SESSION.programScope+'</b>';
}else{
b.innerHTML = '🔒 Private Coach Space';
}
b.style.display='block';
}

function openHelp(){
const m = document.getElementById('helpModal');
const l = document.getElementById('helpLink');
if (!m) return;
m.style.display = 'block';
m.setAttribute('aria-hidden','false');
if (l) l.setAttribute('aria-expanded','true');
}
function closeHelp(){
const m = document.getElementById('helpModal');
const l = document.getElementById('helpLink');
if (!m) return;
m.style.display = 'none';
m.setAttribute('aria-hidden','true');
if (l) l.setAttribute('aria-expanded','false');
}
document.addEventListener('click', (e)=>{
if (e.target && e.target.id === 'helpLink') openHelp();
if (e.target && e.target.id === 'helpClose') closeHelp();
if (e.target && e.target.id === 'helpModal') {
if (e.target === document.getElementById('helpModal')) closeHelp();
}
});
document.addEventListener('keydown', (e)=>{
if (e.key === '?') openHelp();
if (e.key === 'Escape') closeHelp();
});

function lockProgramIfScoped(){
const input = $('#program'), dl = $('#programList');
if (SESSION.programScope){
input.value = SESSION.programScope;
input.readOnly = true;
if (dl) dl.innerHTML = '';
}else{
input.readOnly = false;
}
}
function updateCsvLink(){
const qs = new URLSearchParams();
if (SESSION.programScope) qs.set('program', SESSION.programScope);
const url = '/api/ledger/export.csv' + (qs.toString() ? ('?' + qs.toString()) : '');
const a = $('#csvLink'); if (!a) return;
a.dataset.href = url; a.href = '#';
if (!a.__hb_wired) {
a.addEventListener('click', (e) => {
e.preventDefault();
const targetUrl = a.dataset.href || '/api/ledger/export.csv';
secureCsvDownload(targetUrl, 'hey-bori-cashflow.csv');
});
a.__hb_wired = true;
}
}

function signOut(){
try{ localStorage.removeItem('hb_token'); }catch(_){}
window.location.reload();
}
$('#signoutBtn')?.addEventListener('click', signOut);

// ---- Session bootstrap ----
async function loadSession(){
try{
const r = await fetchAuthed('/api/session',{cache:'no-store'});
const j = await r.json();
SESSION = {authRequired:j.authRequired, mode:j.mode, programScope:j.programScope};
setHeaderBadges(SESSION.programScope);
if (!SESSION.authRequired){ show($('#loginCard'), false); show($('#requestPin'), false); showApp(true); init(); return; }
if (TOKEN && (SESSION.programScope !== null || SESSION.mode==='single')){
show($('#loginCard'), false); show($('#requestPin'), false); showApp(true); init(); return;
}
// Not signed in yet → show login + request PIN
$('#modeInfo').textContent = 'Mode: '+SESSION.mode+' — PINs required';
show($('#loginCard'), true);
show($('#requestPin'), true);
showApp(false);
}catch(e){
// If /api/session fails, still show login + request PIN
show($('#loginCard'), true);
show($('#requestPin'), true);
showApp(false);
}
}

// ---- Login ----
$('#loginBtn')?.addEventListener('click', async ()=>{
const pin = ($('#pin')?.value||'').trim();
$('#loginStatus').textContent = 'Checking…';
try{
const r = await fetch('/api/login', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({pin})});
const j = await r.json();
if (!j.ok){ $('#loginStatus').textContent = 'Invalid PIN'; return; }
if (j.token){ TOKEN = j.token; localStorage.setItem('hb_token', TOKEN); }
SESSION = {authRequired:true, mode:j.mode, programScope:j.program||null};
setHeaderBadges(SESSION.programScope);
$('#loginStatus').textContent = 'Unlocked ✓';
show($('#loginCard'), false); show($('#requestPin'), false); showApp(true); init();
}catch(e){
$('#loginStatus').textContent = 'Network error';
}
});

// ---- Add Entry ----
function fmt(n){ return (Number(n)||0).toFixed(2); }

async function addEntry(){
const body = {
type: $('#type').value,
amount: Number($('#amount').value),
category: $('#category').value,
note: $('#note').value.trim(),
date: $('#date').value || null,
team: $('#team').value.trim(),
league: $('#league').value.trim(),
program: $('#program').value.trim()
};
$('#status').textContent = 'Adding…';
try{
const r = await fetchAuthed('/api/ledger/add', {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
const j = await r.json();
if (!j.ok){ $('#status').textContent = 'Error: ' + (j.error||('HTTP '+r.status)); return; }
$('#status').textContent = 'Added ✓';
$('#amount').value=''; $('#note').value='';
$('#amount').focus();
refreshAll();
}catch(err){
$('#status').textContent = 'Network error: ' + (err?.message||String(err));
}
}
document.addEventListener('click', (e)=>{
if (e.target && e.target.id==='addBtn') addEntry();
if (e.target && e.target.id==='sumBtn') loadSummary();
if (e.target && e.target.id==='chartRefresh') drawChart();
});
document.addEventListener('keydown', (e)=>{
if (e.key==='Enter' && document.activeElement && document.activeElement.tagName!=='TEXTAREA'){
e.preventDefault(); addEntry();
}
});

// ---- Meta ----
async function loadMeta(){
try{
const r = await fetchAuthed('/api/ledger/meta',{cache:'no-store'});
const j = await r.json();
if (!j.ok) return;
const dl = $('#programList');
if (!SESSION.programScope && dl){
dl.innerHTML = (j.programs||[]).map(p=>'<option value="'+p+'"></option>').join('');
}else if (dl){ dl.innerHTML = ''; }
updateCsvLink();
}catch(e){}
}

// ---- Ledger + mini totals ----
async function loadList(){
const box = $('#tableBox'); box.textContent = 'Loading…';
try{
const r = await fetchAuthed('/api/ledger/list', {cache:'no-store'});
const j = await r.json();
if (!j.ok){ box.textContent = 'Failed to load: '+(j.error||'unknown'); return; }
const rows = j.entries || [];
const miniEl = $('#miniTotals');

if (!rows.length){
miniEl.innerHTML = '<div class="small">No entries yet.</div>';
box.textContent = 'No entries yet.';
return;
} else {
const agg = {};
for (const e of rows){
const k = e.program||'(no program)';
agg[k] = agg[k] || {income:0,expense:0};
agg[k][e.type]+= (e.amount||0);
}
let mini = '<div><b>Per-Program totals</b></div><table><thead><tr><th>Program</th><th class="right">Income</th><th class="right">Expense</th><th class="right">Net</th></tr></thead><tbody>';
for (const k of Object.keys(agg)){
const a = agg[k]; const net = (a.income - a.expense);
mini += '<tr><td>'+k+'</td><td class="right">$'+fmt(a.income)+'</td><td class="right">$'+fmt(a.expense)+'</td><td class="right">$'+fmt(net)+'</td></tr>';
}
mini += '</tbody></table>';
miniEl.innerHTML = mini;
}

let html = '<table><thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Category</th><th>Team</th><th>League</th><th>Program</th><th>Note</th></tr></thead><tbody>';
for (const e of rows){
html += '<tr>'+
'<td>'+ (e.date||'') +'</td>'+
'<td>'+ e.type +'</td>'+
'<td class="right">$'+ fmt(e.amount) +'</td>'+
'<td>'+ (e.category||'') +'</td>'+
'<td>'+ (e.team||'') +'</td>'+
'<td>'+ (e.league||'') +'</td>'+
'<td>'+ (e.program||'') +'</td>'+
'<td>'+ (e.note||'') +'</td>'+
'</tr>';
}
html += '</tbody></table>';
box.innerHTML = html;
}catch(e){
box.textContent = 'Network error: '+(e?.message||String(e));
}
}

// ---- Summary ----
async function loadSummary(){
try{
const days = Math.max(1, Math.min(365, Number($('#range')?.value||30)));
$('#rangeSpan').textContent = String(days);
$('#summaryBox').textContent = 'Loading…';

const resp = await fetchAuthed('/api/ledger/summary?range='+encodeURIComponent(days), {cache:'no-store'});
if (!resp.ok){ $('#summaryBox').textContent = 'HTTP '+resp.status; return; }
const j = await resp.json(); if (!j.ok){ $('#summaryBox').textContent = 'Error: '+(j.error||'summary'); return; }

const t = j.totals || {income:0,expense:0,net:0};
let html = '<div><b>Totals</b> — Income: $'+fmt(t.income)+' · Expense: $'+fmt(t.expense)+' · Net: $'+fmt(t.net)+'</div>';

const byCat = j.byCategory || {};
const byTL = j.byTeamLeague || {};
const byProgram = j.byProgram || {};

html += '<div style="height:10px"></div><div><b>By Category</b></div>';
if (Object.keys(byCat).length===0){
html += '<div class="small">none</div>';
}else{
html += '<table><thead><tr><th>Category</th><th class="right">Income</th><th class="right">Expense</th></tr></thead><tbody>';
for (const k of Object.keys(byCat)){
const row = byCat[k] || {};
html += '<tr><td>'+k+'</td><td class="right">$'+fmt(row.income||0)+'</td><td class="right">$'+fmt(row.expense||0)+'</td></tr>';
}
html += '</tbody></table>';
}

html += '<div style="height:10px"></div><div><b>By Team | League</b></div>';
if (Object.keys(byTL).length===0){
html += '<div class="small">none</div>';
}else{
html += '<table><thead><tr><th>Team | League</th><th class="right">Income</th><th class="right">Expense</th></tr></thead><tbody>';
for (const k of Object.keys(byTL)){
const row = byTL[k] || {};
html += '<tr><td>'+k+'</td><td class="right">$'+fmt(row.income||0)+'</td><td class="right">$'+fmt(row.expense||0)+'</td></tr>';
}
html += '</tbody></table>';
}

html += '<div style="height:10px"></div><div><b>By Program</b></div>';
if (Object.keys(byProgram).length===0){
html += '<div class="small">none</div>';
}else{
html += '<table><thead><tr><th>Program</th><th class="right">Income</th><th class="right">Expense</th></tr></thead><tbody>';
for (const k of Object.keys(byProgram)){
const row = byProgram[k] || {};
html += '<tr><td>'+k+'</td><td class="right">$'+fmt(row.income||0)+'</td><td class="right">$'+fmt(row.expense||0)+'</td></tr>';
}
html += '</tbody></table>';
}

$('#summaryBox').innerHTML = html;
}catch(err){
$('#summaryBox').textContent = 'Unexpected: '+(err?.message||String(err));
}
}

// ---- Charts ----
async function drawChart(){
const days = Math.max(1, Math.min(365, Number($('#rangeChart')?.value||30)));
const r = await fetchAuthed('/api/ledger/summary?range='+encodeURIComponent(days), {cache:'no-store'});
if (!r.ok) return;
const j = await r.json();
const income = j.totals?.income || 0;
const expense = j.totals?.expense || 0;

const c = $('#chart'); const ctx = c.getContext('2d');
const W = c.width = c.clientWidth * devicePixelRatio;
const H = c.height = c.clientHeight * devicePixelRatio;
ctx.scale(devicePixelRatio, devicePixelRatio);

ctx.fillStyle = '#0d1220'; ctx.fillRect(0,0,c.clientWidth,c.clientHeight);
ctx.strokeStyle = '#233040'; ctx.strokeRect(0.5,0.5,c.clientWidth-1,c.clientHeight-1);

const padding = 36;
const innerW = c.clientWidth - padding*2;
const innerH = c.clientHeight - padding*2;

const maxV = Math.max(1, income, expense);
const barW = innerW/4;
const gap = innerW/2 - barW*2;

function bar(xIndex, val, label){
const x = padding + (xIndex===0 ? barW*0.5 : barW*1.5 + gap);
const h = Math.round((val/maxV)*innerH);
const y = padding + innerH - h;
ctx.fillStyle = xIndex===0 ? '#2dd4bf' : '#60a5fa';
ctx.fillRect(x, y, barW, h);
ctx.fillStyle = '#c8d3e6';
ctx.textAlign = 'center'; ctx.font = '12px system-ui';
ctx.fillText(label, x+barW/2, padding + innerH + 14);
ctx.fillText('$'+val.toFixed(2), x+barW/2, y-6);
}

ctx.strokeStyle = '#1f2733';
ctx.beginPath(); ctx.moveTo(padding, padding+innerH+0.5); ctx.lineTo(padding+innerW, padding+innerH+0.5); ctx.stroke();

bar(0, income, 'Income');
bar(1, expense, 'Expense');
}

// ---- init ----
async function refreshAll(){
await loadMeta();
lockProgramIfScoped();
await loadList();
await loadSummary();
await drawChart();
updateCsvLink();
updatePrivacyBanner();
}
function init(){
$('#date').value = (new Date()).toISOString().slice(0,10);
refreshAll();
}
window.addEventListener('load', loadSession);
</script>
</body></html>`;
}
