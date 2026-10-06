// fmgit web UI: a desktop git client (GitHub Desktop / GitKraken layout). No build step, no dependencies.
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
  changes.forEach((c, i) => {
    const box = $(`#f-${i}`, el);
    $('[data-collapse]', box).onclick = () => box.classList.toggle('collapsed');
    const lb = $('[data-load]', box);
    if (lb) lb.onclick = () => loadDiff(box, c, range);
    else loadDiff(box, c, range);
  });
}
async function loadDiff(box, c, range) {
  const body = $('.file-body', box);
  try {
    const d = await api('diff?' + q({ range, path: c.path }));
    const hunks = parseDiff(d.diff);
    box._hunks = hunks;
    paintDiff(box);
    if (!hunks.length) body.innerHTML = '<div class="blankslate" style="padding:16px"><span class="muted">Renamed or whitespace only.</span></div>';
  } catch (e) { body.innerHTML = `<div class="Box-body danger">${esc(e.message)}</div>`; }
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
  else {
    if (cmd === 'fetch') localStorage.setItem('fmgit-fetched', new Date().toISOString());
    setTimeout(() => { if (!running) openConsole(false); }, 2500);
  }
  running = false;
  $$('[data-run]').forEach(b => b.disabled = false);
  await refresh();
  return code;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-run]');
  if (!b || b.disabled) return;
  e.preventDefault();
  b.closest('details')?.removeAttribute('open');
  if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
  run(b.dataset.run, b.dataset.args ? JSON.parse(b.dataset.args) : []);
});
const runAttrs = (cmd, { args, confirm: c } = {}) =>
  `data-run="${cmd}"${args ? ` data-args='${esc(JSON.stringify(args))}'` : ''}${c ? ` data-confirm="${esc(c)}"` : ''}${running ? ' disabled' : ''}`;
const runBtn = (cmd, label, { cls = '', icon, title, ...o } = {}) =>
  `<button class="btn ${cls}" ${runAttrs(cmd, o)}${title ? ` title="${esc(title)}" aria-label="${esc(title)}"` : ''}>${icon ? ic(icon) : ''}${label}</button>`;

// ---------- toolbar, rail, status bar ----------
const S = { status: null, prs: null };
const D = {}; // data the list pane loaded, shared with the detail pane
const forgeName = () => ({ github: 'GitHub', forgejo: 'Forgejo' }[S.status?.forge] || 'your git host');
const fileLabel = s => s.files?.length > 1 ? plural(s.files.length, 'file') : s.file || 'no file';

async function refreshStatus() {
  try { S.status = await api('status'); } catch (e) { toast(e.message, true); return; }
  renderChrome();
}
async function refreshPRs() {
  if (!S.status?.forgeReady) { S.prs = null; renderChrome(); return; }
  try { S.prs = await api('prs?state=open'); } catch { S.prs = null; }
  renderChrome();
}
const myPR = () => S.prs?.find(p => p.headRefName === S.status?.branch);

// A GitHub Desktop toolbar button: icon, small caption, big value.
const tb = (icon, cap, val, { tag = 'button', attrs = '', cls = '', caret = false } = {}) =>
  `<${tag} class="tb ${cls}" ${attrs}>${icon}<span class="tb-text"><span class="tb-cap">${cap}</span><span class="tb-val">${val}</span></span>${caret ? ic('chevDown', 'tb-caret') : ''}</${tag}>`;

// The one sync action that matters right now, like GitHub Desktop's Fetch/Pull/Push button.
function syncAction(s) {
  if (!s.remote) return { icon: 'push', val: 'No remote', cap: 'Add origin in a terminal', disabled: true };
  if (s.behindMain) return { cmd: 'pull', icon: 'pull', val: `Pull ${esc(s.main)}`, cap: `${plural(s.behindMain, 'commit')} behind ${esc(s.base)}`, badge: `↓${s.behindMain}` };
  if (s.branch && !s.upstream) return { cmd: 'push', icon: 'push', val: 'Publish branch', cap: 'Push it to origin' };
  if (s.unpushed) return { cmd: 'push', icon: 'push', val: 'Push origin', cap: `${plural(s.unpushed, 'commit')} to push`, badge: `↑${s.unpushed}` };
  const f = localStorage.getItem('fmgit-fetched');
  return { cmd: 'fetch', icon: 'sync', val: 'Fetch origin', cap: f ? `Last fetched ${ago(f)}` : 'Never fetched' };
}

