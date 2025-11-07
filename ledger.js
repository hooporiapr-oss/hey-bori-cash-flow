// ledger.js — tiny JSON “database” with multi-scope support
// Stores each entry with arrays for leagues, teams, tournaments, plus optional fields.

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const FILE = path.join(DATA_DIR, 'ledger.json');

function ensureStorage() {
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ rows: [] }, null, 2));
}

function load() {
ensureStorage();
const raw = fs.readFileSync(FILE, 'utf8');
try { return JSON.parse(raw); } catch { return { rows: [] }; }
}

function save(db) { fs.writeFileSync(FILE, JSON.stringify(db, null, 2)); }

// Helpers
function toArr(v) {
if (Array.isArray(v)) return v.map(s => String(s || '').trim()).filter(Boolean);
if (v == null) return [];
// allow comma-separated strings
return String(v).split(',').map(s => s.trim()).filter(Boolean);
}
function anyMatch(hay = [], needles = []) {
if (!needles.length) return true; // no filter -> match all
const set = new Set(hay.map(s => s.toLowerCase()));
return needles.some(n => set.has(String(n).toLowerCase()));
}
function parseDateLike(d) {
if (!d) return new Date();
if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) return new Date(d + 'T12:00:00Z');
const x = new Date(d);
return isNaN(x.getTime()) ? new Date() : x;
}

// Core
function add({ type, amount, category, note, date, leagues, teams, tournaments, gender, season, program }) {
const db = load();
const entry = {
id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
type: (type === 'expense' ? 'expense' : 'income'),
amount: Number(amount || 0),
category: (category || '').trim(),
note: (note || '').trim(),
date: parseDateLike(date).toISOString(),
leagues: toArr(leagues),
teams: toArr(teams),
tournaments: toArr(tournaments),
gender: (gender || '').trim(), // e.g., Male, Female, Coed
season: (season || '').trim(), // e.g., 2024-2025
program: (program || '').trim() // e.g., “Bori Elite”
};
db.rows.push(entry);
save(db);
return entry;
}

function list(filters = {}) {
const { leagues = [], teams = [], tournaments = [], gender, season, program, days } = filters;
const fLeagues = toArr(leagues), fTeams = toArr(teams), fTourn = toArr(tournaments);
const db = load();
const cutoff = days ? (Date.now() - Number(days) * 24 * 3600 * 1000) : null;

const rows = (db.rows || []).filter(r => {
if (cutoff && new Date(r.date).getTime() < cutoff) return false;
if (!anyMatch(r.leagues, fLeagues)) return false;
if (!anyMatch(r.teams, fTeams)) return false;
if (!anyMatch(r.tournaments, fTourn)) return false;
if (gender && String(r.gender || '').toLowerCase() !== String(gender).toLowerCase()) return false;
if (season && String(r.season || '').toLowerCase() !== String(season).toLowerCase()) return false;
if (program && String(r.program || '').toLowerCase() !== String(program).toLowerCase()) return false;
return true;
});

return rows;
}

function summary(days = 30, filters = {}) {
const rows = list({ ...filters, days });
let income = 0, expense = 0;
for (const r of rows) {
if (r.type === 'income') income += Number(r.amount || 0);
else expense += Number(r.amount || 0);
}
return { days, income, expense, net: income - expense, count: rows.length };
}

function toCSV(filters = {}) {
const rows = list(filters);
const header = [
'id','date','type','category','amount','note',
'leagues','teams','tournaments','gender','season','program'
].join(',');
const body = rows.map(r => [
r.id,
r.date,
r.type,
JSON.stringify(r.category || ''),
Number(r.amount || 0),
JSON.stringify(r.note || ''),
JSON.stringify(r.leagues || []),
JSON.stringify(r.teams || []),
JSON.stringify(r.tournaments || []),
JSON.stringify(r.gender || ''),
JSON.stringify(r.season || ''),
JSON.stringify(r.program || '')
].join(',')).join('\n');
return header + '\n' + body + '\n';
}

module.exports = { add, list, summary, toCSV };
