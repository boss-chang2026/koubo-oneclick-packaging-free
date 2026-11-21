// 版式动作共用部件。版式只描述「讲法」：在哪个区域、什么时候出现、怎么强调；
// 颜色和字体全部来自风格包的类名（k-title、k-h、k-hl…），换风格不用改这里。
import { textShake, keyed, ease, prog, clamp, lerp } from '/runtime/motion.js';

// 内容区：跟随人物窗状态。大方窗 → 右侧信息区；小圆窗 → 大画面区；全屏 → 全幅
// 文字类内容的右缘收在平台右侧图标列以内（safeRight）；截图等画面可用 raw 取原区域
export function area(seg, h, { raw = false } = {}) {
  const b = seg.stage && seg.stage !== 'none' && h.body?.(seg, raw);
  if (b) return b;
  const S = h.S.slots;
  const [x, y, w, hh] = { rect: S.panel, circle: S.evidence, full: S.full, none: S.full }[seg.host] || S.panel;
  const right = raw ? x + w : Math.min(x + w, h.S.safeRight ?? x + w);
  return [x, y, right - x, hh];
}

// 场景进出：新场景从右侧滑入，旧场景最后 0.1s 左移淡出
export function scene(root, lt, seg, h) {
  const m = h.S.motion, d = seg.t1 - seg.t0;
  const ki = ease.outCubic(prog(lt, 0, m.sceneIn)), ko = ease.inCubic(prog(lt, d - m.exit, m.exit));
  root.style.opacity = (ki * (1 - ko)).toFixed(4);
  root.style.transform = `translateX(${((1 - ki) * m.sceneInDx + ko * m.sceneOutDx).toFixed(2)}px)`;
}

// 放一个绝对定位的盒子
export function box(parent, cls, [x, y, w, hh], h) {
  const n = h.el('div', cls, parent);
  return h.rect(n, [x, y, w, hh]);
}

// 文字在 t0 出现：淡入 + 关键词短震；t0 之前不可见（不会提前铺满）
export function reveal(node, lt, t0, h, { shake = true, base = '' } = {}) {
  if (lt < t0) { node.style.opacity = 0; node.style.transform = base; return false; }
  if (!shake) { const k = ease.outCubic(prog(lt, t0, 0.3)); node.style.opacity = k; node.style.transform = `${base} translateY(${(1 - k) * 22}px)`; return true; }
  const s = textShake(lt, t0, h.S.motion.shake);
  node.style.opacity = s.o;
  node.style.transform = `${base} translate(${s.x.toFixed(2)}px, ${s.y.toFixed(2)}px) rotate(${s.rot.toFixed(3)}deg) scale(${s.s.toFixed(4)})`;
  return true;
}

// 回弹强调（结论、标签）：0.65→1.17→0.94→1.06→1
export function bounce(node, lt, t0, h, base = '') {
  if (lt < t0) { node.style.opacity = 0; return; }
  const sc = keyed(lt, t0, h.S.motion.bounce);
  const k = clamp((lt - t0) / 0.15);
  node.style.opacity = k;
  node.style.transform = `${base} translateY(${((1 - k) * 40).toFixed(1)}px) scale(${sc.toFixed(4)})`;
}

// 当前焦点序号：最后一个已出现的项
export const current = (times, lt) => times.reduce((a, t, i) => (lt >= t ? i : a), -1);

// 时点：字段的发音时刻（相对段首），找不到原声就按段长比例
export const sayAt = (seg, name, frac = 0.3) => seg.beats.say?.[name] ?? (seg.t1 - seg.t0) * frac;
export const itemsAt = seg => seg.beats.items;

// 画线（箭头、连线、勾）：SVG path 按进度描出
export function svg(parent, [x, y, w, hh], h) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', `0 0 ${w} ${hh}`); s.setAttribute('width', w); s.setAttribute('height', hh);
  Object.assign(s.style, { position: 'absolute', left: x + 'px', top: y + 'px', overflow: 'visible' });
  parent.append(s);
  return s;
}
export { lerp, clamp, ease, prog, keyed };

// 粗箭头（金色实心箭头），方向向右；返回 svg 元素
export function thickArrow(parent, [x, y, w, hh], h) {
  const s = svg(parent, [x, y, w, hh], h);
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  const m = hh / 2, t = hh * 0.18, head = Math.min(w * 0.42, hh * 0.9);
  p.setAttribute('d', `M0 ${m - t} L${w - head} ${m - t} L${w - head} 0 L${w} ${m} L${w - head} ${hh} L${w - head} ${m + t} L0 ${m + t} Z`);
  p.setAttribute('class', 'k-arrow');
  s.append(p);
  return s;
}
// 从左往右擦出（箭头、高亮条用）
export function wipe(node, lt, t0, dur = 0.22) {
  const k = ease.outCubic(prog(lt, t0, dur));
  node.style.opacity = lt < t0 ? 0 : 1;
  node.style.clipPath = k < 1 ? `inset(-10px ${((1 - k) * 100).toFixed(2)}% -10px 0)` : '';
}

// 两级文字的第二级：说到时逐字打出，至少每秒 12 字
export function typeOn(node, lt, t0, text, cps = 12) {
  const n = Math.max(0, Math.min([...text].length, Math.floor((lt - t0) * cps)));
  const shown = lt < t0 ? '' : [...text].slice(0, Math.max(1, n)).join('');
  if (node.textContent !== shown) node.textContent = shown;
  node.dataset.t = lt >= t0 ? text : '';
  node.style.opacity = lt < t0 ? 0 : 1;
}

// 盖章：0.12s 从 1.6 倍砸到 1，带旋转；返回当时的震屏位移
export function stamp(node, lt, t0, h, rot = -12) {
  if (lt < t0) { node.style.opacity = 0; return 0; }
  const k = ease.outCubic(prog(lt, t0, 0.12));
  node.style.opacity = 1;
  node.style.transform = `rotate(${rot}deg) scale(${(1.6 - 0.6 * k).toFixed(3)})`;
  const sk = prog(lt, t0 + 0.1, 0.2);
  return sk > 0 && sk < 1 ? 10 * Math.sin(sk * 6 * Math.PI) * (1 - sk) : 0;
}
