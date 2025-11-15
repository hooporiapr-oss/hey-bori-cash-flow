// Hey Bori Cash Flow — Multi-PIN / Single-PIN / Open

// Privacy Banner, "Signed in as", Help modal, Charts, CSV export, Program-scoped data



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



const ENV_PINS = (process.env.COACH_PINS || '').trim(); // "1628:Hey Bori Main,4521:Bayamon"

const SINGLE_PIN = (process.env.COACH_PIN || '').trim();



function sha256(s){ return crypto.createHash('sha256').update(String(s)).digest('hex'); }



// ---- Auth mode ----

let AUTH_MODE = 'none'; // 'none' | 'single' | 'multi'

let SINGLE_HASH = null;

let PIN_MAP = []; // [{pin, program, hash}]

let HASH_TO_PROGRAM = new Map();

// ---- CSV + Auth helpers ----



// Parse cookies from request

function parseCookies(req) {

const h = req.headers.cookie || '';

const out = {};

h.split(';').forEach(p => {

const [k, ...v] = p.split('=');

if (!k) return;

out[k.trim()] = decodeURIComponent((v.join('=') || '').trim());

});

return out;

}



// Detect signed-in user from cookie or token

function userFromRequest(req) {

if (req.user) return req.user;

if (req.session && req.session.user) return req.session.user;



const cookies = parseCookies(req);

if (Object.keys(cookies).length > 0) {

const program = cookies.program || cookies.cf_program || cookies.pin_program || null;

return { via: 'cookie', program };

}



const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)/i);

if (m) return { via: 'bearer', token: m[1], program: null };



return null;

}



// Build CSV from ledger.json

function buildTransactionsCSVSync(programFilter) {

let rows = [];

try {

const raw = fs.readFileSync(LEDGER_FN, 'utf8');

const data = JSON.parse(raw);

rows = Array.isArray(data) ? data : (Array.isArray(data.entries) ? data.entries : []);

} catch {

rows = [];

}



if (programFilter) {

rows = rows.filter(r => {

const prog = (r.program || r.team || r.league || '').toString().trim().toLowerCase();

return prog === String(programFilter).trim().toLowerCase();

});

}



const header = [

'transaction_id','date','type','category','description',

'amount','currency','program','source','created_by'

];



const lines = [header.join(',')];

const esc = x => {

const s = (x == null ? '' : String(x));

return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;

};



for (const r of rows) {

lines.push([

esc(r.id || r.transaction_id || ''),

esc(r.date || r.date_utc || r.date_local || ''),

esc(r.type || ''),

esc(r.category || ''),

esc(r.description || r.memo || ''),

esc(r.amount != null ? r.amount : ''),

esc(r.currency || 'USD'),

esc(r.program || ''),

esc(r.source || ''),

esc(r.created_by || r.user || '')

].join(','));

}



return lines.join('\n');

}



if (ENV_PINS){

AUTH_MODE = 'multi';

const parts = ENV_PINS.split(/[,;\n\r]+/).map(s=>s.trim()).filter(Boolean);

for (const p of parts){

const i = p.indexOf(':'); // ASCII colon

if (i>0){

const pin = p.slice(0,i).trim();

const program = p.slice(i+1).trim();

if(pin){

const hash = sha256(pin);

PIN_MAP.push({pin, program, hash});

HASH_TO_PROGRAM.set(hash, program);

}

}

}

if (!PIN_MAP.length) AUTH_MODE = 'none';

}else if (SINGLE_PIN){

AUTH_MODE = 'single';

SINGLE_HASH = sha256(SINGLE_PIN);

}



function getAuth(req){

if (AUTH_MODE === 'none') return {ok:true, programScope:null};

const token = String(req.headers['x-auth'] || '').trim();

if (!token) return {ok:false, programScope:null};

if (AUTH_MODE === 'single') return {ok: token===SINGLE_HASH, programScope:null};

if (HASH_TO_PROGRAM.has(token)) return {ok:true, programScope: HASH_TO_PROGRAM.get(token)};

return {ok:false, programScope:null};

}



