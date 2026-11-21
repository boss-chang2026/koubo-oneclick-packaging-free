// 页面契约：
//   window.READY      字体、素材加载完成
//   window.DUR        片长（秒）
//   window.render(t)  画出第 t 秒；纯函数，可乱序调用（逐帧渲染靠它）
//   window.TEXTS(t)   第 t 秒屏幕上的全部文字及其框，供出片前检查使用
// 页面只读 timeline.json（由 compile 生成），不含任何模型推断。
import * as M from './motion.js';
import { douyinRegions, nudgeLeft, KEY_ROLES } from './occlusion.js';
import { hasOrphan } from './layout.js';

const q = new URLSearchParams(location.search);
const TL = await (await fetch('/build/timeline.json')).json();
const S = await (await fetch(`/styles/${TL.style}/style.json`)).json();
const W = S.canvas.w, H = S.canvas.h;

// ---------- 基础 DOM ----------
const css = document.createElement('link');
css.rel = 'stylesheet'; css.href = `/styles/${TL.style}/style.css`;
document.head.append(css);
await new Promise(r => { css.onload = r; css.onerror = r; });

const assetUrl = p => (p.startsWith('/styles/') ? p : `/asset?p=${encodeURIComponent(p)}`);
// 只加载本机实际存在的字体文件（compile 时已核对）；没有就用 style.css 里的系统字体
for (const [family, f] of Object.entries(TL.fonts || {})) {
  const face = new FontFace(family, `url(${assetUrl(f.file)})`, { weight: String(f.weight || 400) });
  try { document.fonts.add(await face.load()); } catch { console.error('字体加载失败：' + family); }
}
const stage = document.getElementById('stage');
stage.style.width = W + 'px'; stage.style.height = H + 'px';
stage.className = `style-${TL.style}`;

export const h = {
  ...M, S, W, H, TL,
  el(tag, cls, parent, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (parent) parent.append(n);
    return n;
  },
  // 文字节点：登记角色，供 TEXTS 与遮挡检查使用
  text(parent, cls, text, role = 'body') {
    const n = h.el('div', cls, parent, text);
    n.dataset.t = text; n.dataset.role = role;
    return n;
  },
  rect(node, [x, y, w, hh]) { Object.assign(node.style, { position: 'absolute', left: x + 'px', top: y + 'px', width: w + 'px', height: hh + 'px' }); return node; },
  // 在 maxW×maxH 内，从 sizes 里挑最大的能放下的字号（同时避免孤字换行）
  fit(node, maxW, maxH, sizes) {
    for (const fs of sizes) {
      node.style.fontSize = fs + 'px';
      if (node.scrollWidth <= maxW + 1 && node.scrollHeight <= maxH + 1 && !hasOrphan(node)) return fs;
    }
    return sizes[sizes.length - 1];
  },
  asset: assetUrl,
};

h.el('div', 'bg', stage);

// ---------- 舞台几何：卡片容器、标题条、内容区（由风格包 stages.card 决定） ----------
function stageGeom(kind, host, seg = {}) {
  const st = S.stages?.[kind], g = st?.[host];
  if (!g) return null;
  const [x, y, w, hh] = g.stage;
  const top = y + st.pad, headH = seg.header ? st.header : 0;
  const bodyTop = top + (headH ? headH + st.gap : 0);
  // 小圆窗压在舞台左下角时，内容区从圆窗右侧 30px 开始，避免被人物盖住
  const hostRight = host === 'circle' ? g.host[0] + g.host[2] + 30 : 0;
  const bx = Math.max(x + st.pad, hostRight), bw = x + w - st.pad - bx, tw = Math.min(bw, (S.textRight ?? 1e9) - bx);
  return { stage: [x, y, w, hh], host: g.host, header: [bx, top, bw, headH],
    body: [bx, bodyTop, tw, y + hh - st.pad - bodyTop], bodyRaw: [bx, bodyTop, bw, y + hh - st.pad - bodyTop] };
}
h.body = (seg, raw) => stageGeom(seg.stage, seg.host, seg)?.[raw ? 'bodyRaw' : 'body'];

