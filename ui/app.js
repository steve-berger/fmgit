// fmgit web UI: GitHub / Forgejo style. No build step, no dependencies.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const q = o => new URLSearchParams(Object.entries(o).flatMap(([k, v]) =>
  Array.isArray(v) ? v.map(x => [k, x]) : v == null || v === '' ? [] : [[k, v]])).toString();
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// The token from the printed link authorizes this tab; keep it out of the address bar.
const token = (() => {
  const u = new URL(location.href);
  const t = u.searchParams.get('t');
  if (t) {
    sessionStorage.setItem('fmgit-token', t);
    history.replaceState(null, '', u.pathname + u.hash);
  }
  return sessionStorage.getItem('fmgit-token') || '';
})();

async function api(path, body) {
  const opts = { headers: { 'X-Fmgit-Token': token } };
  if (body !== undefined) {
    opts.method = 'POST';
    opts.body = JSON.stringify(body);
    opts.headers['Content-Type'] = 'application/json';
  }
  const r = await fetch('/api/' + path, opts);
  const text = await r.text();
  let j;
  try { j = JSON.parse(text); } catch { j = { error: text.trim() || r.statusText }; }
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

// ---------- icons (16px, stroke) ----------
const P = {
  repo: '<path d="M3 13V3a1.5 1.5 0 0 1 1.5-1.5H13v10H4.5A1.5 1.5 0 0 0 3 13a1.5 1.5 0 0 0 1.5 1.5H13"/>',
  branch: '<circle cx="5" cy="3.5" r="1.5"/><circle cx="5" cy="12.5" r="1.5"/><circle cx="11" cy="5" r="1.5"/><path d="M5 5v6M11 6.5c0 3-6 2-6 4.5"/>',
  commit: '<circle cx="8" cy="8" r="2.5"/><path d="M1 8h4.5M10.5 8H15"/>',
  pr: '<circle cx="4" cy="3.5" r="1.5"/><circle cx="4" cy="12.5" r="1.5"/><circle cx="12" cy="12.5" r="1.5"/><path d="M4 5v6M12 11V6.5a2 2 0 0 0-2-2H7.5M9 3 7.5 4.5 9 6"/>',
  merged: '<circle cx="4" cy="3.5" r="1.5"/><circle cx="4" cy="12.5" r="1.5"/><circle cx="12" cy="9" r="1.5"/><path d="M4 5v6M4 5c0 2.5 3 4 6.5 4"/>',
  prClosed: '<circle cx="4" cy="3.5" r="1.5"/><circle cx="4" cy="12.5" r="1.5"/><circle cx="12" cy="12.5" r="1.5"/><path d="M4 5v6M10 3l4 4M14 3l-4 4M12 9v2"/>',
  check: '<path d="M3 8.5l3 3 7-7"/>',
  x: '<path d="M4 4l8 8M12 4l-8 8"/>',
  dot: '<circle class="f" cx="8" cy="8" r="4"/>',
  file: '<path d="M4 1.5h5L12.5 5v9.5h-8.5zM9 1.5V5h3.5"/>',
  diff: '<path d="M4 1.5h5L12.5 5v9.5h-8.5zM8.25 5.5v4M6.25 7.5h4M6.25 12h4"/>',
  folder: '<path d="M1.5 3.5h4.5l1.5 1.5h7v8h-13z"/>',
  chev: '<path d="M6 4l4 4-4 4"/>',
  chevDown: '<path d="M4 6l4 4 4-4"/>',
  search: '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5l4 4"/>',
  history: '<path d="M2 8a6 6 0 1 0 1.8-4.3M2 2v3h3M8 4.5V8l2.5 1.5"/>',
  gear: '<circle cx="8" cy="8" r="2.2"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4"/>',
  sync: '<path d="M13 8a5 5 0 0 1-9 3M3 8a5 5 0 0 1 9-3M12 2v3H9M4 14v-3h3"/>',
  push: '<path d="M8 11V2.5M4.5 6 8 2.5 11.5 6M2.5 13.5h11"/>',
  pull: '<path d="M8 2.5V11M4.5 7.5 8 11l3.5-3.5M2.5 13.5h11"/>',
  comment: '<path d="M2 3h12v8H6.5L3.5 13.5V11H2z"/>',
  eye: '<path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>',
  shield: '<path d="M8 1.5l5.5 2v4c0 3.5-2.5 6-5.5 7-3-1-5.5-3.5-5.5-7v-4z"/>',
  alert: '<path d="M8 2l6.5 11.5h-13zM8 6.5v3M8 11.5v.5"/>',
  info: '<circle cx="8" cy="8" r="6.5"/><path d="M8 7v4M8 4.75v.5"/>',
  ext: '<path d="M9 2.5h4.5V7M13.5 2.5 7 9M11.5 9v4.5h-9v-9H7"/>',
  key: '<circle cx="5" cy="11" r="3"/><path d="M7 9l6.5-6.5M11 5l2 2"/>',
  tools: '<path d="M2.5 13.5l6-6M10 2.5a3 3 0 0 0 3.5 3.5L10 9.5 6.5 6z"/>',
  sun: '<circle cx="8" cy="8" r="3"/><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M3 3l1 1M12 12l1 1M3 13l1-1M12 4l1-1"/>',
  moon: '<path d="M13.5 9.5A6 6 0 0 1 6.5 2.5a6 6 0 1 0 7 7z"/>',
  play: '<path d="M4.5 2.5v11l9-5.5z"/>',
  package: '<path d="M8 1.5 14 4.5v7L8 14.5 2 11.5v-7zM2 4.5l6 3 6-3M8 7.5v7"/>',
  plus: '<path d="M8 3v10M3 8h10"/>',
  dash: '<path d="M3 8h10"/>',
};
const ic = (n, cls = '') => `<svg class="oc ${cls}" viewBox="0 0 16 16" aria-hidden="true">${P[n] || ''}</svg>`;

function toast(msg, bad = false) {
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.innerHTML = ic(bad ? 'alert' : 'check', bad ? 'danger' : 'success') + `<span>${esc(msg)}</span>`;
  $('#toasts').append(t);
  setTimeout(() => t.remove(), bad ? 8000 : 3500);
}

function ago(d) {
  if (!d) return '';
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 45) return 'just now';
  for (const [n, u] of [[31536000, 'year'], [2592000, 'month'], [86400, 'day'], [3600, 'hour'], [60, 'minute']])
    if (s >= n) return plural(Math.floor(s / n), u) + ' ago';
  return 'just now';
}
const when = d => d ? `<time datetime="${esc(d)}" title="${esc(new Date(d).toLocaleString())}">${ago(d)}</time>` : '';
function avatar(name, cls = '') {
  let h = 0;
  for (const c of String(name)) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `<span class="avatar ${cls}" style="background:hsl(${h} 45% 45%)" title="${esc(name)}">${esc(String(name || '?')[0])}</span>`;
}
const statIcon = s => s === '+' ? ic('plus', 'stat-add') : s === '-' ? ic('dash', 'stat-del') : ic('dot', 'stat-mod');
const statLabel = s => s === '+' ? '<span class="Label Label--success">Added</span>' : s === '-' ? '<span class="Label Label--danger">Removed</span>' : '<span class="Label Label--attention">Changed</span>';
const blank = (icon, title, text, actions = '') => `<div class="blankslate">${ic(icon)}<h3>${title}</h3><p>${text}</p>${actions}</div>`;
const flash = (kind, icon, html, action = '') => `<div class="flash flash-${kind}">${ic(icon)}<div>${html}</div>${action ? `<div class="flash-action">${action}</div>` : ''}</div>`;

// ---------- syntax highlighting ----------
const TOK = /("(?:[^"\\]|\\.)*")|(\$\$?[\p{L}\p{N}_.~]+)|([\p{L}_][\p{L}\p{N}_ ]*::[\p{L}\p{N}_ ]*[\p{L}\p{N}_])|(\b\d+(?:\.\d+)?\b)|([\p{L}_][\p{L}\p{N}_.]*)(?=\s*\()|(\/\/.*$)/gmu;
function hlCalc(s) {
  let out = '', last = 0;
  for (const m of s.matchAll(TOK)) {
    out += esc(s.slice(last, m.index));
    const cls = m[1] ? 'hl-str' : m[2] ? 'hl-var' : m[3] ? 'hl-fld' : m[4] ? 'hl-num' : m[5] ? 'hl-fn' : 'hl-cmt';
    out += `<span class="${cls}">${esc(m[0])}</span>`;
    last = m.index + m[0].length;
  }
  return out + esc(s.slice(last));
}
const KW = new Set(['If', 'Else If', 'Else', 'End If', 'Loop', 'Exit Loop If', 'End Loop', 'Exit Script', 'Halt Script',
  'Perform Script', 'Perform Script on Server', 'Open Transaction', 'Commit Transaction', 'Revert Transaction']);
function hlScript(line) {
  const ind = line.match(/^\s*/)[0];
  const t = line.slice(ind.length);
  if (!ind && t.startsWith('Script: ')) return `<span class="hl-head">${esc(t)}</span>`;
  if (ind.length % 4) return esc(ind) + hlCalc(t); // continuation of a multi-line parameter
  if (t.startsWith('//')) return esc(ind) + `<span class="hl-off">${esc(t)}</span>`;
  if (t.startsWith('#')) return esc(ind) + `<span class="hl-cmt">${esc(t)}</span>`;
  const i = t.indexOf(' [ ');
  const name = i < 0 ? t : t.slice(0, i);
  return esc(ind) + `<span class="${KW.has(name) ? 'hl-kw' : 'hl-step'}">${esc(name)}</span>` + (i < 0 ? '' : hlCalc(t.slice(i)));
}
const hlXML = s => esc(s)
  .replace(/(&lt;\/?)([\w:.-]+)/g, '$1<span class="hl-tag">$2</span>')
  .replace(/([\w:-]+)=&quot;(.*?)&quot;/g, '<span class="hl-attr">$1</span>=<span class="hl-val">&quot;$2&quot;</span>');