// ---- storage (self-healing) ----

function ensureStore(){

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});

if (!fs.existsSync(LEDGER_FN)){

fs.writeFileSync(LEDGER_FN, JSON.stringify({entries:[]}, null, 2));

}

}

function readDB(){

ensureStore();

try{

const raw = fs.readFileSync(LEDGER_FN, 'utf8');

const data = raw?.trim() ? JSON.parse(raw) : {};

if (!data || typeof data !== 'object') return {entries:[]};

if (!Array.isArray(data.entries)) data.entries = [];

return data;

}catch(e){

console.error('[readDB] repair ledger.json:', e.message);

const fresh = {entries:[]};

try{ fs.writeFileSync(LEDGER_FN, JSON.stringify(fresh,null,2)); }catch(_){}

return fresh;

}

}

function writeDB(db){

if (!db || typeof db !== 'object') db = {entries:[]};

if (!Array.isArray(db.entries)) db.entries = [];

fs.writeFileSync(LEDGER_FN, JSON.stringify(db, null, 2));

}



// ---- utils ----

function send(res, code, headers, body){ res.writeHead(code, headers); res.end(body); }

function text(res, code, s){ send(res, code, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}, String(s)); }

function json(res, code, obj){ send(res, code, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}, JSON.stringify(obj)); }

function uuid(){ return crypto.randomUUID ? crypto.randomUUID() : (Date.now().toString(36)+Math.random().toString(36).slice(2)); }

function toNumber(x){ const n = Number(x); return isFinite(n) ? n : NaN; }

function todayISO(){ return new Date().toISOString().slice(0,10); }

function clampISODate(s){ return (/^\d{4}-\d{2}-\d{2}$/.test(String(s||''))) ? s : todayISO(); }

function csvEsc(s){ s=(s==null?'':String(s)); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; }



function applyFilters(rows, q, programScope){

let r = rows;

const from = q.get('from'), to = q.get('to');

const team = (q.get('team')||'').trim();

const league = (q.get('league')||'').trim();

let program = (q.get('program')||'').trim();



if (programScope){ program = programScope; } // force scope if present



if (team) r = r.filter(e => (e.team||'')===team);

if (league) r = r.filter(e => (e.league||'')===league);

if (program) r = r.filter(e => (e.program||'')===program);



if (from || to){

const fromT = from ? new Date(from).getTime() : -Infinity;

const toT = to ? new Date(to).getTime()+86400000-1 : +Infinity;

r = r.filter(e=>{

const t = new Date(e.date||todayISO()).getTime();

return isFinite(t) && t>=fromT && t<=toT;

});

}

return r;

}



// ---- API ----

async function sessionInfo(req, res){

const a = getAuth(req);

const authRequired = AUTH_MODE !== 'none';

const mode = AUTH_MODE;

return json(res,200,{ok:true, authRequired, mode, programScope: a.ok ? a.programScope : null});

}



async function login(req, res){

if (AUTH_MODE === 'none') return json(res,200,{ok:true, token:null, program:null, mode:'none'});

const body = await new Promise(resolve=>{

let b=''; req.on('data',c=>{ b+=c; if (b.length>1e6) req.destroy(); });

req.on('end', ()=>{ try{ resolve(JSON.parse(b||'{}')); }catch{ resolve({}); } });

});

const pin = String(body.pin||'').trim();

if (!pin) return json(res,400,{ok:false,error:'pin required'});



if (AUTH_MODE === 'single'){

const token = sha256(pin);

if (token !== SINGLE_HASH) return json(res,403,{ok:false,error:'invalid pin'});

return json(res,200,{ok:true, token, program:null, mode:'single'});

}

const token = sha256(pin);

const program = HASH_TO_PROGRAM.get(token);

if (!program) return json(res,403,{ok:false,error:'invalid pin'});

return json(res,200,{ok:true, token, program, mode:'multi'});

}