const stageBox = h.el('div', 'k-stage', stage);
const heads = h.el('div', 'layer', stage); heads.style.zIndex = 9;
const hostBox = h.el('div', 'host', stage);
const hostImg = h.el('img', 'host-img', hostBox);
hostImg.style.objectPosition = S.host.objectPosition || '50% 35%';
const layer = h.el('div', 'layer', stage);
const over = h.el('div', 'layer', stage); over.style.zIndex = 30; // 人物全屏时，包装叠在人物之上
const capBox = h.el('div', 'caption', stage);
const capText = h.text(capBox, 'caption-text', '', 'caption');
h.rect(capBox, S.slots.caption);
capBox.style.alignItems = 'center';

// ---------- 人物窗落点 ----------
const slotOf = st => st === 'full' ? [0, 0, W, H] : S.slots[{ rect: 'hostRect', circle: 'hostCircle' }[st]] || [0, 0, W, H];
const radiusOf = (st, r) => st === 'circle' ? r[2] / 2 : st === 'full' ? 0 : (S.host.radius ?? 0);
const hostSlot = e => (e.state === 'full' ? [0, 0, W, H] : stageGeom(e.kind, e.state, e)?.host || slotOf(e.state));

// ---------- 版式动作 ----------
const mods = {};
for (const id of [...new Set(TL.segments.map(s => s.archetype))]) mods[id] = (await import(`/archetypes/${id}.js`)).default;

const segs = TL.segments.map(seg => {
  const root = h.el('div', `seg seg-${seg.archetype}`, seg.host === 'full' ? over : layer);
  root.dataset.segid = seg.id;
  root.style.position = 'absolute'; root.style.inset = '0';
  const ctx = mods[seg.archetype].build(root, seg, h) || {};
  return { seg, root, ctx, mod: mods[seg.archetype], nudge: 0 };
});

// 每段的金色标题条（header）
segs.forEach((x, i) => {
  const g = stageGeom(x.seg.stage, x.seg.host, x.seg), prev = segs[i - 1]?.seg;
  x.head = null;
  if (!g || !x.seg.header) return;
  const box = h.el('div', '', heads); box.style.position = 'absolute'; box.style.inset = '0'; box.dataset.seg = x.seg.id;
  const bar = h.rect(h.el('div', 'k-hbar', box), g.header), txt = h.text(bar, 'k-hbar-text', x.seg.header, 'title');
  txt.style.fontSize = (S.headerFixed || 64) + 'px'; // 标题条全片统一字号与位置，不随文字长短缩放
  const same = prev && prev.stage === x.seg.stage && prev.host === x.seg.host && prev.header === x.seg.header;
  x.head = { box, bar, txt, stay: same };
});

await document.fonts.ready;
await Promise.all([...stage.querySelectorAll('.seg img')].map(i => i.decode().catch(() => console.error('图片加载失败 ' + i.src))));
for (const x of segs) x.mod.layout?.(x.root, x.seg, x.ctx, h);

// ---------- 人物窗：在 full / rect / circle 之间平滑形变 ----------
function hostAt(t) {
  const tr = TL.hostTrack;
  let i = tr.findIndex(k => t < k.t1);
  if (i < 0) i = tr.length - 1;
  const cur = tr[i], prev = tr[i - 1];
  const dur = S.host.morph ?? 0.35;
  const k = prev ? M.ease.inOutCubic(M.prog(t, cur.t0 - dur * 0.4, dur)) : 1;
  const from = prev?.state ?? cur.state, to = cur.state;
  const a = hostSlot(prev ?? cur), b = hostSlot(cur);
  const r = a.map((v, j) => M.lerp(v, b[j], k));
  const rad = M.lerp(radiusOf(from, a), radiusOf(to, b), k);
  return { r, rad, o: 1, k, state: k >= 1 ? to : from };
}
// 主播在人物窗水平正中、脸在上部约三分之一（全屏时不动）
function hostCrop(r) {
  const [fx, fy] = TL.aroll?.focus || [0.5, 0.34], [, , w, hh] = r, sc = Math.max(w / W, hh / H), dw = W * sc, dh = H * sc;
  const ox = Math.min(0, Math.max(w - dw, w / 2 - fx * dw)), oy = Math.min(0, Math.max(hh - dh, hh * 0.36 - fy * dh));
  return `${ox.toFixed(1)}px ${oy.toFixed(1)}px`;
}
async function drawHost(t) {
  const s = hostAt(t);
  h.rect(hostBox, s.r);
  hostImg.style.objectPosition = hostCrop(s.r);
  hostBox.style.borderRadius = s.rad + 'px';
  hostBox.dataset.state = s.state;
  if (!TL.aroll) return;
  const n = Math.min(TL.aroll.count, Math.max(1, Math.floor((t + TL.aroll.offset) * TL.aroll.fps) + 1));
  const src = `${TL.aroll.frames}/${String(n).padStart(6, '0')}.jpg`;
  if (hostImg.getAttribute('src') !== src) { hostImg.src = src; try { await hostImg.decode(); } catch {} }
}