const hl = (s, mode) => mode === 'script' ? hlScript(s) : mode === 'calc' ? hlCalc(s) : mode === 'xml' ? hlXML(s) : esc(s);
const modeFor = path => /StepsForScripts\//.test(path) ? 'script' : 'xml';

function blob(text, mode) {
  const lines = String(text ?? '').replace(/\n$/, '').split('\n');
  const max = 6000;
  const rows = lines.slice(0, max).map((l, i) => `<tr><td class="num">${i + 1}</td><td>${hl(l, mode)}</td></tr>`).join('');
  const more = lines.length > max ? `<tr><td class="num"></td><td class="muted">… ${lines.length - max} more lines</td></tr>` : '';
  return `<div class="blob-wrap"><table class="blob">${rows}${more}</table></div>`;
}

// ---------- diffs ----------
function parseDiff(text) {
  const hunks = [];
  let h = null, o = 0, n = 0;
  for (const l of text.split('\n')) {
    const m = l.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
    if (m) { h = { head: l, rows: [] }; hunks.push(h); o = +m[1]; n = +m[2]; continue; }
    if (!h) continue;
    if (l[0] === '+') h.rows.push({ t: 'add', n: n++, s: l.slice(1) });
    else if (l[0] === '-') h.rows.push({ t: 'del', o: o++, s: l.slice(1) });
    else if (l[0] === ' ') h.rows.push({ t: 'ctx', o: o++, n: n++, s: l.slice(1) });
  }
  return hunks;
}

function unified(hunks, mode) {
  let r = '';
  for (const h of hunks) {
    r += `<tr class="hunk"><td class="num"></td><td class="num"></td><td colspan="2">${esc(h.head)}</td></tr>`;
    for (const x of h.rows)
      r += `<tr class="${x.t === 'ctx' ? '' : x.t}"><td class="num">${x.o ?? ''}</td><td class="num">${x.n ?? ''}</td><td class="mk">${x.t === 'add' ? '+' : x.t === 'del' ? '-' : ' '}</td><td>${hl(x.s, mode)}</td></tr>`;
  }
  return `<table class="diff-table">${r}</table>`;
}

function split(hunks, mode) {
  let r = '';
  const cell = (x, side) => x
    ? `<td class="num ${side}">${side === 'del' ? x.o : x.n}</td><td class="c ${side}">${hl(x.s, mode)}</td>`
    : '<td class="num empty"></td><td class="c empty"></td>';
  for (const h of hunks) {
    r += `<tr class="hunk"><td class="num"></td><td colspan="3">${esc(h.head)}</td></tr>`;
    let dels = [], adds = [];
    const flush = () => {
      for (let i = 0; i < Math.max(dels.length, adds.length); i++) r += `<tr>${cell(dels[i], 'del')}${cell(adds[i], 'add')}</tr>`;
      dels = []; adds = [];
    };
    for (const x of h.rows) {
      if (x.t === 'del') { if (adds.length) flush(); dels.push(x); }
      else if (x.t === 'add') adds.push(x);
      else { flush(); r += `<tr><td class="num">${x.o}</td><td class="c">${hl(x.s, mode)}</td><td class="num">${x.n}</td><td class="c">${hl(x.s, mode)}</td></tr>`; }
    }
    flush();
  }
  return `<table class="diff-table split">${r}</table>`;
}

const diffMode = () => localStorage.getItem('fmgit-diff') || 'unified';
function diffToggle() {
  const m = diffMode();
  return `<div class="BtnGroup" role="group" aria-label="Diff view"><button class="btn btn-sm ${m === 'unified' ? 'selected' : ''}" data-diffmode="unified">Unified</button><button class="btn btn-sm ${m === 'split' ? 'selected' : ''}" data-diffmode="split">Split</button></div>`;
}

// stackedDiffs renders GitHub's "Files changed": one collapsible box per object, diffs loaded lazily.
function stackedDiffs(el, changes, range = []) {
  el.innerHTML = changes.map((c, i) => `
    <div class="Box file" id="f-${i}" data-path="${esc(c.path)}">
      <div class="file-header">
        <button class="chev-btn" data-collapse aria-label="Collapse">${ic('chevDown')}</button>
        ${statIcon(c.status)}
        <strong class="ellipsis">${esc(c.name)}</strong>
        <span class="type-tag" style="margin-left:0">${esc(c.type)}</span>
        <span class="path ellipsis grow">${esc(c.path)}</span>
        <a class="btn btn-sm" href="#/objects?${q({ path: c.path })}" title="View object">${ic('eye')}</a>
      </div>
      <div class="file-body"><div class="blankslate" style="padding:16px"><span class="muted">${i < 25 ? 'Loading diff…' : ''}</span>${i >= 25 ? '<button class="btn btn-sm" data-load>Load diff</button>' : ''}</div></div>
    </div>`).join('');
  const load = async (box, c) => {
    const body = $('.file-body', box);
    try {
      const d = await api('diff?' + q({ range, path: c.path }));
      const hunks = parseDiff(d.diff);
      box._hunks = hunks;
      paintDiff(box);
      if (!hunks.length) body.innerHTML = '<div class="blankslate" style="padding:16px"><span class="muted">Renamed or whitespace only.</span></div>';
    } catch (e) { body.innerHTML = `<div class="Box-body danger">${esc(e.message)}</div>`; }
  };
  changes.forEach((c, i) => {
    const box = $(`#f-${i}`, el);
    $('[data-collapse]', box).onclick = () => box.classList.toggle('collapsed');
    const lb = $('[data-load]', box);
    if (lb) lb.onclick = () => load(box, c);
    else load(box, c);
  });
}
function paintDiff(box) {
  if (!box._hunks?.length) return;
  const mode = modeFor(box.dataset.path);
  const rows = box._hunks.reduce((n, h) => n + h.rows.length, 0);
  $('.file-body', box).innerHTML = rows > 8000
    ? `<div class="Box-body">Large diff (${rows} lines). <button class="btn-link" data-force>Show anyway</button></div>`
    : diffMode() === 'split' ? split(box._hunks, mode) : unified(box._hunks, mode);
  const f = $('[data-force]', box);
  if (f) f.onclick = () => { $('.file-body', box).innerHTML = unified(box._hunks, mode); };
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-diffmode]');
  if (!b) return;
  localStorage.setItem('fmgit-diff', b.dataset.diffmode);
  $$('[data-diffmode]').forEach(x => x.classList.toggle('selected', x.dataset.diffmode === b.dataset.diffmode));
  $$('.file').forEach(paintDiff);
});

// ---------- output console & commands ----------
const con = { el: $('#console'), out: $('#con-out'), state: $('#con-state') };
function openConsole(open = true) {
  con.el.classList.toggle('open', open);
  $('#con-toggle').setAttribute('aria-expanded', String(open));
}
$('#con-toggle').onclick = () => openConsole(!con.el.classList.contains('open'));
$('#con-clear').onclick = () => { con.out.textContent = ''; con.state.textContent = ''; };

let running = false;
async function run(cmd, args = []) {
  if (running) { toast('Another command is still running', true); return -1; }
  running = true;
  $$('[data-run]').forEach(b => b.disabled = true);
  openConsole(true);
  con.state.innerHTML = `<span class="spinner"></span> Running ${esc(cmd)}…`;
  const block = document.createElement('span');
  con.out.append(block);
  let buf = '', code = -1;
  const show = () => {
    const i = buf.lastIndexOf('\x00');
    const text = i >= 0 ? buf.slice(0, i) : buf;
    const [first, ...rest] = text.split('\n');
    block.innerHTML = `<span class="cmd">${esc(first)}</span>\n${esc(rest.join('\n'))}`;
    con.out.scrollTop = con.out.scrollHeight;
    return text;
  };
  try {
    const r = await fetch('/api/run', { method: 'POST', headers: { 'X-Fmgit-Token': token, 'Content-Type': 'application/json' }, body: JSON.stringify({ cmd, args }) });
    if (!r.ok) throw new Error((await r.text()).trim());
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      show();
    }
    const i = buf.lastIndexOf('\x00');
    if (i >= 0) code = parseInt(buf.slice(i + 1), 10);
  } catch (e) { buf += `\n${e.message}`; }
  const text = show();
  block.insertAdjacentHTML('beforeend', `<span class="${code === 0 ? 'exit-ok' : 'exit-bad'}">${code === 0 ? '✓ Done' : '✗ Failed (exit ' + code + ')'}</span>\n\n`);
  con.out.scrollTop = con.out.scrollHeight;
  con.state.innerHTML = code === 0 ? `<span class="ok">${ic('check')}</span> ${esc(cmd)} finished` : `<span class="bad">${ic('x')}</span> ${esc(cmd)} failed`;
  if (code !== 0) toast((text.split('\n').map(l => l.trim()).filter(Boolean).pop() || 'Command failed').replace(/^fmgit: /, ''), true);
  else setTimeout(() => { if (!running) openConsole(false); }, 2500);
  running = false;
  $$('[data-run]').forEach(b => b.disabled = false);
  await refresh();
  return code;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-run]');
  if (!b || b.disabled) return;
  e.preventDefault();
  if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
  run(b.dataset.run, b.dataset.args ? JSON.parse(b.dataset.args) : []);
});
const runBtn = (cmd, label, { args, cls = '', icon, confirm: c } = {}) =>
  `<button class="btn ${cls}" data-run="${cmd}"${args ? ` data-args='${esc(JSON.stringify(args))}'` : ''}${c ? ` data-confirm="${esc(c)}"` : ''}>${icon ? ic(icon) : ''}${label}</button>`;