async function parseBody(req){

return new Promise(resolve=>{

let b=''; req.on('data',c=>{ b+=c; if (b.length>1e6) req.destroy(); });

req.on('end', ()=>{

const ct = String(req.headers['content-type']||'').toLowerCase();

if (b && ct.includes('application/json')){

try{ return resolve(JSON.parse(b)); }catch(e){ return resolve({__parseError:'invalid JSON: '+e.message}); }

}

if (b && ct.includes('application/x-www-form-urlencoded')){

const out={};

b.split('&').forEach(kv=>{

const [k,v=''] = kv.split('=');

out[decodeURIComponent(k||'')] = decodeURIComponent(v.replace(/\+/g,' ')||'');

});

return resolve(out);

}

try{ return resolve(b?JSON.parse(b):{}); }catch{ return resolve({}); }

});

});

}



async function handleAdd(req, res){

const a = getAuth(req);

if (!a.ok) return json(res,401,{ok:false,error:'auth required'});

try{

const body = await parseBody(req);

if (body.__parseError) return json(res,400,{ok:false,error:body.__parseError});



const type = String(body.type||'').toLowerCase();

if (!['income','expense'].includes(type)) return json(res,400,{ok:false,error:'type must be income|expense'});



const amount = toNumber(body.amount);

if (isNaN(amount) || amount <= 0) return json(res,400,{ok:false,error:'amount must be a positive number'});



const program = a.programScope ? a.programScope : (body.program||'').trim();



const entry = {

id: uuid(),

type,

amount: Number(Number(amount).toFixed(2)),

category: (body.category||'').trim() || '(uncategorized)',

note: (body.note||'').trim(),

date: clampISODate(body.date),

team: (body.team||'').trim(),

league: (body.league||'').trim(),

program,

createdAt: Date.now(),

updatedAt: Date.now()

};



const db = readDB();

db.entries.unshift(entry);

writeDB(db);

return json(res,200,{ok:true, entry});

}catch(e){

console.error('add error', e);

return json(res,500,{ok:false,error:'server add error: '+(e.message||e)});

}

}



function meta(req, res){

const a = getAuth(req);

if (!a.ok) return json(res,401,{ok:false,error:'auth required'});

try{

const db = readDB();

let rows = [...(db.entries||[])];

if (a.programScope){ rows = rows.filter(e => (e.program||'')===a.programScope); }



const teams = new Set(), leagues = new Set(), cats = new Set(), progs = new Set();

for (const e of rows){

if (e.team) teams.add(e.team);

if (e.league) leagues.add(e.league);

if (e.category) cats.add(e.category);

if (e.program) progs.add(e.program);

}

return json(res,200,{ok:true,

teams:[...teams].sort((x,y)=>x.localeCompare(y)),

leagues:[...leagues].sort((x,y)=>x.localeCompare(y)),

categories:[...cats].sort((x,y)=>x.localeCompare(y)),

programs:[...progs].sort((x,y)=>x.localeCompare(y)),

scope: a.programScope || null

});

}catch(e){

return json(res,500,{ok:false,error:'server meta error: '+(e.message||e)});

}

}



function listEntries(req, res, u){

const a = getAuth(req);

if (!a.ok) return json(res,401,{ok:false,error:'auth required'});

try{

const db = readDB();

let out = [...(db.entries||[])];

out = applyFilters(out, u.searchParams, a.programScope);

out.sort((a,b)=>{

const d = String(b.date||'').localeCompare(String(a.date||''));

return d || ((b.createdAt||0) - (a.createdAt||0));

});

return json(res,200,{ok:true, entries: out});

}catch(e){

return json(res,500,{ok:false,error:'server list error: '+(e.message||e)});

}

}