// ---------- 字幕：单行，长句已在 compile 分页 ----------
function drawCaption(t) {
  const c = TL.captions.find(c => t >= c.t0 && t < c.t1);
  const txt = c ? c.text : '';
  if (capText.textContent !== txt) { capText.textContent = txt; capText.dataset.t = txt; }
  capBox.style.opacity = txt ? 1 : 0;
}

// ---------- 版面均衡 + 平台遮挡避让：按每段落稳状态测一次 ----------
const regions = douyinRegions(W, H);
// 文字实际占的范围：居中排版的字只算字形本身；带底色的标签算到底色
function inkBox(n) {
  const cs = getComputedStyle(n);
  if (cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.display.startsWith('inline')) return n.getBoundingClientRect();
  const r = document.createRange(); r.selectNodeContents(n);
  const b = r.getBoundingClientRect();
  return b.width ? b : n.getBoundingClientRect();
}
function effOpacity(n) {
  let o = 1;
  for (let p = n; p && p !== document.body; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    o *= parseFloat(cs.opacity);
  }
  return o;
}
function measureKeys(root) {
  const sr = stage.getBoundingClientRect();
  return [...root.querySelectorAll('[data-role]')].filter(n => KEY_ROLES.includes(n.dataset.role) && n.dataset.t && effOpacity(n) > 0.05).map(n => {
    const b = inkBox(n);
    return { x0: b.left - sr.left, y0: b.top - sr.top, x1: b.right - sr.left, y1: b.bottom - sr.top, fontSize: parseFloat(getComputedStyle(n).fontSize) };
  }).filter(b => b.x1 > b.x0);
}
// 内容整体范围（全部内容都已出现时），用于在内容区里居中
function contentBox(root) {
  const sr = stage.getBoundingClientRect();
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const n of root.querySelectorAll('*')) {
    if (n.closest('svg') && n.tagName !== 'svg') continue;
    const cs = getComputedStyle(n);
    const visible = n.dataset.t || n.tagName === 'IMG' || n.tagName === 'svg' || cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || cs.backgroundImage !== 'none' || parseFloat(cs.borderTopWidth) > 0;
    if (!visible) continue;
    const b = n.dataset.t ? inkBox(n) : n.getBoundingClientRect();
    if (b.width < 2 || b.height < 2 || effOpacity(n) < 0.05) continue;
    x0 = Math.min(x0, b.left - sr.left); y0 = Math.min(y0, b.top - sr.top); x1 = Math.max(x1, b.right - sr.left); y1 = Math.max(y1, b.bottom - sr.top);
  }
  return x1 > x0 ? { x0, y0, x1, y1 } : null;
}
const MAX_NUDGE = 120;
for (const x of segs) {
  x.bal = [0, 0];
  if (x.seg.stage === 'none' || Object.keys(x.seg.media || {}).length) continue;
  const body = h.body(x.seg); if (!body) continue;
  await x.mod.render(x.root, (x.seg.t1 - x.seg.t0) * 0.9, x.seg, x.ctx, h);
  const b = contentBox(x.root); if (!b) continue;
  const [bx, by, bw, bh] = body;
  let dx = bx + bw / 2 - (b.x0 + b.x1) / 2, dy = by + bh / 2 - (b.y0 + b.y1) / 2;
  dx = Math.max(bx - b.x0, Math.min(bx + bw - b.x1, dx));
  if (b.x1 - b.x0 > bw) dx = bx - b.x0;
  dy = Math.max(by - b.y0, Math.min(by + bh - b.y1, dy));
  if (b.y1 - b.y0 > bh) dy = by - b.y0;
  x.bal = [Math.abs(dx) > 6 ? dx : 0, Math.abs(dy) > 6 ? dy : 0];
}
for (const x of segs) {
  const settle = x.seg.t0 + Math.min(1.6, (x.seg.t1 - x.seg.t0) * 0.7);
  x.root.style.translate = `${x.bal[0]}px ${x.bal[1]}px`;
  await x.mod.render(x.root, settle - x.seg.t0, x.seg, x.ctx, h);
  const keys = measureKeys(x.root), hb = hostAt(settle);
  const room = x.seg.host !== 'full' ? Math.min(...keys.map(b => b.x0)) - (hb.r[0] + hb.r[2] + 30) : MAX_NUDGE;
  x.nudge = Math.max(0, Math.min(MAX_NUDGE, room, Math.max(0, ...keys.map(b => nudgeLeft(b, regions)))));
  x.root.style.translate = `${x.bal[0] - x.nudge}px ${x.bal[1]}px`;
}