// ---------- status, header, shared bars ----------
const S = { status: null, prs: null };
const forgeName = () => ({ github: 'GitHub', forgejo: 'Forgejo' }[S.status?.forge] || 'your git host');

async function refreshStatus() {
  try { S.status = await api('status'); } catch (e) { toast(e.message, true); return; }
  renderHeader();
}
async function refreshPRs() {
  if (!S.status?.forgeReady) { S.prs = null; renderHeader(); return; }
  try { S.prs = await api('prs?state=open'); } catch { S.prs = null; }
  renderHeader();
}
const myPR = () => S.prs?.find(p => p.headRefName === S.status?.branch);

const TABS = { changes: ['diff', 'Changes'], objects: ['file', 'Objects'], history: ['history', 'History'], branches: ['branch', 'Branches'], prs: ['pr', 'Pull requests'], settings: ['gear', 'Settings'] };
function renderHeader() {
  const s = S.status;
  if (!s) return;
  $('#owner').textContent = s.owner || '';
  $('#owner-sep').hidden = !s.owner;
  $('#reponame').textContent = s.repo;
  document.title = `${s.repo} · fmgit`;
  const fl = $('#forge-link');
  fl.hidden = !s.webURL || !/^https?:\/\//.test(s.webURL);
  if (!fl.hidden) { fl.href = s.webURL; fl.innerHTML = `${ic('ext')} View on ${esc(forgeName())}`; }
  const counts = { changes: s.dirty || '', prs: S.prs?.length || '' };
  $$('#nav a').forEach(a => {
    const [icon, label] = TABS[a.dataset.tab];
    a.innerHTML = `${ic(icon)}<span class="lbl">${label}</span><span class="Counter">${counts[a.dataset.tab] ?? ''}</span>`;
  });
  markTab();
}
function markTab() {
  const n = route().name;
  const tab = { commit: 'history', pr: 'prs' }[n] || n;
  $$('#nav a').forEach(a => { a.classList.toggle('selected', a.dataset.tab === tab); a.toggleAttribute('aria-current', a.dataset.tab === tab); });
}

// The GitHub-style toolbar: branch picker on the left, sync actions on the right.
function toolbar(extra = '') {
  const s = S.status;
  return `<div class="repo-toolbar">
    <details class="dropdown" id="branchpicker">
      <summary class="btn">${ic('branch')}<strong>${esc(s.branch || '(detached)')}</strong>${ic('chevDown')}</summary>
      <div class="dropdown-menu"><div class="dm-head">Switch branches</div>
        <div class="dm-filter"><input class="form-control" placeholder="Find or create a branch…" aria-label="Find or create a branch"></div>
        <div class="dm-list"><div class="muted small" style="padding:8px">Loading…</div></div></div>
    </details>
    <a class="btn btn-sm" href="#/branches" style="border:0;background:none;box-shadow:none">${ic('branch')}<span class="muted">Branches</span></a>
    ${extra}
    <div class="right">
      ${runBtn('fetch', 'Fetch', { icon: 'sync', cls: 'btn-sm' })}
      ${runBtn('pull', 'Pull', { icon: 'pull', cls: 'btn-sm' })}
      ${runBtn('push', 'Push', { icon: 'push', cls: 'btn-sm' })}
    </div>
  </div>`;
}
function bindToolbar(el) {
  const d = $('#branchpicker', el);
  if (!d) return;
  d.addEventListener('toggle', async () => {
    if (!d.open) return;
    const input = $('input', d);
    input.focus();
    const bs = await api('branches');
    const paint = () => {
      const f = input.value.trim();
      const list = bs.filter(b => b.name.toLowerCase().includes(f.toLowerCase()));
      const exact = bs.some(b => b.name === f);
      $('.dm-list', d).innerHTML = list.map(b => `<button class="dm-item" data-switch="${esc(b.name)}"><span class="check">${b.current ? ic('check') : ''}</span><span class="ellipsis grow">${esc(b.name)}</span>${b.main ? '<span class="Label">default</span>' : ''}</button>`).join('')
        + (f && !exact ? `<button class="dm-item" data-create="${esc(f)}"><span class="check">${ic('branch')}</span><span>Create branch <strong>${esc(f)}</strong> from ${esc(S.status.main)}</span></button>` : '')
        || '<div class="muted small" style="padding:8px">Nothing to show</div>';
    };
    input.oninput = paint;
    input.onkeydown = e => { if (e.key === 'Enter' && input.value.trim()) { d.open = false; const b = bs.find(x => x.name === input.value.trim()); b ? run('switch', [b.name]) : run('start', [input.value.trim()]); } };
    $('.dm-list', d).onclick = e => {
      const s = e.target.closest('[data-switch]'), c = e.target.closest('[data-create]');
      if (s && s.dataset.switch !== S.status.branch) { d.open = false; run('switch', [s.dataset.switch]); }
      if (c) { d.open = false; run('start', [c.dataset.create]); }
    };
    paint();
  });
}

// The sync box: GitHub's "This branch is N commits ahead", plus where your FileMaker file stands.
function syncbox() {
  const s = S.status, pr = myPR(), onMain = s.branch === s.main;
  const parts = [];
  if (onMain) parts.push(s.behindMain ? `<b>${plural(s.behindMain, 'commit')}</b> behind <code>${esc(s.base)}</code>` : `You're on the default branch <code>${esc(s.main)}</code>`);
  else if (!s.aheadMain && !s.behindMain) parts.push(`This branch is up to date with <code>${esc(s.base || s.main)}</code>`);
  else parts.push(`This branch is ${[s.aheadMain && `<b>${plural(s.aheadMain, 'commit')} ahead of</b>`, s.behindMain && `<b>${plural(s.behindMain, 'commit')} behind</b>`].filter(Boolean).join(', ')} <code>${esc(s.base || s.main)}</code>`);
  parts.push(s.fileBehind ? `<span class="danger"><b>${esc(s.file)}</b> is behind this branch</span>`
    : s.dirty ? `<b>${plural(s.dirty, 'unsaved change')}</b> in ${esc(s.file || 'your file')}`
      : s.synced ? `${esc(s.file)} is in sync` : `${esc(s.file || 'no file')}: not scanned yet`);
  if (s.unpushed) parts.push(`<b>${s.unpushed}</b> to push`);
  if (pr) parts.push(`<a href="#/pr?n=${pr.number}">Pull request #${pr.number}</a> · ${reviewText(pr)}`);
  const acts = [];
  if (s.fileBehind) acts.push(runBtn('apply', 'Apply to file', { icon: 'pull', cls: 'btn-sm btn-primary' }));
  else acts.push(runBtn('snapshot', 'Scan file', { icon: 'sync', cls: 'btn-sm' }));
  if (!onMain && s.remote && (s.unpushed || !s.upstream) && s.aheadMain) acts.push(runBtn('push', 'Push', { icon: 'push', cls: 'btn-sm' }));
  if (!onMain && s.aheadMain && !pr && s.forgeReady) acts.push(runBtn('pr', 'Open pull request', { icon: 'pr', cls: 'btn-sm btn-primary' }));
  if (pr) acts.push(`<a class="btn btn-sm" href="#/pr?n=${pr.number}">${ic('pr')}View #${pr.number}</a>`);
  return `<div class="Box syncbox">${ic('branch', 'muted')}<div class="text">${parts.map((p, i) => i ? `<span class="dotsep"></span>${p}` : p).join('')}</div><div class="acts">${acts.join('')}</div></div>`;
}
function banners() {
  const s = S.status;
  return (s.merging ? flash('error', 'alert', `<strong>Merge in progress.</strong> Resolve the conflicts in <code>${esc(s.src)}/</code>, commit with git, then apply the result to your file.`, runBtn('apply', 'Apply', { cls: 'btn-sm' })) : '')
    + (s.fileBehind ? flash('warn', 'alert', `<strong>Your FileMaker file is behind this branch.</strong> Saving now would undo your teammates' work. Close the file and apply their changes first.`, runBtn('apply', 'Apply changes', { cls: 'btn-sm btn-primary' })) : '');
}

function reviewText(pr) {
  if (pr.state === 'MERGED') return 'merged';
  if (pr.state === 'CLOSED') return 'closed';
  return { APPROVED: 'approved', CHANGES_REQUESTED: 'changes requested' }[pr.reviewDecision] || 'review required';
}
function checksOf(rollup) {
  let fail = 0, pend = 0, ok = 0;
  for (const c of rollup || []) {
    const res = (c.conclusion || c.state || '').toUpperCase();
    if (['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED'].includes(res)) fail++;
    else if ((c.status && c.status !== 'COMPLETED') || ['PENDING', 'EXPECTED', ''].includes(res)) pend++;
    else ok++;
  }
  return { fail, pend, ok, total: fail + pend + ok };
}
function checksIcon(rollup) {
  const c = checksOf(rollup);
  if (!c.total) return '';
  if (c.fail) return `<span title="${c.fail} failing">${ic('x', 'danger')}</span>`;
  if (c.pend) return `<span title="${c.pend} pending">${ic('dot', 'attention')}</span>`;
  return `<span title="All checks passed">${ic('check', 'success')}</span>`;
}
function prIcon(pr) {
  if (pr.state === 'MERGED') return ic('merged', 'done');
  if (pr.state === 'CLOSED') return ic('prClosed', 'danger');
  return ic('pr', pr.isDraft ? 'muted' : 'success');
}
function reviewLabel(pr) {
  if (pr.state !== 'OPEN') return '';
  if (pr.isDraft) return '<span class="Label">Draft</span>';
  return { APPROVED: '<span class="Label Label--success">Approved</span>', CHANGES_REQUESTED: '<span class="Label Label--danger">Changes requested</span>' }[pr.reviewDecision]
    || '<span class="Label Label--attention">Review required</span>';
}