function renderChrome() {
  const s = S.status;
  if (!s) return;
  document.title = `${s.repo} · fmgit`;
  renderRail();
  renderStatusbar();
  $('#banner').innerHTML = s.merging ? flash('error', 'alert', `<strong>Merge in progress.</strong> Resolve the conflicts in <code>${esc(s.src)}/</code>, commit with git, then apply the result to your file.`, runBtn('apply', 'Apply', { cls: 'btn-sm' }))
    : s.fileBehind ? flash('warn', 'alert', `<strong>${esc(fileLabel(s))} is behind this branch.</strong> Saving now would undo your teammates' work. Close the file in FileMaker and apply their changes first.`, runBtn('apply', 'Apply changes', { cls: 'btn-sm btn-primary' })) : '';
  if ($('#toolbar details[open]')) return; // don't close a menu the user is in
  const pr = myPR(), onMain = s.branch === s.main, sy = syncAction(s);
  const web = s.webURL && /^https?:\/\//.test(s.webURL) ? s.webURL : '';
  const fileBtn = s.fileBehind
    ? tb(ic('pull'), esc(fileLabel(s)) + ' is behind', 'Apply to file', { attrs: runAttrs('apply'), cls: 'warn' })
    : tb(ic('sync'), s.dirty ? `${plural(s.dirty, 'unsaved change')}` : s.synced ? `${esc(fileLabel(s))} in sync` : 'Not scanned yet', 'Scan FileMaker file', { attrs: runAttrs('snapshot') });
  const prBtn = pr ? tb(prIcon(pr), `Pull request #${pr.number}`, reviewText(pr), { tag: 'a', attrs: `href="#/prs?n=${pr.number}"` })
    : !onMain && s.aheadMain && s.forgeReady ? tb(ic('pr'), `${plural(s.aheadMain, 'commit')} ahead`, 'Open pull request', { attrs: runAttrs('pr') }) : '';
  $('#toolbar').innerHTML = `
    <a class="logo" href="#/changes" aria-label="fmgit">fm</a>
    <details class="dropdown tb-drop">
      <summary>${tb(ic('repo'), 'Current repository', esc(s.owner ? `${s.owner}/${s.repo}` : s.repo), { tag: 'span', caret: true })}</summary>
      <div class="dropdown-menu"><div class="dm-head">${esc(s.repo)}</div><div class="dm-list">
        <div class="dm-item small muted" title="${esc(s.dir)}">${ic('folder')}<span class="ellipsis">${esc(s.dir)}</span></div>
        ${web ? `<a class="dm-item" href="${esc(web)}" target="_blank" rel="noopener noreferrer"><span class="check">${ic('ext')}</span>View on ${esc(forgeName())}</a>` : ''}
        <a class="dm-item" href="#/settings"><span class="check">${ic('gear')}</span>Repository settings</a></div></div>
    </details>
    <details class="dropdown tb-drop" id="branchpicker">
      <summary>${tb(ic('branch'), 'Current branch', esc(s.branch || '(detached)'), { tag: 'span', caret: true })}</summary>
      <div class="dropdown-menu"><div class="dm-head">Switch branches</div>
        <div class="dm-filter"><input class="form-control" placeholder="Find or create a branch…" aria-label="Find or create a branch"></div>
        <div class="dm-list"><div class="muted small" style="padding:8px">Loading…</div></div></div>
    </details>
    <div class="tb-split">
      ${tb(ic(sy.icon), sy.cap, sy.val + (sy.badge ? ` <span class="tb-badge">${sy.badge}</span>` : ''), { attrs: sy.disabled ? 'disabled' : runAttrs(sy.cmd) })}
      <details class="dropdown tb-drop tb-more">
        <summary class="tb" aria-label="More sync actions">${ic('chevDown')}</summary>
        <div class="dropdown-menu right"><div class="dm-list">
          <button class="dm-item" ${runAttrs('fetch')}><span class="check">${ic('sync')}</span>Fetch origin</button>
          <button class="dm-item" ${runAttrs('pull')}><span class="check">${ic('pull')}</span>Pull ${esc(s.main)} into this branch</button>
          <button class="dm-item" ${runAttrs('push')}><span class="check">${ic('push')}</span>Push this branch</button></div></div>
      </details>
    </div>
    ${fileBtn}
    ${prBtn}
    <span class="grow"></span>
    <button id="theme" class="tb tb-icon" type="button" aria-label="Toggle dark mode">${ic(document.documentElement.dataset.theme === 'dark' ? 'sun' : 'moon')}</button>`;
  bindBranchPicker($('#branchpicker'));
}