function summarize(req, res, u){

const a = getAuth(req);

if (!a.ok) return json(res,401,{ok:false,error:'auth required'});

try{

const days = Math.max(1, Math.min(365, Number(u.searchParams.get('range') || 30)));

const cutoff = Date.now() - days*24*60*60*1000;

const db = readDB();

let within = (db.entries||[]).filter(e=>{

const t = new Date(e.date||todayISO()).getTime();

return isFinite(t) && t >= cutoff;

});

if (a.programScope) within = within.filter(e => (e.program||'')===a.programScope);



let income=0, expense=0;

const byCat = {}, byTL = {}, byProgram = {};

for (const e of within){

if (e.type==='income') income += e.amount; else expense += e.amount;



const k = e.category||'(uncategorized)';

byCat[k] = byCat[k] || {income:0,expense:0}; byCat[k][e.type]+=e.amount;



const tl = (e.team||'-')+' | '+(e.league||'-');

byTL[tl] = byTL[tl] || {income:0,expense:0}; byTL[tl][e.type]+=e.amount;



const prog = e.program||'(no program)';

byProgram[prog] = byProgram[prog] || {income:0,expense:0}; byProgram[prog][e.type]+=e.amount;

}

const net = Number((income - expense).toFixed(2));

return json(res,200,{

ok:true,

rangeDays:days,

totals:{income:+income.toFixed(2), expense:+expense.toFixed(2), net},

byCategory:byCat,

byTeamLeague:byTL,

byProgram,

count:within.length

});

}catch(e){

return json(res,500,{ok:false,error:'server summary error: '+(e.message||e)});

}

}



function exportCSV(req, res, u){

const a = getAuth(req);

if (!a.ok) return text(res,401,'auth required');

try{

const db = readDB();

let rows = [...(db.entries||[])];



// Apply filters from query string + program scope

rows = applyFilters(rows, u.searchParams, a.programScope);



// Build CSV

const out = [

['id','date','type','amount','category','note','team','league','program','createdAt','updatedAt'].map(csvEsc).join(',')

];

for (const e of rows){

out.push([

e.id, e.date, e.type, String(e.amount),

e.category||'', e.note||'',

e.team||'', e.league||'', e.program||'',

String(e.createdAt||''), String(e.updatedAt||'')

].map(csvEsc).join(','));

}

const csv = out.join('\n');



// 🚀 Important: add BOM so Excel recognizes UTF-8

send(res,200,{

'Content-Type':'text/csv; charset=utf-8',

'Content-Disposition':'attachment; filename="hey-bori-cashflow.csv"',

'Cache-Control':'no-store'

}, '\uFEFF' + csv);



}catch(e){

return text(res,500,'CSV error: '+(e.message||e));

}

}



// ---- UI ----