// ---------- 舞台卡片：同一状态连续段落共用一个容器；换状态时形变 ----------
function drawStage(t) {
  const tr = TL.stageTrack;
  let i = tr.findIndex(k => t < k.t1); if (i < 0) i = tr.length - 1;
  const cur = tr[i], prev = tr[i - 1], dur = S.host.morph ?? 0.35;
  const gc = cur.kind !== 'none' && stageGeom(cur.kind, cur.host, cur), gp = prev && prev.kind !== 'none' && stageGeom(prev.kind, prev.host, prev);
  const k = prev ? M.ease.inOutCubic(M.prog(t, cur.t0 - dur * 0.4, dur)) : 1;
  let r, o;
  if (gc && gp) { r = gp.stage.map((v, j) => M.lerp(v, gc.stage[j], k)); o = 1; }
  else if (gc) { r = gc.stage; o = k; }
  else if (gp) { r = gp.stage; o = 1 - k; }
  else { stageBox.style.opacity = 0; return; }
  h.rect(stageBox, r);
  stageBox.style.opacity = o.toFixed(3);
}
function drawHeads(t) {
  for (const x of segs) {
    if (!x.head) continue;
    const on = t >= x.seg.t0 && t < x.seg.t1, lt = t - x.seg.t0;
    x.head.box.style.display = on ? '' : 'none';
    if (!on) continue;
    const k = x.head.stay ? 1 : M.ease.outCubic(M.prog(lt, 0.08, 0.32));
    x.head.bar.style.clipPath = k < 1 ? `inset(-20px ${((1 - k) * 100).toFixed(2)}% -20px 0)` : '';
    x.head.txt.style.opacity = x.head.stay ? 1 : M.ease.outCubic(M.prog(lt, 0.22, 0.2));
  }
}

// ---------- 主渲染 ----------
window.DUR = TL.dur;
window.render = async t => {
  drawStage(t);
  drawHeads(t);
  await drawHost(t);
  for (const x of segs) {
    const on = t >= x.seg.t0 && t < x.seg.t1;
    x.root.style.display = on ? '' : 'none';
    if (on) await x.mod.render(x.root, t - x.seg.t0, x.seg, x.ctx, h);
  }
  drawCaption(t);
};

window.TEXTS = async t => {
  await window.render(t);
  const sr = stage.getBoundingClientRect();
  return [...stage.querySelectorAll('[data-t]')].filter(n => n.dataset.t && effOpacity(n) > 0.5).map(n => {
    const b = inkBox(n), seg = n.closest('.seg'), hd = n.closest('[data-seg]');
    return { seg: seg ? seg.dataset.segid : hd ? hd.dataset.seg : null, role: n.dataset.role, text: n.dataset.t,
      fontSize: parseFloat(getComputedStyle(n).fontSize),
      x0: b.left - sr.left, y0: b.top - sr.top, x1: b.right - sr.left, y1: b.bottom - sr.top,
      orphan: KEY_ROLES.includes(n.dataset.role) && hasOrphan(n) };
  });
};
window.HOST = t => hostAt(t);
window.NUDGES = segs.filter(x => x.nudge).map(x => ({ seg: x.seg.id, px: x.nudge }));

await window.render(Number(q.get('t') || 0));
window.READY = true;