function bindBranchPicker(d) {
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

const TABS = { changes: ['diff', 'Changes'], history: ['history', 'History'], objects: ['file', 'Objects'], branches: ['branch', 'Branches'], prs: ['pr', 'Pull requests'], settings: ['gear', 'Settings'] };
function renderRail() {
  const s = S.status;
  const counts = { changes: s.dirty || '', prs: S.prs?.length || '' };
  $$('#nav a').forEach((a, i) => {
    const [icon, label] = TABS[a.dataset.tab];
    a.title = `${label} (⌘${i + 1})`;
    a.innerHTML = `${ic(icon)}<span class="lbl">${a.dataset.tab === 'prs' ? 'PRs' : label}</span><span class="Counter">${counts[a.dataset.tab] ?? ''}</span>`;
  });
  markTab();
}
function markTab() {
  const n = route().name;
  $$('#nav a').forEach(a => { a.classList.toggle('selected', a.dataset.tab === n); a.toggleAttribute('aria-current', a.dataset.tab === n); });
}

function renderStatusbar() {
  const s = S.status, onMain = s.branch === s.main;
  const parts = [`${ic('branch')}<b>${esc(s.branch || '(detached)')}</b>`];
  if (s.unpushed || s.behindUpstream) parts.push(`<span title="vs ${esc(s.upstream)}">↑${s.unpushed || 0} ↓${s.behindUpstream || 0}</span>`);
  if (!onMain && (s.aheadMain || s.behindMain)) parts.push(`${s.aheadMain || 0} ahead, ${s.behindMain || 0} behind ${esc(s.base || s.main)}`);
  parts.push(s.fileBehind ? `<span class="danger">${ic('alert')}${esc(fileLabel(s))} is behind</span>`
    : s.dirty ? `<span class="attention">${ic('dot')}${plural(s.dirty, 'unsaved change')}</span>`
      : s.synced ? `<span>${ic('check', 'success')}${esc(fileLabel(s))} in sync</span>` : `<span class="muted">${esc(fileLabel(s))}: not scanned yet</span>`);
  if (s.head) parts.push(`<span class="sha">${esc(s.head)}</span> <span class="ellipsis">${esc(s.headSubject)}</span>`);
  $('#sb').innerHTML = parts.map(p => `<span class="sb-item">${p}</span>`).join('');
}

// ---------- review helpers ----------
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
// Each view has a list pane and a detail pane. Picking another item only repaints the detail.
let seq = 0, shownKey = null;
async function render(force = false) {
  if (!S.status) return; // boot renders once status is in
  const { name, params } = route();
  markTab();
  const v = views[name], key = name + '|' + (v.key ? v.key(params) : '');
  const mine = ++seq;
  const alive = () => mine === seq;
  try {
    if (force || key !== shownKey) {
      if (!key.startsWith(shownKey?.split('|')[0] + '|')) $('#view').innerHTML = '';
      await v.list($('#list'), params, alive);
      if (!alive()) return;
      shownKey = key;
    }
    markSel();
    await v.detail($('#view'), params, alive);
  } catch (e) { if (alive()) $('#view').innerHTML = `<div class="pad">${flash('error', 'alert', `<strong>Something went wrong.</strong> ${esc(e.message)}`)}</div>`; }
}
function markSel() {
  const { name, params } = route();
  const k = views[name].sel?.(params) ?? '';
  $$('#list [data-sel]').forEach(a => {
    const on = a.dataset.sel === k;
    a.classList.toggle('selected', on);
    if (on) a.scrollIntoView({ block: 'nearest' });
  });
}
function paint(el, alive, html) {
  if (!alive()) return false;
  el.innerHTML = html;
  return true;
}
async function refresh() {
  await refreshStatus();
  await render(true);
  refreshPRs();
}

// One object's diff, filling the detail pane: GitHub Desktop's right side.
function fileDiff(el, c, range = []) {
  el.innerHTML = `<div class="vfill file single" data-path="${esc(c.path)}">
    <div class="pane-head">${statIcon(c.status)}<strong class="ellipsis">${esc(c.name)}</strong><span class="type-tag">${esc(c.type)}</span>
      <span class="path ellipsis grow">${esc(c.path)}</span>${diffToggle()}
      <a class="btn btn-sm btn-octicon" href="#/objects?${q({ path: c.path })}" title="Open object" aria-label="Open object">${ic('eye')}</a></div>
    <div class="file-body scroll"><div class="blankslate"><span class="muted">Loading diff…</span></div></div></div>`;
  loadDiff($('.file', el), c, range);
}

// Swim lanes for the commit list, one SVG per row: GitKraken's graph, small.
const LANE = ['#0969da', '#8250df', '#1a7f37', '#bf3989', '#bc4c00', '#0598bc', '#9a6700'];
function graph(commits) {
  const H = 44, W = 14, mid = H / 2, x = i => 9 + i * W;
  let lanes = [], max = 1;
  const rows = commits.map(c => {
    const before = lanes.slice();
    let me = lanes.indexOf(c.hash);
    const tip = me < 0;
    if (tip) { me = lanes.indexOf(null); if (me < 0) me = lanes.length; }
    const seg = [];
    before.forEach((h, i) => {
      if (!h || i === me) return;
      if (h === c.hash) { seg.push([i, 0, me, mid, i]); lanes[i] = null; } // another lane ends here
      else seg.push([i, 0, i, H, i]); // passes through
    });
    if (!tip) seg.push([me, 0, me, mid, me]);
    lanes[me] = c.parents[0] || null;
    if (lanes[me]) seg.push([me, mid, me, H, me]);
    for (const p of c.parents.slice(1)) {
      let j = lanes.indexOf(p);
      if (j < 0) { j = lanes.indexOf(null); if (j < 0) j = lanes.length; lanes[j] = p; }
      seg.push([me, mid, j, H, j]);
    }
    while (lanes.length && !lanes.at(-1)) lanes.pop();
    max = Math.max(max, lanes.length, me + 1);
    return { me, seg, merge: c.parents.length > 1 };
  });
  const w = x(Math.min(max, 10) - 1) + 9;
  return rows.map(r => `<svg class="graph" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}" aria-hidden="true">${r.seg.map(([a, y1, b, y2, col]) =>
    `<path d="M${x(a)} ${y1}${a === b ? `V${y2}` : `C${x(a)} ${(y1 + y2) / 2} ${x(b)} ${(y1 + y2) / 2} ${x(b)} ${y2}`}" stroke="${LANE[col % LANE.length]}"/>`).join('')}
    <circle cx="${x(r.me)}" cy="${mid}" r="${r.merge ? 3 : 4.5}" fill="${r.merge ? 'var(--canvas)' : LANE[r.me % LANE.length]}" stroke="${LANE[r.me % LANE.length]}"/></svg>`);
}

const groupRows = (list, group, row) => {
  const g = {};
  list.forEach(x => (g[group(x)] ||= []).push(x));
  return Object.entries(g).map(([k, xs]) => `<div class="group-label">${esc(k)}</div>${xs.map(row).join('')}`).join('');
};
const draft = { sum: '', desc: '', branch: '' };

// ---------- views ----------
const views = {
  changes: {
    sel: p => p.get('path') || D.changes?.[0]?.path || '',
    async list(el, p, alive) {
      const s = S.status, list = await api('changes'), onMain = s.branch === s.main;
      D.changes = list;
      if (!paint(el, alive, `
        <div class="pane-head"><strong class="grow">${plural(list.length, 'changed object')}</strong>${runBtn('snapshot', '', { icon: 'sync', cls: 'btn-sm btn-octicon', title: 'Re-scan FileMaker file' })}</div>
        ${list.length > 8 ? '<div class="list-filter"><input class="form-control" id="cfilter" type="search" placeholder="Filter" aria-label="Filter changed objects"></div>' : ''}
        <div class="list-body" id="ctree">${groupRows(list, c => c.type, c => `<a class="row" href="#/changes?${q({ path: c.path })}" data-sel="${esc(c.path)}" data-name="${esc(c.name.toLowerCase())}">${statIcon(c.status)}<span class="ellipsis grow">${esc(c.name)}</span></a>`)}</div>
        <form class="commitbox" id="commitbox">
          ${onMain ? `<div class="cb-note">${ic('info')}<span>You're on <b>${esc(s.main)}</b>. These changes go to a new branch.</span></div>
            <input class="form-control" id="newbranch" placeholder="New branch, e.g. invoice-tax" aria-label="New branch name">` : ''}
          <input class="form-control" id="summary" placeholder="Summary (required)" aria-label="Commit summary">
          <textarea class="form-control" id="desc" placeholder="Description" aria-label="Description"></textarea>
          <button class="btn btn-primary btn-block" type="submit" ${list.length ? '' : 'disabled'}>Commit to <b class="ellipsis">${esc(onMain ? 'new branch' : s.branch)}</b></button>
          <p class="note">Re-exports ${esc(fileLabel(s))} first. <kbd>⌘</kbd><kbd>Enter</kbd></p>
        </form>`)) return;
      const f = $('#cfilter', el);
      if (f) f.oninput = () => $$('#ctree .row', el).forEach(a => a.classList.toggle('hidden', !a.dataset.name.includes(f.value.toLowerCase())));
      const sum = $('#summary', el), desc = $('#desc', el), nb = $('#newbranch', el);
      sum.value = draft.sum; desc.value = draft.desc;
      if (nb) nb.value = draft.branch;
      el.oninput = () => { draft.sum = sum.value; draft.desc = desc.value; draft.branch = nb?.value || ''; };
      const commit = async () => {
        const m = sum.value.trim(), d = desc.value.trim();
        if (!list.length) return;
        if (onMain && !nb.value.trim()) { nb.focus(); toast('Name the new branch', true); return; }
        if (!m) { sum.focus(); toast('Write a commit summary', true); return; }
        if (onMain && await run('start', [nb.value.trim()]) !== 0) return;
        if (await run('save', ['-m', d ? `${m}\n\n${d}` : m]) === 0) {
          Object.assign(draft, { sum: '', desc: '', branch: '' });
          $$('#summary, #desc, #newbranch').forEach(i => i.value = ''); // the list already repainted with the old draft
        }
      };
      $('#commitbox', el).onsubmit = e => { e.preventDefault(); commit(); };
      desc.onkeydown = e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit(); };
    },
    async detail(el, p, alive) {
      const list = D.changes || [];
      const c = list.find(x => x.path === p.get('path')) || list[0];
      if (!c) return paint(el, alive, noChanges());
      fileDiff(el, c);
    },
  },

  history: {
    key: p => `${p.get('all')}|${p.get('p')}`,
    sel: p => p.get('c') || D.commits?.[0]?.hash || '',
    async list(el, p, alive) {
      const all = p.get('all') === '1', only = p.get('p');
      const commits = await api('log?' + q({ all: all ? '1' : '', path: only }));
      D.commits = commits;
      const g = only ? [] : graph(commits); // a path-filtered log has gaps, no graph
      paint(el, alive, `
        <div class="pane-head"><div class="seg grow">
          <a class="${all ? '' : 'selected'}" href="#/history?${q({ p: only })}">${ic('branch')}<span class="ellipsis">${esc(S.status.branch || 'HEAD')}</span></a>
          <a class="${all ? 'selected' : ''}" href="#/history?${q({ all: '1', p: only })}">All branches</a></div></div>
        ${only ? `<div class="list-chip">${ic('file')}<span class="ellipsis grow" title="${esc(only)}">${esc(only.split('/').pop())}</span><a href="#/history${all ? '?all=1' : ''}" title="Show all objects" aria-label="Clear filter">${ic('x')}</a></div>` : ''}
        <div class="list-body">${commits.map((c, i) => `<a class="row commit" href="#/history?${q({ all: all ? '1' : '', p: only, c: c.hash })}" data-sel="${c.hash}">
          ${g[i] || `<span class="nograph">${ic('commit')}</span>`}<span class="stack"><span class="ellipsis subj">${esc(c.subject)}</span>
          <span class="meta">${avatar(c.author)}<span class="ellipsis">${esc(c.author)} · ${when(c.date)}</span>${refLabels(c.refs)}</span></span></a>`).join('') || '<div class="list-empty">No commits yet</div>'}</div>`);
    },
    async detail(el, p, alive) {
      const h = views.history.sel(p);
      if (!h) return paint(el, alive, blank('history', 'No commits yet', 'Your first commit shows up here.'));
      const r = await api('commit?' + q({ hash: h }));
      const c = r.commit, only = p.get('p');
      const cur = r.changes.find(x => x.path === only) || r.changes[0];
      if (!paint(el, alive, `<div class="vfill">
        <div class="commit-head">
          <div class="flex top"><h2 class="grow">${esc(c.subject)}</h2>${r.changes.length ? `<button class="btn btn-sm" id="cpatch">${ic('package')}Export as patch</button>` : ''}</div>
          ${c.body ? `<pre class="cbody">${esc(c.body)}</pre>` : ''}
          <div class="meta">${avatar(c.author)}<strong>${esc(c.author)}</strong> committed ${when(c.date)}<span class="dotsep"></span><span class="sha">${esc(c.short)}</span>
            ${c.parents.length > 1 ? `<span class="dotsep"></span>merge of ${c.parents.map(x => `<a class="sha" href="#/history?${q({ all: '1', c: x })}">${esc(x.slice(0, 7))}</a>`).join(' + ')}` : ''}
            <span class="dotsep"></span>${plural(r.changes.length, 'changed object')}${refLabels(c.refs)}</div>
          <div id="cdl"></div>
        </div>
        ${r.changes.length ? `<div class="split2"><div class="list-body" id="cfiles">${r.changes.map(x => `<a class="row ${x === cur ? 'selected' : ''}" href="#" data-f="${esc(x.path)}">${statIcon(x.status)}<span class="ellipsis grow">${esc(x.name)}</span><span class="type-tag">${esc(x.type)}</span></a>`).join('')}</div><div id="cdiff"></div></div>`
          : blank('diff', 'No FileMaker objects changed', 'This commit only touched project files.')}</div>`)) return;
      if (!cur) return;
      fileDiff($('#cdiff', el), cur, r.range);
      $('#cfiles', el).onclick = e => {
        const a = e.target.closest('[data-f]');
        if (!a) return;
        e.preventDefault();
        $$('#cfiles .row', el).forEach(b => b.classList.toggle('selected', b === a));
        fileDiff($('#cdiff', el), r.changes.find(x => x.path === a.dataset.f), r.range);
      };
      $('#cpatch', el).onclick = async () => {
        if (await run('patch', ['-o', 'build/patch.xml', ...r.range]) === 0)
          $('#cdl').innerHTML = `<div class="mt-s flex wrap">${dlLinks('patch.xml', 'btn-sm')}</div>`;
      };
    },
  },

  objects: {
    sel: p => p.get('path') || '',
    async list(el, p, alive) {
      const cats = await api('objects');
      D.cats = cats;
      if (!cats.length) return paint(el, alive, '<div class="pane-head"><strong>Objects</strong></div><div class="list-empty">Scan and commit your FileMaker file once; every table, script and layout shows up here.</div>');
      const path = p.get('path');
      const prim = cats.filter(c => !c.secondary), sec = cats.filter(c => c.secondary);
      const total = prim.reduce((n, c) => n + c.objects.length, 0);
      const catHTML = c => `<details ${path && path.startsWith(c.dir + '/') ? 'open' : ''} data-dir="${esc(c.dir)}"><summary>${ic('chev', 'chev')}${ic('folder', 'folder')}<span class="ellipsis">${esc(c.secondary ? c.dir : c.label)}</span><span class="count">${c.objects.length}</span></summary><div class="items"></div></details>`;
      if (!paint(el, alive, `
        <div class="pane-head"><strong class="grow">Objects</strong><span class="Counter">${total}</span></div>
        <div class="list-filter"><input class="form-control" id="search" type="search" placeholder="Go to object…   /" aria-label="Find object">
          <label class="small muted flex"><input type="checkbox" id="fulltext"> Search inside calculations &amp; scripts</label></div>
        <div class="list-body tree" id="tree">${prim.map(catHTML).join('')}${sec.length ? `<div class="group-label">Parts</div>${sec.map(catHTML).join('')}` : ''}</div>
        <div class="list-body hidden" id="results"></div>`)) return;
      const fillCat = d => {
        const c = cats.find(x => x.dir === d.dataset.dir);
        $('.items', d).innerHTML = c.objects.map(o => o.folder === 'Marker'
          ? '<div class="sep-row">────────</div>'
          : `<a class="row" href="#/objects?${q({ path: o.path })}" data-sel="${esc(o.path)}">${ic(o.folder === 'True' ? 'folder' : 'file')}<span class="ellipsis">${esc(o.name)}</span></a>`).join('') || '<div class="sep-row">empty</div>';
        markSel();
      };
      $$('#tree details', el).forEach(d => {
        if (d.open) fillCat(d);
        d.addEventListener('toggle', () => { if (d.open && !$('.items', d).children.length) fillCat(d); });
      });
      let timer;
      const results = (html) => { $('#tree', el).classList.toggle('hidden', html == null); $('#results', el).classList.toggle('hidden', html == null); $('#results', el).innerHTML = html ?? ''; markSel(); };
      const hit = (o, extra = '') => `<a class="row hit" href="#/objects?${q({ path: o.path })}" data-sel="${esc(o.path)}"><span class="stack"><span class="flex"><strong class="ellipsis grow">${esc(o.name)}</strong><span class="type-tag">${esc(o.type)}</span></span>${extra}</span></a>`;
      const search = () => {
        clearTimeout(timer);
        const term = $('#search', el).value.trim();
        if (!term) return results(null);
        if (!$('#fulltext', el).checked) {
          const hits = prim.flatMap(c => c.objects.filter(o => o.folder !== 'Marker' && o.name.toLowerCase().includes(term.toLowerCase())).map(o => ({ ...o, type: c.label }))).slice(0, 200);
          return results(`<div class="group-label">${plural(hits.length, 'object')}</div>${hits.map(o => hit(o)).join('') || '<div class="list-empty">Nothing found. Try searching inside calculations.</div>'}`);
        }
        if (term.length < 2) return;
        timer = setTimeout(async () => {
          const res = await api('search?' + q({ q: term }));
          const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
          results(`<div class="group-label">${plural(res.length, 'object')} mention “${esc(term)}”</div>${res.map(r => hit(r, r.hits.slice(0, 3).map(h =>
            `<span class="snip"><span class="subtle">${h.n}</span> ${esc(h.text.trim()).replace(re, m => `<mark>${m}</mark>`)}</span>`).join(''))).join('') || '<div class="list-empty">No matches.</div>'}`);
        }, 220);
      };
      $('#search', el).oninput = search;
      $('#fulltext', el).onchange = search;
    },
    async detail(el, p) {
      const path = p.get('path');
      path ? objectView(el, path) : overview(el, D.cats || []);
    },
  },

  branches: {
    sel: p => p.get('b') || S.status.branch,
    async list(el, p, alive) {
      const bs = await api('branches');
      D.branches = bs;
      const prOf = b => S.prs?.find(x => x.headRefName === b.name);
      const row = b => `<a class="row" href="#/branches?${q({ b: b.name })}" data-sel="${esc(b.name)}">
        <span class="lead">${b.current ? ic('check', 'accent') : ic('branch', 'muted')}</span>
        <span class="stack"><span class="ellipsis ${b.current ? 'strong' : ''}">${esc(b.name)}</span><span class="meta"><span class="ellipsis">${when(b.date)} · ${esc(b.author)}</span></span></span>
        ${prOf(b) ? prIcon(prOf(b)) : ''}${b.main ? '' : `<span class="ab-mini" title="${b.behind || 0} behind, ${b.ahead || 0} ahead of ${esc(S.status.base || S.status.main)}">${b.behind ? `↓${b.behind}` : ''} ${b.ahead ? `↑${b.ahead}` : ''}</span>`}</a>`;
      if (!paint(el, alive, `
        <div class="pane-head"><strong class="grow">Branches</strong><span class="Counter">${bs.length}</span></div>
        <form class="list-filter flex" id="mkb"><input class="form-control" id="newbranch" placeholder="New branch name" aria-label="New branch name"><button class="btn btn-sm" type="submit">${ic('plus')}Create</button></form>
        <div class="list-body"><div class="group-label">Default branch</div>${bs.filter(b => b.main).map(row).join('')}
          <div class="group-label">Branches</div>${bs.filter(b => !b.main).map(row).join('') || '<div class="list-empty">No feature branches yet.</div>'}</div>`)) return;
      $('#mkb', el).onsubmit = e => { e.preventDefault(); const n = $('#newbranch', el).value.trim(); n ? run('start', [n]) : $('#newbranch', el).focus(); };
    },
    async detail(el, p, alive) {
      const s = S.status, name = views.branches.sel(p);
      const b = D.branches?.find(x => x.name === name);
      if (!b) return paint(el, alive, blank('branch', 'No branch selected', ''));
      const commits = await api('log?' + q({ ref: b.name }));
      const pr = S.prs?.find(x => x.headRefName === b.name);
      const acts = [
        b.current ? '' : runBtn('switch', 'Switch to branch', { cls: 'btn-primary', icon: 'branch', args: [b.name] }),
        pr ? `<a class="btn" href="#/prs?n=${pr.number}">${prIcon(pr)}Pull request #${pr.number}</a>`
          : b.current && !b.main && s.forgeReady && b.ahead ? runBtn('pr', 'Open pull request', { icon: 'pr' }) : '',
        b.current ? `<a class="btn" href="#/history">${ic('history')}History</a>` : '',
      ].join('');
      paint(el, alive, `<div class="pad">
        <div class="flex wrap mb"><h2 class="branch-title">${ic('branch')}${esc(b.name)}</h2>${b.current ? '<span class="Label Label--accent">current</span>' : ''}${b.main ? '<span class="Label">default</span>' : ''}<span class="grow"></span>${acts}</div>
        <div class="facts">
          ${b.main ? '' : `<div><span class="muted">Compared to ${esc(s.base || s.main)}</span><strong>${b.ahead || 0} ahead · ${b.behind || 0} behind</strong></div>`}
          <div><span class="muted">Remote</span><strong>${b.upstream ? esc(b.upstream) + (b.track ? ` ${esc(b.track)}` : '') : 'Not published'}</strong></div>
          <div><span class="muted">Last commit</span><strong>${when(b.date)} by ${esc(b.author)}</strong></div>
        </div>
        ${b.current ? '' : `<p class="note">Switching changes the files in <code>${esc(s.src)}/</code>, not your .fmp12. fmgit tells you when your file needs <em>Apply</em>.</p>`}
        <h3 class="sub">Commits</h3>
        <div class="Box">${commits.slice(0, 60).map(c => `<a class="Box-row hover clink" href="#/history?${q({ all: '1', c: c.hash })}">${avatar(c.author)}<span class="grow ellipsis">${esc(c.subject)}</span><span class="muted small nowrap">${esc(c.author)} · ${when(c.date)}</span><span class="sha muted">${esc(c.short)}</span></a>`).join('') || '<div class="Box-body muted">No commits.</div>'}</div>
      </div>`);
    },
  },

  prs: {
    key: p => p.get('state') || 'open',
    sel: p => p.get('n') || String(D.prs?.[0]?.number || ''),
    async list(el, p, alive) {
      const s = S.status;
      if (!s.forgeReady) { D.prs = []; return paint(el, alive, '<div class="pane-head"><strong>Pull requests</strong></div><div class="list-empty">Not connected to a git host.</div>'); }
      const state = p.get('state') || 'open';
      const list = await api('prs?state=' + state);
      D.prs = list;
      paint(el, alive, `
        <div class="pane-head"><div class="seg grow">${[['open', 'Open'], ['merged', 'Merged'], ['closed', 'Closed'], ['all', 'All']].map(([k, l]) =>
          `<a href="#/prs?state=${k}" class="${k === state ? 'selected' : ''}">${l}</a>`).join('')}</div></div>
        <div class="list-body">${list.map(x => `<a class="row pr" href="#/prs?${q({ state, n: x.number })}" data-sel="${x.number}">
          <span class="lead">${prIcon(x)}</span><span class="stack"><span class="ellipsis subj">${esc(x.title)}</span>
          <span class="meta"><span class="ellipsis">#${x.number} by ${esc(x.author?.login)} · ${when(x.state === 'MERGED' ? x.mergedAt || x.updatedAt : x.createdAt || x.updatedAt)}</span></span>
          <span class="meta">${reviewLabel(x)}${x.autoMergeRequest ? '<span class="Label Label--accent">auto-merge</span>' : ''}</span></span>${checksIcon(x.statusCheckRollup)}</a>`).join('')
          || `<div class="list-empty">No ${state === 'all' ? '' : state + ' '}pull requests.</div>`}</div>`);
    },
    async detail(el, p, alive) {
      const s = S.status;
      if (!s.forgeReady) return paint(el, alive, forgeBlank(s));
      const n = views.prs.sel(p);
      if (!n) return paint(el, alive, blank('pr', 'No pull request selected', 'Push a branch and open one; it shows up here for review.',
        s.branch !== s.main && s.aheadMain && !myPR() ? runBtn('pr', 'Open pull request', { cls: 'btn-primary', icon: 'pr' }) : ''));
      await prDetail(el, n, p, alive);
    },
  },

  settings: {
    sel: () => '',
    async list(el, p, alive) {
      const s = S.status;
      paint(el, alive, `<div class="pane-head"><strong>Settings</strong></div><div class="list-body">
        ${[['general', 'gear', 'General'], ['filemaker', 'tools', 'FileMaker tools'], ['forge', 'repo', 'Git host'], ['credentials', 'key', 'Credentials'], ['checks', 'shield', 'Checks & protection'], ['deploy', 'package', 'Deploy']]
          .map(([id, icon, l]) => `<a class="row" href="#s-${id}" data-jump>${ic(icon, 'muted')}<span>${esc(id === 'forge' && s.forge ? forgeName() : l)}</span></a>`).join('')}</div>`);
      $$('[data-jump]', el).forEach(a => a.onclick = e => {
        e.preventDefault();
        $$('[data-jump]', el).forEach(x => x.classList.toggle('selected', x === a));
        $(a.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth' });
      });
    },
    detail: settingsView,
  },
};

// GitHub Desktop's "No local changes" page, with the next steps that make sense right now.
function noChanges() {
  const s = S.status, pr = myPR(), onMain = s.branch === s.main;
  const card = (title, text, action) => `<div class="card"><div class="grow"><strong>${title}</strong><p>${text}</p></div>${action}</div>`;
  const cards = [
    s.fileBehind && card('Apply your teammates\' changes', `${esc(fileLabel(s))} is behind this branch. Close it in FileMaker first.`, runBtn('apply', 'Apply to file', { cls: 'btn-primary', icon: 'pull' })),
    card('Scan your FileMaker file', 'Work in FileMaker as usual, close the file, then scan it: every changed script, field and layout shows up on the left.', runBtn('snapshot', 'Scan file', { cls: s.fileBehind ? '' : 'btn-primary', icon: 'sync' })),
    s.remote && (s.unpushed || (!s.upstream && !onMain)) && card(`Push ${s.unpushed ? plural(s.unpushed, 'commit') : 'this branch'} to origin`, 'So your team and CI can see it.', runBtn('push', 'Push origin', { icon: 'push' })),
    !onMain && s.aheadMain && !pr && s.forgeReady && card('Open a pull request', `${plural(s.aheadMain, 'commit')} on <b>${esc(s.branch)}</b> are ready for review.`, runBtn('pr', 'Open pull request', { icon: 'pr' })),
    pr && card(`Pull request #${pr.number}`, `${esc(pr.title)} · ${reviewText(pr)}`, `<a class="btn" href="#/prs?n=${pr.number}">${ic('pr')}View</a>`),
    card('Browse the solution', 'Scripts, tables, layouts and the history of each.', `<a class="btn" href="#/objects">${ic('file')}Objects</a>`),
  ].filter(Boolean).join('');
  return `<div class="nochanges"><h2>No local changes</h2><p class="muted">There are no uncommitted changes in ${esc(fileLabel(s))}. Some friendly suggestions for what to do next:</p>${cards}</div>`;
}

async function prDetail(el, n, p, alive) {
  const r = await api('pr?' + q({ n }));
  const pr = r.pr;
  const open = pr.state === 'OPEN';
  const url = /^https?:\/\//.test(pr.url || '') ? pr.url : '';
  const tab = p.get('tab') || 'conversation';
  const st = pr.state === 'MERGED' ? ['merged', 'merged', 'Merged'] : pr.state === 'CLOSED' ? ['closed', 'prClosed', 'Closed'] : pr.isDraft ? ['draft', 'pr', 'Draft'] : ['open', 'pr', 'Open'];
  if (!paint(el, alive, `<div class="pad">
    <div class="flex top"><h1 class="pr-title grow">${esc(pr.title)} <span class="muted">#${pr.number}</span></h1>
      ${url ? `<a class="btn btn-sm" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${ic('ext')}Open on ${esc(forgeName())}</a>` : ''}</div>
    <div class="pr-meta"><span class="State State--${st[0]}">${ic(st[1])}${st[2]}</span>
      <span><strong>${esc(pr.author?.login)}</strong> ${pr.state === 'MERGED' ? 'merged' : 'wants to merge'} into <span class="branch-name">${esc(pr.baseRefName)}</span> from <span class="branch-name">${esc(pr.headRefName)}</span></span></div>
    <div class="subnav"><button data-tab="conversation" class="${tab === 'conversation' ? 'selected' : ''}">${ic('comment')}Conversation</button>
      <button data-tab="files" class="${tab === 'files' ? 'selected' : ''}">${ic('diff')}FileMaker changes <span class="Counter">${r.changes.length}</span></button></div>
    <div id="tabbody"></div></div>`)) return;
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
  $$('.subnav [data-tab]', el).forEach(b => b.onclick = () => { setParam('tab', b.dataset.tab); $$('.subnav [data-tab]', el).forEach(x => x.classList.toggle('selected', x === b)); show(b.dataset.tab); });
  show(tab);
}

async function settingsView(el, p, alive) {
  const [c, s] = await Promise.all([api('config'), api('status')]);
  const ok = (good, title, yes, no) => `<li>${good ? ic('check', 'success') : ic('x', 'danger')}<div><strong>${title}</strong><div class="note" style="margin:0">${good ? yes : no}</div></div></li>`;
  const field = (name, label, value, note = '', attrs = '') => `<div class="form-group"><label for="cfg-${name}">${label}</label><input class="form-control" id="cfg-${name}" name="${name}" value="${esc(value ?? '')}" ${attrs}>${note ? `<p class="note">${note}</p>` : ''}</div>`;
  if (!paint(el, alive, `<div class="pad narrow">
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
  </div>`)) return;
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
}
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
  el.innerHTML = `<div class="pad"><div class="Box"><div class="Box-header"><h3 class="Box-title">${ic('repo')} ${esc(S.status.file || 'Solution')}</h3><span class="muted small">as of your last scan</span></div>
    <table class="data"><thead><tr><th>Catalog</th><th>Objects</th><th></th></tr></thead><tbody>${cats.filter(c => !c.secondary).map(c => `
      <tr><td>${ic('folder', 'folder')} <strong>${esc(c.label)}</strong></td><td>${c.objects.filter(o => o.folder !== 'Marker').length}</td>
      <td class="muted small ellipsis" style="max-width:420px">${esc(c.objects.filter(o => o.folder !== 'Marker').slice(0, 6).map(o => o.name).join(', '))}${c.objects.length > 6 ? ' …' : ''}</td></tr>`).join('')}</tbody></table></div></div>`;
}