function uiHTML(){

return `<!doctype html>

<html lang="en"> data-lang=ën">

<head>

<meta charset="utf-8"/>

<meta name="viewport" content="width=device-width, initial-scale=1"/>

<title>Cash Flow Hoops</title>

<style>

:root{

--bg:#0e1116; --card:#151a22; --line:#1f2733; --text:#e8edf4; --muted:#a7b1c2;

--accent:#2dd4bf; --accent2:#60a5fa; --danger:#f87171;

}
[data-lang="en"] .lang-es { display: none; }
[data-lang="es"] .lang-en { display: none; }

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

</style>

</head>

<body>

<header>

<h1>

Cash Flow Hoops

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

<!-- ENGLISH -->
<div class="lang-en">
<h3>How to use Hoops Ledger</h3>

<p><b>What is this?</b> Hoops Ledger helps your program track income and expenses for teams, leagues, and tournaments — fast, simple, and private.</p>

<ol>
<li><b>Sign In:</b> Enter your coach/program PIN and click <i>Sign In</i>. You'll see your program name when unlocked.</li>
<li><b>Add an Entry:</b> Select <i>Type</i>, enter <i>Amount</i>, choose a <i>Category</i>, set the <i>Date</i>, and add optional <i>Team</i>, <i>League</i>, or <i>Note</i>. Click <i>Add Entry</i>.</li>
<li><b>View the Ledger:</b> Scroll the table to view all entries for your program.</li>
<li><b>Summaries:</b> Review totals by Category, Team | League, and Program for the selected time range.</li>
<li><b>Export CSV:</b> Use <i>Download CSV</i> to export data for spreadsheets or sponsor reports.</li>
</ol>

<p><b>Tips</b></p>
<ul>
<li>Each program only sees its own data (private by design).</li>
<li>Use consistent categories for cleaner summaries.</li>
<li>You can adjust the date range anytime.</li>
</ul>

<div id="helpFooter">
Need more help? Email us at
<a href="mailto:FiatPalante@gmail.com" style="color:#9fc1ff;text-decoration:underline;">FiatPalante@gmail.com</a>
— Hooporia Institute Inc.
</div>
</div>

<!-- SPANISH PR -->
<div class="lang-es" style="display:none">
<h3>Cómo usar Hoops Ledger</h3>

<p><b>¿Qué es esto?</b> Hoops Ledger ayuda a tu programa a llevar el control de ingresos y gastos por equipos, ligas y torneos — rápido, simple y privado.</p>

<ol>
<li><b>Iniciar Sesión:</b> Entra tu PIN de coach/programa y presiona <i>Sign In</i>. Verás el nombre de tu programa cuando esté desbloqueado.</li>
<li><b>Añadir Transacción:</b> Selecciona el <i>Tipo</i>, escribe el <i>Monto</i>, escoge la <i>Categoría</i>, pon la <i>Fecha</i>, y añade <i>Equipo</i>, <i>Liga</i> o <i>Nota</i> si es necesario. Luego presiona <i>Add Entry</i>.</li>
<li><b>Ver el Registro:</b> Revisa la tabla para ver todas las transacciones de tu programa.</li>
<li><b>Resúmenes:</b> Observa totales por Categoría, Equipo | Liga y Programa para el rango seleccionado.</li>
<li><b>Exportar CSV:</b> Usa <i>Download CSV</i> para exportar datos para hojas de cálculo o informes a auspiciadores.</li>
</ol>

<p><b>Consejos</b></p>
<ul>
<li>Cada programa solo ve su propia información (privado por diseño).</li>
<li>Usa categorías consistentes para mejores reportes.</li>
<li>Puedes ajustar el rango de fechas en cualquier momento.</li>
</ul>

<div id="helpFooter">
¿Necesitas ayuda adicional? Escríbenos a
<a href="mailto:FiatPalante@gmail.com" style="color:#9fc1ff;text-decoration:underline;">FiatPalante@gmail.com</a>
— Hooporia Institute Inc.
</div>
</div>

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

// iOS opens the file; user taps "Save to Files"

window.location.href = url;

setTimeout(() => URL.revokeObjectURL(url), 4000);

} else {

const a = document.createElement('a');

a.href = url;

a.download = filename;

document.body.appendChild(a);

a.click();

a.remove();

setTimeout(() => URL.revokeObjectURL(url), 1000);

}

}



async function secureCsvDownload(url, filename = 'hey-bori-cashflow.csv') {

try {

const r = await fetchAuthed(url, { method: 'GET', cache: 'no-store' });

if (!r.ok) return; // stay silent per your preference

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



// Use the secure API route you already have

const url = '/api/ledger/export.csv' + (qs.toString() ? ('?' + qs.toString()) : '');



const a = $('#csvLink');

if (!a) return;



// Store the real URL, but prevent default navigation (no headers)

a.dataset.href = url;

a.href = '#';



// Attach click once to use fetchAuthed (adds X-Auth) then download

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

if (!SESSION.authRequired){ show($('#loginCard'), false); showApp(true); init(); return; }

if (TOKEN && (SESSION.programScope !== null || SESSION.mode==='single')){

show($('#loginCard'), false); showApp(true); init(); return;

}

$('#modeInfo').textContent = 'Mode: '+SESSION.mode+' — PINs required';

show($('#loginCard'), true); showApp(false);

}catch(e){

show($('#loginCard'), false); showApp(true); init();

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

show($('#loginCard'), false); showApp(true); init();

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
// --- Language switch for Help modal and labels ---
(function(){
const root = document.documentElement;
const KEY = 'cfh_lang'; // Cash Flow Hoops language key

function setLang(lang){
if (lang !== 'en' && lang !== 'es') lang = 'en';
root.setAttribute('data-lang', lang);
try { localStorage.setItem(KEY, lang); } catch(_) {}
}

// Load saved language or default to EN
let saved = 'en';
try {
const v = localStorage.getItem(KEY);
if (v === 'es') saved = 'es';
} catch(_) {}
setLang(saved);

// OPTIONAL: if later you add EN/ES buttons in the header, you can hook them here:
// document.getElementById('btn-en')?.addEventListener('click', () => setLang('en'));
// document.getElementById('btn-es')?.addEventListener('click', () => setLang('es'));
})();

</script>

</body></html>`;

}