// ---------- routing ----------
function route() {
  const [name, qs] = (location.hash.slice(2) || 'changes').split('?');
  return { name: views[name] ? name : 'changes', params: new URLSearchParams(qs || '') };
}
function setParam(k, v) {
  const { name, params } = route();
  if (v == null || v === '') params.delete(k); else params.set(k, v);
  const qs = params.toString();
  history.replaceState(null, '', `#/${name}${qs ? '?' + qs : ''}`);
}
let seq = 0;
async function render() {
  const { name, params } = route();
  markTab();
  const el = $('#view');
  const mine = ++seq;
  const alive = () => mine === seq;
  try { await views[name](el, params, alive); }
  catch (e) { if (alive()) el.innerHTML = flash('error', 'alert', `<strong>Something went wrong.</strong> ${esc(e.message)}`); }
}
function paint(el, alive, html) {
  if (!alive()) return false;
  el.innerHTML = html;
  bindToolbar(el);
  return true;
}
async function refresh() {
  await refreshStatus();
  await render();
  refreshPRs();
}

// ---------- views ----------
const views = {
  async changes(el, p, alive) {
    const s = S.status;
    const list = await api('changes');
    const onMain = s.branch === s.main;
    if (!list.length) {
      return paint(el, alive, toolbar() + syncbox() + banners() + `<div class="Box">${blank('diff', 'No unsaved changes',
        `Work in FileMaker as usual. When you're done, close the file and scan it: every changed script, field and layout shows up here, ready to commit.`,
        runBtn('snapshot', 'Scan FileMaker file', { cls: 'btn-primary', icon: 'sync' }) + ` <a class="btn" href="#/objects">${ic('file')}Browse objects</a>`)}</div>`);
    }
    const groups = {};
    list.forEach((c, i) => (groups[c.type] ||= []).push([c, i]));
    if (!paint(el, alive, toolbar() + syncbox() + banners() + `
      <div class="layout">
        <aside class="sticky">
          <div class="Box">
            <div class="tree-head"><input class="form-control" id="cfilter" placeholder="Filter changed objects…" aria-label="Filter changed objects"></div>
            <div class="tree tree-body" id="ctree">${Object.entries(groups).map(([t, xs]) => `<div class="group-label">${esc(t)}</div>` +
              xs.map(([c, i]) => `<a class="item" href="#f-${i}" data-i="${i}" data-name="${esc(c.name.toLowerCase())}">${statIcon(c.status)}<span class="ellipsis">${esc(c.name)}</span></a>`).join('')).join('')}</div>
          </div>
        </aside>
        <div>
          <div class="Box">
            <div class="Box-header"><h3 class="Box-title">Commit changes</h3><span class="muted">to</span><span class="branch-name">${esc(s.branch)}</span></div>
            <div class="Box-body">
              ${onMain ? flash('info', 'info', `You're on <code>${esc(s.main)}</code>, the shared branch. Start a branch for this work, then commit.`) +
                `<div class="flex mb"><input class="form-control" id="newbranch" placeholder="feature/invoice-tax" aria-label="New branch name"><button class="btn" id="mkbranch">${ic('branch')}Create branch</button></div>` : ''}
              <div class="form-group"><label for="summary">Commit message</label><input class="form-control" id="summary" placeholder="Invoices: add tax field and calculation"></div>
              <div class="form-group"><label for="desc">Extended description <span class="muted" style="font-weight:400">(optional)</span></label><textarea class="form-control" id="desc" placeholder="Why the change, what to test…"></textarea></div>
              <div class="flex"><button class="btn btn-primary" id="commit">Commit ${plural(list.length, 'change')}</button><span class="note" style="margin:0">Re-exports ${esc(s.file || 'the file')} first, so you commit exactly what's in FileMaker. <kbd>⌘/Ctrl</kbd> + <kbd>Enter</kbd></span></div>
            </div>
          </div>
          <div class="diffbar"><span class="grow muted">Showing <strong style="color:var(--fg)">${plural(list.length, 'changed object')}</strong></span>${diffToggle()}${runBtn('snapshot', 'Re-scan file', { icon: 'sync', cls: 'btn-sm' })}</div>
          <div id="diffs"></div>
        </div>
      </div>`)) return;
    stackedDiffs($('#diffs'), list);
    $('#cfilter').oninput = e => {
      const f = e.target.value.toLowerCase();
      $$('#ctree a').forEach(a => a.classList.toggle('hidden', !a.dataset.name.includes(f)));
    };
    $('#ctree').onclick = e => {
      const a = e.target.closest('[data-i]');
      if (!a) return;
      e.preventDefault();
      $$('#ctree a').forEach(x => x.classList.toggle('selected', x === a));
      $(`#f-${a.dataset.i}`).scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const commit = () => {
      const sum = $('#summary').value.trim(), desc = $('#desc').value.trim();
      if (!sum) { $('#summary').focus(); toast('Write a commit message', true); return; }
      run('save', ['-m', desc ? `${sum}\n\n${desc}` : sum]);
    };
    $('#commit').onclick = commit;
    [$('#summary'), $('#desc')].forEach(i => i.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit(); });
    const mk = $('#mkbranch');
    if (mk) mk.onclick = () => { const n = $('#newbranch').value.trim(); n ? run('start', [n]) : $('#newbranch').focus(); };
  },

  async objects(el, p, alive) {
    const cats = await api('objects');
    if (!cats.length) {
      return paint(el, alive, toolbar() + `<div class="Box">${blank('file', 'No objects yet', 'Scan and commit your FileMaker file once; every table, script and layout shows up here.', runBtn('snapshot', 'Scan FileMaker file', { cls: 'btn-primary', icon: 'sync' }))}</div>`);
    }
    const path = p.get('path');
    const prim = cats.filter(c => !c.secondary), sec = cats.filter(c => c.secondary);
    const total = prim.reduce((n, c) => n + c.objects.length, 0);
    const catHTML = c => `<details ${path && path.startsWith(c.dir + '/') ? 'open' : ''} data-dir="${esc(c.dir)}"><summary>${ic('chev', 'chev')}${ic('folder', 'folder')}<span class="ellipsis">${esc(c.secondary ? c.dir : c.label)}</span><span class="count">${c.objects.length}</span></summary><div class="items"></div></details>`;
    if (!paint(el, alive, toolbar() + `
      <div class="layout">
        <aside class="sticky">
          <div class="Box">
            <div class="tree-head">
              <div class="flex"><strong class="grow">Objects</strong><span class="Counter">${total}</span></div>
              <input class="form-control" id="search" type="search" placeholder="Go to object…   /" aria-label="Find object">
              <label class="small muted flex"><input type="checkbox" id="fulltext"> Search inside calculations &amp; scripts</label>
            </div>
            <div class="tree tree-body" id="tree">${prim.map(catHTML).join('')}${sec.length ? `<div class="group-label">Parts</div>${sec.map(catHTML).join('')}` : ''}</div>
          </div>
        </aside>
        <div id="main"></div>
      </div>`)) return;
    const fillCat = d => {
      const c = cats.find(x => x.dir === d.dataset.dir);
      $('.items', d).innerHTML = c.objects.map(o => o.folder === 'Marker'
        ? '<div class="sep-row">────────</div>'
        : `<a class="item ${o.path === path ? 'selected' : ''}" href="#/objects?${q({ path: o.path })}" data-path="${esc(o.path)}">${ic(o.folder === 'True' ? 'folder' : 'file')}<span class="ellipsis">${esc(o.name)}</span></a>`).join('') || '<div class="sep-row">empty</div>';
    };
    $$('#tree details').forEach(d => {
      if (d.open) fillCat(d);
      d.addEventListener('toggle', () => { if (d.open && !$('.items', d).children.length) fillCat(d); });
    });
    $('#tree').onclick = e => {
      const a = e.target.closest('a.item');
      if (!a) return;
      e.preventDefault();
      setParam('path', a.dataset.path);
      $$('#tree a.item').forEach(x => x.classList.toggle('selected', x === a));
      objectView($('#main'), a.dataset.path, cats);
    };
    let timer;
    const search = () => {
      clearTimeout(timer);
      const term = $('#search').value.trim();
      const full = $('#fulltext').checked;
      if (!term) { $('#tree').classList.remove('hidden'); path ? objectView($('#main'), path, cats) : overview($('#main'), cats); return; }
      if (!full) {
        const hits = cats.flatMap(c => c.objects.filter(o => o.folder !== 'Marker' && o.name.toLowerCase().includes(term.toLowerCase())).map(o => ({ ...o, type: c.label, sec: c.secondary })))
          .filter(o => !o.sec).slice(0, 200);
        $('#main').innerHTML = `<div class="Box"><div class="Box-header"><h3 class="Box-title">${plural(hits.length, 'object')} named “${esc(term)}”</h3></div>${hits.map(o => `<a class="Box-row hover" style="color:var(--fg)" href="#/objects?${q({ path: o.path })}">${ic('file', 'muted')}<span class="grow ellipsis"><strong>${esc(o.name)}</strong></span><span class="type-tag">${esc(o.type)}</span></a>`).join('') || `<div class="Box-body muted">Nothing found. Try searching inside calculations.</div>`}</div>`;
        return;
      }
      if (term.length < 2) return;
      timer = setTimeout(async () => {
        const res = await api('search?' + q({ q: term }));
        const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        $('#main').innerHTML = `<div class="Box"><div class="Box-header"><h3 class="Box-title">${plural(res.length, 'object')} mention “${esc(term)}”</h3></div>${res.map(r => `
          <div class="Box-row" style="display:block"><a href="#/objects?${q({ path: r.path })}"><strong>${esc(r.name)}</strong></a> <span class="type-tag">${esc(r.type)}</span>
          ${r.hits.slice(0, 4).map(h => `<div class="flex top mono small" style="margin-top:4px"><span class="subtle" style="min-width:36px;text-align:right">${h.n}</span><span class="grow" style="white-space:pre-wrap;word-break:break-all">${esc(h.text).replace(re, m => `<mark>${m}</mark>`)}</span></div>`).join('')}</div>`).join('') || '<div class="Box-body muted">No matches.</div>'}</div>`;
      }, 220);
    };
    $('#search').oninput = search;
    $('#fulltext').onchange = search;
    path ? objectView($('#main'), path, cats) : overview($('#main'), cats);
  },

  async history(el, p, alive) {
    const all = p.get('all') === '1', only = p.get('p');
    const commits = await api('log?' + q({ all: all ? '1' : '', path: only }));
    if (!commits.length) return paint(el, alive, toolbar() + `<div class="Box">${blank('history', 'No commits yet', 'Your first commit shows up here.')}</div>`);
    const days = {};
    for (const c of commits) (days[new Date(c.date).toDateString()] ||= []).push(c);
    if (!paint(el, alive, toolbar(`<div class="BtnGroup"><a class="btn btn-sm ${all ? '' : 'selected'}" href="#/history?${q({ p: only })}">This branch</a><a class="btn btn-sm ${all ? 'selected' : ''}" href="#/history?${q({ all: '1', p: only })}">All branches</a></div>`) +
      (only ? flash('info', 'file', `History of <code>${esc(only)}</code>`, `<a class="btn btn-sm" href="#/history">Show all</a>`) : '') +
      Object.entries(days).map(([d, cs]) => `
        <h3 class="date-h">${ic('commit')}Commits on ${esc(new Date(cs[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))}</h3>
        <div class="Box">${cs.map(c => `
          <div class="Box-row hover commit-row">
            <div class="grow">
              <a class="title" href="#/commit?${q({ c: c.hash, p: only })}">${esc(c.subject)}</a>
              <div class="meta">${avatar(c.author)}<strong>${esc(c.author)}</strong> committed ${when(c.date)}${c.parents.length > 1 ? ' <span class="Label">merge</span>' : ''}${refLabels(c.refs)}</div>
            </div>
            <a class="btn btn-sm sha" href="#/commit?${q({ c: c.hash, p: only })}">${esc(c.short)}</a>
            <a class="btn btn-sm btn-octicon" href="#/objects" title="Browse objects">${ic('file')}</a>
          </div>`).join('')}</div>`).join(''))) return;
  },

  async commit(el, p, alive) {
    const r = await api('commit?' + q({ hash: p.get('c') }));
    const c = r.commit;
    if (!paint(el, alive, `
      <div class="Box mb">
        <div class="Box-header" style="display:block">
          <div class="flex"><h2 class="grow" style="font-weight:600">${esc(c.subject)}</h2>
            ${r.changes.length ? `<button class="btn btn-sm" id="cpatch">${ic('package')}Export as patch</button>` : ''}
            <a class="btn btn-sm" href="#/objects">${ic('file')}Browse objects</a></div>
          ${c.body ? `<pre class="mt-s" style="white-space:pre-wrap;font-family:var(--sans);margin:8px 0 0">${esc(c.body)}</pre>` : ''}
          <span id="cdl"></span>
        </div>
        <div class="Box-body flex wrap">${avatar(c.author)}<strong>${esc(c.author)}</strong><span class="muted">committed ${when(c.date)}</span>${refLabels(c.refs)}
          <span class="grow"></span><span class="muted small">${c.parents.length ? `${plural(c.parents.length, 'parent')} ${c.parents.map(x => `<a class="sha" href="#/commit?c=${esc(x)}">${esc(x.slice(0, 7))}</a>`).join(' + ')} · ` : ''}commit <span class="sha" style="color:var(--fg)">${esc(c.short)}</span></span></div>
      </div>
      ${r.changes.length ? `<div class="diffbar"><span class="grow muted">Showing <strong style="color:var(--fg)">${plural(r.changes.length, 'changed object')}</strong></span>${diffToggle()}</div><div id="diffs"></div>`
        : `<div class="Box">${blank('diff', 'No FileMaker objects changed', 'This commit only touched project files.')}</div>`}`)) return;
    if (!r.changes.length) return;
    const only = p.get('p');
    stackedDiffs($('#diffs'), only && r.changes.some(x => x.path === only) ? [...r.changes].sort((a, b) => (b.path === only) - (a.path === only)) : r.changes, r.range);
    $('#cpatch').onclick = async () => {
      if (await run('patch', ['-o', 'build/patch.xml', ...r.range]) === 0)
        $('#cdl').innerHTML = `<div class="mt-s flex wrap">${dlLinks('patch.xml', 'btn-sm')}</div>`;
    };
  },

  async branches(el, p, alive) {
    const s = S.status;
    const bs = await api('branches');
    const max = Math.max(1, ...bs.map(b => Math.max(b.ahead || 0, b.behind || 0)));
    const prOf = b => S.prs?.find(x => x.headRefName === b.name);
    const row = b => {
      const pr = prOf(b);
      return `<div class="Box-row hover">
        <div class="grow"><div class="flex"><span class="branch-name">${esc(b.name)}</span>${b.current ? '<span class="Label Label--accent">current</span>' : ''}</div>
          <div class="meta">Updated ${when(b.date)} by ${avatar(b.author)}<strong>${esc(b.author)}</strong> · <span class="ellipsis">${esc(b.subject)}</span></div></div>
        ${b.main ? '' : `<span class="ab" title="${b.behind || 0} behind, ${b.ahead || 0} ahead of ${esc(s.base || s.main)}"><span class="b">${b.behind || 0}<span class="bar" style="width:${Math.round((b.behind || 0) / max * 52)}px"></span></span><span class="a">${b.ahead || 0}<span class="bar" style="width:${Math.round((b.ahead || 0) / max * 52)}px"></span></span></span>`}
        <span style="width:90px">${pr ? `<a class="flex small" href="#/pr?n=${pr.number}">${prIcon(pr)}#${pr.number}</a>` : ''}</span>
        <span class="small muted" style="width:150px">${b.upstream ? esc(b.track || 'pushed') : 'local only'}</span>
        <span style="width:180px;text-align:right">${b.current ? (b.main || pr || !S.status.forgeReady ? '' : runBtn('pr', 'New pull request', { cls: 'btn-sm', icon: 'pr' })) : runBtn('switch', 'Switch', { cls: 'btn-sm', args: [b.name] })}</span>
      </div>`;
    };
    if (!paint(el, alive, `
      <div class="Subhead"><h2 class="Subhead-heading">Branches</h2>
        <div class="flex"><input class="form-control" id="newbranch" placeholder="feature/new-thing" aria-label="New branch name" style="width:220px"><button class="btn btn-primary" id="mk">${ic('branch')}New branch</button></div></div>
      <div class="Box mb"><div class="Box-header"><h3 class="Box-title">Default</h3></div>${bs.filter(b => b.main).map(row).join('') || '<div class="Box-body muted">none</div>'}</div>
      <div class="Box"><div class="Box-header"><h3 class="Box-title">Your branches</h3><span class="Counter">${bs.filter(b => !b.main).length}</span></div>${bs.filter(b => !b.main).map(row).join('') || `<div class="Box-body muted">No feature branches yet.</div>`}</div>
      <p class="note mt">Switching branches changes the files in <code>${esc(s.src)}/</code>, not your .fmp12. fmgit tells you when your file needs <em>Apply</em>.</p>`)) return;
    $('#mk').onclick = () => { const n = $('#newbranch').value.trim(); n ? run('start', [n]) : $('#newbranch').focus(); };
  },

  async prs(el, p, alive) {
    const s = S.status;
    if (!s.forgeReady) return paint(el, alive, `<div class="Box">${forgeBlank(s)}</div>`);
    const state = p.get('state') || 'open';
    const list = await api('prs?state=' + state);
    if (!paint(el, alive, `
      ${s.branch !== s.main && s.aheadMain && !myPR() ? `<div class="repo-toolbar"><div class="grow"></div>${runBtn('pr', 'New pull request', { cls: 'btn-primary', icon: 'pr' })}</div>` : ''}
      <div class="Box">
        <div class="Box-header"><nav class="states">${[['open', 'pr', 'Open'], ['merged', 'merged', 'Merged'], ['closed', 'prClosed', 'Closed'], ['all', 'pr', 'All']].map(([k, i, l]) =>
          `<a href="#/prs?state=${k}" class="${k === state ? 'selected' : ''}">${ic(i)}${l}${k === state ? ` <span class="Counter">${list.length}</span>` : ''}</a>`).join('')}</nav></div>
        ${list.map(x => `<div class="issue-row">${prIcon(x)}
          <div class="grow"><div class="flex wrap"><a class="title" href="#/pr?n=${x.number}">${esc(x.title)}</a>${reviewLabel(x)}${x.autoMergeRequest ? '<span class="Label Label--accent">auto-merge</span>' : ''}</div>
            <div class="meta">#${x.number} ${x.state === 'MERGED' ? 'merged' : 'opened'} ${when(x.state === 'MERGED' ? x.mergedAt || x.updatedAt : x.createdAt || x.updatedAt)} by ${esc(x.author?.login)} · <span class="branch-name">${esc(x.headRefName)}</span> → <span class="branch-name">${esc(x.baseRefName)}</span></div></div>
          ${checksIcon(x.statusCheckRollup)}</div>`).join('') || blank('pr', `No ${state === 'all' ? '' : state + ' '}pull requests`, 'Push a branch and open one; it shows up here for review.')}
      </div>`)) return;
  },

  async pr(el, p, alive) {
    const n = p.get('n');
    const r = await api('pr?' + q({ n }));
    const pr = r.pr;
    const open = pr.state === 'OPEN';
    const url = /^https?:\/\//.test(pr.url || '') ? pr.url : '';
    const tab = p.get('tab') || 'conversation';
    const st = pr.state === 'MERGED' ? ['merged', 'merged', 'Merged'] : pr.state === 'CLOSED' ? ['closed', 'prClosed', 'Closed'] : pr.isDraft ? ['draft', 'pr', 'Draft'] : ['open', 'pr', 'Open'];
    if (!paint(el, alive, `
      <div class="flex top"><h1 class="pr-title grow">${esc(pr.title)} <span class="muted">#${pr.number}</span></h1>
        ${url ? `<a class="btn btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${ic('ext')}Open on ${esc(forgeName())}</a>` : ''}</div>
      <div class="pr-meta"><span class="State State--${st[0]}">${ic(st[1])}${st[2]}</span>
        <span><strong>${esc(pr.author?.login)}</strong> ${pr.state === 'MERGED' ? 'merged' : 'wants to merge'} into <span class="branch-name">${esc(pr.baseRefName)}</span> from <span class="branch-name">${esc(pr.headRefName)}</span></span></div>
      <div class="subnav"><button data-tab="conversation" class="${tab === 'conversation' ? 'selected' : ''}">${ic('comment')}Conversation</button>
        <button data-tab="files" class="${tab === 'files' ? 'selected' : ''}">${ic('diff')}FileMaker changes <span class="Counter">${r.changes.length}</span></button></div>
      <div id="tabbody"></div>`)) return;
    $$('.subnav [data-tab]', el).forEach(b => b.onclick = () => { setParam('tab', b.dataset.tab); $$('.subnav [data-tab]', el).forEach(x => x.classList.toggle('selected', x === b)); show(b.dataset.tab); });
    const show = t => {
      const body = $('#tabbody', el);
      if (t === 'files') {
        if (r.fetchError) { body.innerHTML = flash('error', 'alert', `Couldn't load the branch: <code>${esc(r.fetchError)}</code>`); return; }
        if (!r.changes.length) { body.innerHTML = `<div class="Box">${blank('diff', 'No FileMaker changes', 'This pull request only touches project files.')}</div>`; return; }
        body.innerHTML = `<div class="diffbar" style="margin-top:0"><span class="grow muted"><strong style="color:var(--fg)">${plural(r.changes.length, 'changed object')}</strong>, shown the way FileMaker shows them</span>${diffToggle()}</div><div id="diffs"></div>${open ? reviewBox(pr) : ''}`;
        stackedDiffs($('#diffs', body), r.changes, r.range);
      } else {
        body.innerHTML = conversation(pr, r);
      }
      bindReview(body, pr);
    };
    show(tab);
  },

  async settings(el, p, alive) {
    const [c, s] = await Promise.all([api('config'), api('status')]);
    const ok = (good, title, yes, no) => `<li>${good ? ic('check', 'success') : ic('x', 'danger')}<div><strong>${title}</strong><div class="note" style="margin:0">${good ? yes : no}</div></div></li>`;
    const field = (name, label, value, note = '', attrs = '') => `<div class="form-group"><label for="cfg-${name}">${label}</label><input class="form-control" id="cfg-${name}" name="${name}" value="${esc(value ?? '')}" ${attrs}>${note ? `<p class="note">${note}</p>` : ''}</div>`;
    if (!paint(el, alive, `
      <div class="settings">
        <nav class="menu sticky" aria-label="Settings sections">
          <a href="#s-general" data-jump>${ic('gear')}General</a><a href="#s-filemaker" data-jump>${ic('tools')}FileMaker tools</a>
          <a href="#s-credentials" data-jump>${ic('key')}Credentials</a><a href="#s-forge" data-jump>${ic('repo')}${esc(s.forge === 'github' ? 'GitHub' : 'Forgejo')}</a>
          <a href="#s-checks" data-jump>${ic('shield')}Checks &amp; protection</a><a href="#s-deploy" data-jump>${ic('package')}Deploy</a>
        </nav>
        <div>
        <form id="cfg">
          <section class="set" id="s-general"><div class="Subhead"><h2 class="Subhead-heading">General</h2><button class="btn btn-primary" type="submit">Save settings</button></div>
            ${c.files?.length ? field('file', 'FileMaker files', c.files.join(', '), 'A multi-file solution. Edit <code>"files"</code> in fmgit.json to change the list.', 'disabled')
              : field('file', 'FileMaker file', c.file, 'Your local development copy (.fmp12), relative to the project folder.')}
            <div class="flex top" style="gap:16px"><div class="grow">${field('account', 'Account', c.account, 'Full Access account used to export and patch.')}</div>
              <div class="grow">${field('mainBranch', 'Default branch', c.mainBranch)}</div>
              <div style="width:140px">${field('approvals', 'Approvals', c.approvals, 'Required per PR.', 'type="number" min="0" max="10"')}</div></div>
          </section>
          <section class="set" id="s-filemaker"><div class="Subhead"><h2 class="Subhead-heading sm">FileMaker tools</h2></div>
            ${field('xml', 'XML export path', c.xml, 'Optional. For hosted files: a FileMaker script runs <em>Save a Copy as XML</em> to this path and fmgit reads it instead of running FMDeveloperTool.')}
            ${field('src', 'Source folder', c.src, 'Wiped and rewritten on every scan.')}
            <div class="form-group"><label for="cfg-exportCmd">Export command</label><textarea class="form-control mono small" id="cfg-exportCmd" name="exportCmd" rows="4">${esc(c.exportCmd.join('\n'))}</textarea><p class="note">One argument per line. Placeholders: {file} {account} {password} {out} {earKey}</p></div>
            <div class="form-group"><label for="cfg-upgradeCmd">Patch command</label><textarea class="form-control mono small" id="cfg-upgradeCmd" name="upgradeCmd" rows="4">${esc(c.upgradeCmd.join('\n'))}</textarea><p class="note">FMUpgradeTool. Placeholders: {file} {out} {patch} {account} {password} {earKey}</p></div>
            ${field('patchRoot', 'Patch root element', c.patchRoot)}
            <ul class="check-list">${ok(s.tools.export, 'Export', s.xmlMode ? 'Reads the XML export path.' : 'FMDeveloperTool found.', 'FMDeveloperTool not found: put its full path in the export command, or use an XML export path.')}
              ${ok(s.tools.upgrade, 'Patch', 'FMUpgradeTool found.', 'FMUpgradeTool not found: fmgit writes build/patch.xml and you apply it yourself.')}</ul>
          </section>
          <section class="set" id="s-forge"><div class="Subhead"><h2 class="Subhead-heading sm">Git host</h2></div>
            <div class="form-group"><label for="cfg-forge">Pull requests on</label><select class="form-control" id="cfg-forge" name="forge" style="width:auto">
              ${[['', `Detect from remote (${s.forge || 'none'})`], ['github', 'GitHub (gh CLI)'], ['forgejo', 'Forgejo / Gitea (API)']].map(([v, l]) => `<option value="${v}" ${(c.forge || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
            ${field('forgeURL', 'Forgejo URL', c.forgeURL, 'Only if the web address differs from the remote host, e.g. https://git.example.com')}
            <ul class="check-list">${ok(s.forgeReady, forgeName(), `Connected${s.webURL ? ` to <a href="${esc(s.webURL)}" target="_blank" rel="noopener noreferrer">${esc(s.webURL)}</a>` : ''}.`, esc(s.forgeError || 'Not connected.'))}</ul>
            ${s.forge === 'forgejo' ? `<p class="mt"><strong>Readable objects in Forgejo's file browser.</strong> Add this to Forgejo's <code>app.ini</code> and restart it: scripts then show as script text and tables as field lists, right in Forgejo.</p>
              <pre class="snippet">[markup.filemaker]\nENABLED = true\nFILE_EXTENSIONS = .xml\nRENDER_COMMAND = "fmgit render"\nIS_INPUT_FILE = false</pre>` : ''}
          </section>
        </form>
          <section class="set" id="s-credentials"><div class="Subhead"><h2 class="Subhead-heading sm">Credentials</h2></div>
            <p class="muted">Kept in the memory of this <code>fmgit ui</code> process only, never written to disk. Or set <code>FMGIT_PASSWORD</code> / <code>FMGIT_FORGE_TOKEN</code> before starting.</p>
            <form id="pw" class="form-group"><label for="pw-in">FileMaker password ${s.passwordSet ? '<span class="Label Label--success">set</span>' : '<span class="Label Label--attention">not set</span>'}</label>
              <div class="flex"><input class="form-control" type="password" id="pw-in" autocomplete="current-password" placeholder="Password of ${esc(c.account)}"><button class="btn" type="submit">Use</button></div></form>
            ${s.forge === 'forgejo' ? `<form id="tok" class="form-group"><label for="tok-in">Forgejo access token ${s.forgeTokenSet ? '<span class="Label Label--success">set</span>' : '<span class="Label Label--attention">not set</span>'}</label>
              <div class="flex"><input class="form-control" type="password" id="tok-in" autocomplete="off" placeholder="Token with repository + issue write access"><button class="btn" type="submit">Use</button></div>
              <p class="note">Create one in Forgejo under <em>Settings › Applications</em>${s.webURL ? ` (<a href="${esc(s.webURL.replace(/\/[^/]+\/[^/]+$/, ''))}/user/settings/applications" target="_blank" rel="noopener noreferrer">open</a>)` : ''}.</p></form>` : ''}
          </section>
          <section class="set" id="s-checks"><div class="Subhead"><h2 class="Subhead-heading sm">Checks &amp; protection</h2></div>
            <div class="Box mb"><div class="Box-row"><div class="grow"><strong>Consistency check</strong><div class="note" style="margin:0">Same check CI runs on every pull request: valid XML, no conflict markers, no id or name collisions.</div></div><button class="btn" id="runcheck" type="button">${ic('play')}Run</button></div>
              <div id="checkres"></div></div>
            <div class="Box"><div class="Box-row"><div class="grow"><strong>Protect ${esc(c.mainBranch)}</strong><div class="note" style="margin:0">Require ${plural(+c.approvals, 'approval')} and a green fmgit check, block direct pushes, and let approved pull requests merge themselves.</div></div>
              ${s.forgeReady ? runBtn('protect', 'Protect', { icon: 'shield', confirm: `Change branch protection on ${forgeName()}?` }) : `<button class="btn" disabled>${ic('shield')}Protect</button>`}</div></div>
          </section>
          <section class="set" id="s-deploy"><div class="Subhead"><h2 class="Subhead-heading sm">Deploy</h2></div>
            <p class="muted">A patch between two commits brings exactly those changes into any copy of the file, for example production.</p>
            <div class="flex mb"><input class="form-control" id="pfrom" placeholder="From (tag, branch or commit)" aria-label="From"><input class="form-control" id="pto" placeholder="To (default HEAD)" aria-label="To"></div>
            <div class="flex wrap"><button class="btn" id="mkpatch" type="button">${ic('package')}Create patch</button><button class="btn" id="mkfull" type="button">${ic('file')}Build full XML</button><span id="dl"></span></div>
          </section>
        </div>
      </div>`)) return;
    $$('[data-jump]', el).forEach(a => a.onclick = e => { e.preventDefault(); $(a.getAttribute('href')).scrollIntoView({ behavior: 'smooth' }); });
    $('#cfg').onsubmit = async e => {
      e.preventDefault();
      const f = new FormData(e.target);
      const lines = k => String(f.get(k)).split('\n').map(x => x.trim()).filter(Boolean);
      try {
        await api('config', {
          file: f.get('file'), account: f.get('account'), src: f.get('src'), xml: f.get('xml'), mainBranch: f.get('mainBranch'), approvals: +f.get('approvals'),
          patchRoot: f.get('patchRoot'), exportCmd: lines('exportCmd'), upgradeCmd: lines('upgradeCmd'), forge: f.get('forge'), forgeURL: f.get('forgeURL'),
        });
        toast('Settings saved');
        refresh();
      } catch (err) { toast(err.message, true); }
    };
    $('#pw').onsubmit = async e => { e.preventDefault(); await api('password', { password: $('#pw-in').value }); toast('Password set for this session'); refresh(); };
    const tk = $('#tok');
    if (tk) tk.onsubmit = async e => { e.preventDefault(); await api('token', { token: $('#tok-in').value }); toast('Token set for this session'); refresh(); };
    $('#runcheck').onclick = async () => {
      $('#checkres').innerHTML = '<div class="Box-row muted">Checking…</div>';
      const r = await api('check');
      $('#checkres').innerHTML = r.errors.length
        ? r.errors.map(x => `<div class="Box-row">${ic('x', 'danger')}<span class="mono small">${esc(x)}</span></div>`).join('')
        : `<div class="Box-row">${ic('check', 'success')}<span>No problems found.</span></div>`;
    };
    const dl = f => { $('#dl').innerHTML = dlLinks(f, 'btn-primary'); };
    $('#mkpatch').onclick = async () => {
      const from = $('#pfrom').value.trim(), to = $('#pto').value.trim();
      if (!from) { $('#pfrom').focus(); return; }
      if (await run('patch', ['-o', 'build/patch.xml', from, ...(to ? [to] : [])]) === 0) dl('patch.xml');
    };
    $('#mkfull').onclick = async () => { if (await run('build', ['-o', 'build/full.xml']) === 0) dl('full.xml'); };
  },
};

// One download per file of a multi-file solution (build/UI.patch.xml, ...).
function dlLinks(f, cls) {
  const files = S.status.names?.length ? S.status.names.map(n => n + '.' + f) : [f];
  return files.map(x => `<a class="btn ${cls}" href="/api/download?${q({ f: x, t: token })}">${ic('pull')}Download ${esc(x)}</a>`).join(' ');
}

function forgeBlank(s) {
  if (!s.remote) return blank('repo', 'No shared repository yet', `Create one on Forgejo or GitHub and add it as <code>origin</code>:<br><code>git remote add origin https://git.example.com/team/app.git</code>`);
  if (s.forge === 'forgejo') return blank('key', 'Connect to Forgejo', `${esc(s.forgeError || '')}`, `<a class="btn btn-primary" href="#/settings">${ic('key')}Add token in settings</a>`);
  return blank('repo', 'Connect to GitHub', esc(s.forgeError || 'Install the GitHub CLI (gh) and run gh auth login.'));
}

function refLabels(refs) {
  return refs ? refs.split(', ').filter(Boolean).map(r => `<span class="Label ${r.startsWith('HEAD') ? 'Label--accent' : ''}">${esc(r.replace('HEAD -> ', ''))}</span>`).join(' ') : '';
}

function overview(el, cats) {
  el.innerHTML = `<div class="Box"><div class="Box-header"><h3 class="Box-title">${ic('repo')} ${esc(S.status.file || 'Solution')}</h3><span class="muted small">as of your last scan</span></div>
    <table class="data"><thead><tr><th>Catalog</th><th>Objects</th><th></th></tr></thead><tbody>${cats.filter(c => !c.secondary).map(c => `
      <tr><td>${ic('folder', 'folder')} <strong>${esc(c.label)}</strong></td><td>${c.objects.filter(o => o.folder !== 'Marker').length}</td>
      <td class="muted small ellipsis" style="max-width:420px">${esc(c.objects.filter(o => o.folder !== 'Marker').slice(0, 6).map(o => o.name).join(', '))}${c.objects.length > 6 ? ' …' : ''}</td></tr>`).join('')}</tbody></table></div>`;
}

async function objectView(el, path, cats) {
  el.innerHTML = '<div class="Box"><div class="Box-body muted">Loading…</div></div>';
  let o, last;
  try { [o, last] = await Promise.all([api('object?' + q({ path })), api('log?' + q({ path })).catch(() => [])]); }
  catch (e) { el.innerHTML = flash('error', 'alert', esc(e.message)); return; }
  const c = last[0];
  const label = pt => (pt.kind === 'fields' ? `Fields (${pt.fields?.length || 0})` : pt.kind === 'script' ? 'Script' : pt.kind === 'calc' ? 'Calculation' : `${pt.label} XML`) + (pt.dir.split('/').pop().includes('.') ? ' · 2nd pass' : '');
  el.innerHTML = `
    <div class="flex mb" style="font-size:16px"><a href="#/objects">${esc(S.status.repo)}</a><span class="muted">/</span><span>${esc(o.type)}</span><span class="muted">/</span><strong class="ellipsis">${esc(o.name)}</strong></div>
    ${c ? `<div class="Box mb"><div class="Box-header" style="border-bottom:0;border-radius:6px">${avatar(c.author)}<strong>${esc(c.author)}</strong>
      <a class="ellipsis grow" style="color:var(--fg-muted)" href="#/commit?${q({ c: c.hash, p: path })}">${esc(c.subject)}</a>
      <a class="sha muted" href="#/commit?${q({ c: c.hash, p: path })}">${esc(c.short)}</a><span class="muted small nowrap">· ${when(c.date)}</span>
      <a class="btn btn-sm" href="#/history?${q({ p: path })}">${ic('history')}${plural(last.length, 'commit')}</a></div></div>` : flash('info', 'info', 'Not committed yet.')}
    <div class="Box">
      <div class="Box-header" style="padding:8px">
        <div class="segtabs grow" role="tablist">${o.parts.map((pt, i) => `<button role="tab" data-part="${i}" class="${i ? '' : 'selected'}">${esc(label(pt))}</button>`).join('')}</div>
        <button class="btn btn-sm" id="raw">XML</button>
      </div>
      <div id="partbody"></div>
    </div>`;
  let cur = 0, raw = false;
  const show = () => {
    const pt = o.parts[cur];
    $$('[data-part]', el).forEach(b => b.classList.toggle('selected', +b.dataset.part === cur));
    $('#raw', el).classList.toggle('selected', raw);
    $('#raw', el).hidden = pt.kind === 'xml';
    const box = $('#partbody', el);
    if (raw || pt.kind === 'xml') { box.innerHTML = blob(pt.xml, 'xml'); return; }
    if (pt.kind === 'fields') {
      box.innerHTML = `<table class="data"><thead><tr><th>Field</th><th>Type</th><th>Options</th></tr></thead><tbody>${pt.fields.map(f => `<tr>
        <td><strong>${esc(f.name)}</strong> <span class="subtle small">#${esc(f.id)}</span>${f.comment ? `<div class="muted small">${esc(f.comment)}</div>` : ''}${f.calc ? `<div class="calc">${hlCalc(f.calc)}</div>` : ''}</td>
        <td class="nowrap"><code>${esc(f.type)}</code>${f.kind !== 'Normal' ? ` <span class="Label">${esc(f.kind)}</span>` : ''}${f.reps > 1 ? ` <span class="Label">[${esc(f.reps)}]</span>` : ''}</td>
        <td><div class="flex wrap" style="gap:4px">${f.global ? '<span class="Label Label--accent">global</span>' : ''}${f.required ? '<span class="Label">required</span>' : ''}${f.unique ? '<span class="Label">unique</span>' : ''}${f.autoEnter ? `<span class="Label Label--success">auto-enter: ${esc(f.autoEnter)}</span>` : ''}${f.index && f.index !== 'None' ? `<span class="Label">index: ${esc(f.index)}</span>` : ''}</div></td></tr>`).join('')}</tbody></table>`;
      return;
    }
    box.innerHTML = blob(pt.text, pt.kind);
  };
  $$('[data-part]', el).forEach(b => b.onclick = () => { cur = +b.dataset.part; raw = false; show(); });
  $('#raw', el).onclick = () => { raw = !raw; show(); };
  show();
}

function conversation(pr, r) {
  const fmgitComment = b => (b || '').startsWith('<!-- fmgit -->');
  const events = [
    ...(pr.reviews || []).map(x => ({ at: x.submittedAt, who: x.author?.login, kind: 'review', state: x.state, body: x.body })),
    ...(pr.comments || []).map(x => ({ at: x.createdAt, who: x.author?.login, kind: 'comment', body: x.body })),
  ].sort((a, b) => new Date(a.at) - new Date(b.at));
  const item = e => {
    if (e.kind === 'comment' && fmgitComment(e.body))
      return `<div class="tl-event"><span class="badge">${ic('diff')}</span><span><strong>${esc(e.who)}</strong> posted the FileMaker diff ${when(e.at)} · <button class="btn-link" data-goto-files>view changes</button></span></div>`;
    if (e.kind === 'review') {
      const [cls, icon, verb] = { APPROVED: ['success', 'check', 'approved these changes'], CHANGES_REQUESTED: ['danger', 'x', 'requested changes'], DISMISSED: ['', 'x', 'review was dismissed'] }[e.state] || ['', 'eye', 'reviewed'];
      return `<div class="tl-event"><span class="badge ${cls}">${ic(icon)}</span><span><strong>${esc(e.who)}</strong> ${verb} ${when(e.at)}</span></div>` + (e.body ? commentBox(e.who, e.at, e.body) : '');
    }
    return commentBox(e.who, e.at, e.body);
  };
  const ch = checksOf(pr.statusCheckRollup);
  const reviewers = {};
  for (const x of pr.reviews || []) if (['APPROVED', 'CHANGES_REQUESTED'].includes(x.state)) reviewers[x.author?.login] = x.state;
  const open = pr.state === 'OPEN';
  const reviewRow = pr.reviewDecision === 'APPROVED' ? ['success', 'check', 'Changes approved', `${plural(Object.values(reviewers).filter(v => v === 'APPROVED').length, 'approving review')}`]
    : pr.reviewDecision === 'CHANGES_REQUESTED' ? ['danger', 'x', 'Changes requested', 'A reviewer asked for changes before this can merge.']
      : ['attention', 'eye', 'Review required', `At least ${plural(Math.max(S.status.approvals || 1, 1), 'approving review')} is required.`];
  const checkRow = !ch.total ? ['neutral', 'dot', 'No checks yet', 'The fmgit check runs in CI on every push.']
    : ch.fail ? ['danger', 'x', 'Some checks were not successful', `${ch.fail} failing, ${ch.ok} successful`]
      : ch.pend ? ['attention', 'dot', 'Checks are running', `${ch.pend} pending, ${ch.ok} successful`]
        : ['success', 'check', 'All checks have passed', plural(ch.ok, 'successful check')];
  const row = ([cls, icon, title, note], extra = '') => `<div class="Box-row"><span class="big-icon ${cls}">${ic(icon)}</span><div class="grow"><h4>${title}</h4><div class="muted">${note}</div>${extra}</div></div>`;
  const checkList = (pr.statusCheckRollup || []).map(c => {
    const res = (c.conclusion || c.state || '').toUpperCase();
    const icon = ['SUCCESS', 'NEUTRAL', 'SKIPPED'].includes(res) ? ic('check', 'success') : ['FAILURE', 'ERROR', 'CANCELLED', 'TIMED_OUT'].includes(res) ? ic('x', 'danger') : ic('dot', 'attention');
    const link = /^https?:\/\//.test(c.detailsUrl || c.targetUrl || '') ? (c.detailsUrl || c.targetUrl) : '';
    return `<div class="flex mt-s">${icon}<span class="grow">${esc(c.name || c.context)}</span>${link ? `<a class="small" href="${esc(link)}" target="_blank" rel="noopener noreferrer">Details</a>` : ''}</div>`;
  }).join('');
  const merged = pr.state === 'MERGED';
  const mergeRow = merged ? row(['done', 'merged', 'Pull request successfully merged and closed', `The branch was merged ${when(pr.mergedAt)}. Run <em>Pull</em> to bring it into your FileMaker file.`])
    : !open ? row(['danger', 'prClosed', 'This pull request is closed', 'It was closed without merging.'])
      : pr.autoMergeRequest ? row(['success', 'check', 'Auto-merge is enabled', 'This will squash-merge automatically as soon as all requirements are met.'])
        : `<div class="Box-row"><span class="big-icon ${pr.reviewDecision === 'APPROVED' && !ch.fail && !ch.pend ? 'success' : 'neutral'}">${ic('merged')}</span><div class="grow"><h4>${pr.reviewDecision === 'APPROVED' && !ch.fail && !ch.pend ? 'Ready to merge' : 'Merging is blocked until requirements are met'}</h4>
            <div class="flex wrap mt-s">${runBtn('merge', 'Enable auto-merge', { cls: 'btn-primary', args: ['-auto', String(pr.number)] })}${runBtn('merge', 'Squash and merge now', { args: [String(pr.number)], confirm: `Squash-merge #${pr.number} now?` })}</div></div></div>`;
  return `<div class="layout side-right">
    <div>
      <div class="timeline">
        ${commentBox(pr.author?.login, pr.createdAt, pr.body || '*No description provided.*')}
        ${events.map(item).join('')}
        ${merged ? `<div class="tl-event"><span class="badge done">${ic('merged')}</span><span>Merged ${when(pr.mergedAt)}</span></div>` : ''}
      </div>
      <div class="Box mergebox mt">${open ? row(reviewRow) + row(checkRow, checkList) : ''}${mergeRow}</div>
      ${open ? `<div class="mergebox">${reviewBox(pr)}</div>` : ''}
    </div>
    <aside>
      <div class="sidebar-item"><h4>Reviewers</h4>${Object.entries(reviewers).map(([u, st]) => `<div class="flex">${avatar(u)}<span class="grow">${esc(u)}</span>${st === 'APPROVED' ? ic('check', 'success') : ic('x', 'danger')}</div>`).join('') || '<span class="muted small">No reviews yet</span>'}</div>
      <div class="sidebar-item"><h4>Checks</h4>${checkList || '<span class="muted small">None</span>'}</div>
      <div class="sidebar-item"><h4>FileMaker changes</h4>${r.changes.slice(0, 12).map(c => `<div class="flex small">${statIcon(c.status)}<span class="ellipsis grow">${esc(c.name)}</span><span class="type-tag">${esc(c.type)}</span></div>`).join('') || '<span class="muted small">None</span>'}
        ${r.changes.length ? `<button class="btn-link small mt-s" data-goto-files>See all ${r.changes.length} →</button>` : ''}</div>
      <div class="sidebar-item"><h4>Auto-merge</h4><span class="small">${pr.autoMergeRequest ? `${ic('check', 'success')} Enabled (squash)` : 'Off'}</span></div>
    </aside>
  </div>`;
}
function commentBox(who, at, body) {
  return `<div class="tl-comment">${avatar(who, 'lg')}<div class="Box"><div class="Box-header"><strong>${esc(who)}</strong>&nbsp;commented ${when(at)}</div><div class="body">${esc(body)}</div></div></div>`;
}
function reviewBox(pr) {
  return `<div class="Box mt" id="reviewbox"><div class="Box-header"><h3 class="Box-title">Review changes</h3></div><div class="Box-body">
    <textarea class="form-control" id="rv" placeholder="Leave a comment" aria-label="Review comment"></textarea>
    <label class="radio"><input type="radio" name="rv-kind" value="approve" checked><span><strong>Approve</strong><div class="note">Submit feedback and approve merging these changes.</div></span></label>
    <label class="radio"><input type="radio" name="rv-kind" value="reject"><span><strong>Request changes</strong><div class="note">Submit feedback that must be addressed before merging.</div></span></label>
    <button class="btn btn-primary mt-s" id="rv-submit">Submit review</button></div></div>`;
}
function bindReview(el, pr) {
  $$('[data-goto-files]', el).forEach(b => b.onclick = () => $('.subnav [data-tab="files"]').click());
  const sub = $('#rv-submit', el);
  if (!sub) return;
  sub.onclick = () => {
    const body = $('#rv', el).value.trim();
    const kind = $('input[name="rv-kind"]:checked', el).value;
    if (kind === 'reject' && !body) { $('#rv', el).focus(); toast('Say what needs to change', true); return; }
    run(kind, ['-m', body, String(pr.number)]);
  };
}

document.addEventListener('click', e => {
  $$('details.dropdown[open]').forEach(d => { if (!d.contains(e.target)) d.open = false; });
});

// ---------- boot ----------
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  localStorage.setItem('fmgit-theme', t);
  $('#theme').innerHTML = ic(t === 'dark' ? 'sun' : 'moon');
}
applyTheme(localStorage.getItem('fmgit-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('#theme').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');

document.addEventListener('keydown', e => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    e.preventDefault();
    if (route().name !== 'objects') { location.hash = '#/objects'; setTimeout(() => $('#search')?.focus(), 300); }
    else $('#search')?.focus();
  }
  if (e.key === 'Escape') openConsole(false);
});
window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#f-')) render(); });
window.addEventListener('focus', refreshStatus);
setInterval(() => { if (!running && document.visibilityState === 'visible') refreshStatus(); }, 20000);

if (!token) {
  document.body.innerHTML = `<div class="container">${blank('key', 'Open the link from your terminal', 'Run <code>fmgit ui</code> and use the link it prints: it carries the key for this session.')}</div>`;
} else {
  refreshStatus().then(() => { render(); refreshPRs(); });
}