async function objectView(el, path) {
  el._path = path;
  el.innerHTML = '<div class="pad muted">Loading…</div>';
  let o, last;
  try { [o, last] = await Promise.all([api('object?' + q({ path })), api('log?' + q({ path })).catch(() => [])]); }
  catch (e) { if (el._path === path) el.innerHTML = `<div class="pad">${flash('error', 'alert', esc(e.message))}</div>`; return; }
  if (el._path !== path) return;
  const c = last[0];
  const label = pt => (pt.kind === 'fields' ? `Fields (${pt.fields?.length || 0})` : pt.kind === 'script' ? 'Script' : pt.kind === 'calc' ? 'Calculation' : `${pt.label} XML`) + (pt.dir.split('/').pop().includes('.') ? ' · 2nd pass' : '');
  el.innerHTML = `<div class="pad">
    <div class="flex mb obj-crumb"><a href="#/objects">${esc(S.status.repo)}</a><span class="muted">/</span><span>${esc(o.type)}</span><span class="muted">/</span><strong class="ellipsis">${esc(o.name)}</strong></div>
    ${c ? `<div class="Box mb"><div class="Box-header" style="border-bottom:0;border-radius:6px">${avatar(c.author)}<strong>${esc(c.author)}</strong>
      <a class="ellipsis grow" style="color:var(--fg-muted)" href="#/history?${q({ p: path, c: c.hash })}">${esc(c.subject)}</a>
      <a class="sha muted" href="#/history?${q({ p: path, c: c.hash })}">${esc(c.short)}</a><span class="muted small nowrap">· ${when(c.date)}</span>
      <a class="btn btn-sm" href="#/history?${q({ p: path })}">${ic('history')}${plural(last.length, 'commit')}</a></div></div>` : flash('info', 'info', 'Not committed yet.')}
    <div class="Box">
      <div class="Box-header" style="padding:8px">
        <div class="segtabs grow" role="tablist">${o.parts.map((pt, i) => `<button role="tab" data-part="${i}" class="${i ? '' : 'selected'}">${esc(label(pt))}</button>`).join('')}</div>
        <button class="btn btn-sm" id="raw">XML</button>
      </div>
      <div id="partbody"></div>
    </div></div>`;
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
  const b = $('#theme');
  if (b) b.innerHTML = ic(t === 'dark' ? 'sun' : 'moon');
}
applyTheme(localStorage.getItem('fmgit-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
document.addEventListener('click', e => { if (e.target.closest('#theme')) applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'); });

// Drag the border between list and detail; the width sticks.
const setListW = w => document.documentElement.style.setProperty('--list-w', Math.max(220, Math.min(640, w)) + 'px');
setListW(+localStorage.getItem('fmgit-listw') || 320);
$('#resizer').onpointerdown = e => {
  const r = e.currentTarget, x0 = e.clientX, w0 = $('#list').offsetWidth;
  r.setPointerCapture(e.pointerId);
  r.onpointermove = m => setListW(w0 + m.clientX - x0);
  r.onpointerup = () => { r.onpointermove = null; localStorage.setItem('fmgit-listw', $('#list').offsetWidth); };
};

document.addEventListener('keydown', e => {
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName);
  if (e.key === '/' && !typing) {
    e.preventDefault();
    if (route().name !== 'objects') { location.hash = '#/objects'; setTimeout(() => $('#search')?.focus(), 300); }
    else $('#search')?.focus();
  }
  if ((e.metaKey || e.ctrlKey) && /^[1-6]$/.test(e.key)) {
    e.preventDefault();
    location.hash = $$('#nav a')[e.key - 1].getAttribute('href');
  }
  // Up/down walks the list like a desktop app, as long as focus isn't in the detail pane.
  if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !typing && !e.altKey && !e.metaKey
    && (document.activeElement === document.body || $('#list').contains(document.activeElement))) {
    const rows = $$('#list [data-sel]').filter(a => a.offsetParent);
    if (!rows.length) return;
    e.preventDefault();
    const i = rows.findIndex(a => a.classList.contains('selected'));
    const next = rows[Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    history.replaceState(null, '', next.getAttribute('href'));
    next.focus();
    render();
  }
  if (e.key === 'Escape') openConsole(false);
});
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#/') || !location.hash) render(); });
window.addEventListener('focus', refreshStatus);
setInterval(() => { if (!running && document.visibilityState === 'visible') refreshStatus(); }, 20000);

if (!token) {
  document.body.innerHTML = `<div class="pad">${blank('key', 'Open the link from your terminal', 'Run <code>fmgit ui</code> and use the link it prints: it carries the key for this session.')}</div>`;
} else {
  refreshStatus().then(() => { render(); refreshPRs(); });
}