// ---- server ----

const server = http.createServer(async (req, res) => {

const url = new URL(req.url, `http://${req.headers.host}`);

  // PUBLIC smoke test route: should ALWAYS download without auth

if (req.method === 'GET' && url.pathname === '/__csv_test__.csv') {

res.statusCode = 200;

res.setHeader('Content-Type', 'text/csv; charset=utf-8');

res.setHeader('Content-Disposition', 'attachment; filename="test.csv"');

res.setHeader('Cache-Control', 'no-store');

res.write('\uFEFF');

res.end('hello,world\n1,2\n');

return;

}



// CSV export route — works for computer + all mobile, no messages

if (req.method === 'GET' && url.pathname === '/exports/transactions.csv') {

// TEMP: allow CSV without auth so export works everywhere

const user = userFromRequest(req); // may be null — that's fine



const program = user.program || null;

const csv = buildTransactionsCSVSync(program);



res.statusCode = 200;

res.setHeader('Content-Type', 'text/csv; charset=utf-8');

res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');

res.setHeader('Cache-Control', 'no-store');

res.write('\uFEFF'); // UTF-8 BOM so Excel opens properly

res.end(csv);

return;

}

  try{

const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));



// CORS

res.setHeader('Access-Control-Allow-Origin', '*');

res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Auth');

if (req.method === 'OPTIONS') return send(res,204,{},'');



if (req.method === 'GET' && u.pathname === '/health') return text(res,200,'OK');

if (req.method === 'GET' && u.pathname === '/') return send(res,200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}, uiHTML());



if (req.method === 'GET' && u.pathname === '/api/session') return sessionInfo(req,res);

if (req.method === 'POST' && u.pathname === '/api/login') return login(req,res);



if (req.method === 'GET' && u.pathname === '/api/ledger/meta') return meta(req,res);

if (req.method === 'POST' && u.pathname === '/api/ledger/add') return handleAdd(req,res);

if (req.method === 'GET' && u.pathname === '/api/ledger/list') return listEntries(req,res,u);

if (req.method === 'GET' && u.pathname === '/api/ledger/summary') return summarize(req,res,u);

if (req.method === 'GET' && u.pathname === '/api/ledger/export.csv') return exportCSV(req,res,u);



return text(res,404,'Not Found');

}catch(e){

console.error(e);

return text(res,500,'Server error');

}

});



server.listen(PORT, ()=>{

try{

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive:true});

ensureStore();

console.log('💵 Hey Bori Cash Flow — mode='+AUTH_MODE.toUpperCase()+

(AUTH_MODE==='multi' ? ` | programs=${PIN_MAP.length}` : '')+

' | PORT='+PORT+' | DATA_DIR='+DATA_DIR);

}catch(e){

console.error('Startup store error', e);

}

});

