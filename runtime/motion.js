// 动作工具：全部是 t 的纯函数，同一时刻永远画出同一帧。
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const prog = (t, t0, dur) => (dur <= 0 ? (t >= t0 ? 1 : 0) : clamp((t - t0) / dur));

export const ease = {
  linear: k => k,
  outCubic: k => 1 - (1 - k) ** 3,
  inCubic: k => k ** 3,
  inOutCubic: k => (k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2),
  outQuint: k => 1 - (1 - k) ** 5,
  // 回弹：越过终点再回落，s 越大越弹
  outBack: (k, s = 1.70158) => 1 + (s + 1) * (k - 1) ** 3 + s * (k - 1) ** 2,
};

// 弹出缩放：0 → over → 1
export function pop(t, t0, { dur = 0.4, over = 1.08, from = 0.6 } = {}) {
  const k = prog(t, t0, dur);
  if (k <= 0) return from;
  if (k < 0.6) return lerp(from, over, ease.outCubic(k / 0.6));
  return lerp(over, 1, ease.inOutCubic((k - 0.6) / 0.4));
}

// 短促震动：以 t0 为中心的衰减正弦，返回像素位移
export function shake(t, t0, { amp = 8, dur = 0.32, freq = 4 } = {}) {
  const k = prog(t, t0, dur);
  if (k <= 0 || k >= 1) return 0;
  return amp * Math.sin(k * freq * 2 * Math.PI) * (1 - k);
}

// 强调回弹：在 t0 放大到 peak 再回 1
export function punch(t, t0, { dur = 0.36, peak = 1.12 } = {}) {
  const k = prog(t, t0, dur);
  if (k <= 0 || k >= 1) return 1;
  return k < 0.35 ? lerp(1, peak, ease.outCubic(k / 0.35)) : lerp(peak, 1, ease.outBack((k - 0.35) / 0.65, 2.2));
}

// 进场 / 退场的统一状态：返回 {o, dx, dy, s, clip}
export function enterExit(t, { t0, t1, enter = 'rise', exit = 'fade', din = 0.35, dout = 0.25, dist = 40 }) {
  const ki = ease.outCubic(prog(t, t0, din));
  const ko = ease.inCubic(prog(t, t1 - dout, dout));
  const st = { o: 1, dx: 0, dy: 0, s: 1, clip: 0 };
  if (enter === 'rise') { st.o = ki; st.dy = (1 - ki) * dist; }
  else if (enter === 'slideL') { st.o = ki; st.dx = (1 - ki) * -dist * 2; }
  else if (enter === 'slideR') { st.o = ki; st.dx = (1 - ki) * dist * 2; }
  else if (enter === 'pop') { st.o = clamp(ki * 2); st.s = pop(t, t0, { dur: din + 0.1 }); }
  else if (enter === 'wipe') { st.clip = 1 - ki; }
  else { st.o = ki; }
  if (exit !== 'none') { st.o *= 1 - ko; if (exit === 'drop') st.dy += ko * dist * 0.5; }
  return st;
}

export function applyState(node, st, extra = '') {
  node.style.opacity = st.o.toFixed(4);
  node.style.transform = `translate(${st.dx.toFixed(2)}px, ${st.dy.toFixed(2)}px) scale(${st.s.toFixed(4)}) ${extra}`;
  node.style.clipPath = st.clip > 0 ? `inset(0 ${(st.clip * 100).toFixed(2)}% 0 0)` : '';
}

// 关键词短震：返回 {x,y,rot,s,o}
export function textShake(t, t0, { dur = 0.28, x = 12, y = 4, rot = 1.2 } = {}) {
  if (t < t0) return { x: 0, y: 0, rot: 0, s: 0.94, o: 0 };
  const p = clamp((t - t0) / dur);
  if (p >= 1) return { x: 0, y: 0, rot: 0, s: 1, o: 1 };
  const wave = Math.sin(2 * Math.PI * 3 * p), decay = (1 - p) ** 2;
  return { x: x * wave * decay, y: y * Math.sin(2 * Math.PI * 4 * p) * decay, rot: rot * wave * decay, s: 0.94 + 0.06 * Math.min(1, 3 * p), o: Math.min(1, 8 * p) };
}

// 关键帧缩放：keys = [[秒, 值], ...]，段间 outCubic
export function keyed(t, t0, keys) {
  const d = t - t0;
  if (d <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (d < keys[i][0]) {
    const [a, va] = keys[i - 1], [b, vb] = keys[i];
    return lerp(va, vb, ease.outCubic((d - a) / (b - a)));
  }
  return keys.at(-1)[1];
}

// 打字机：返回应显示的字符数
export const typed = (t, t0, n, cps = 14) => clamp(Math.floor((t - t0) * cps), 0, n);
