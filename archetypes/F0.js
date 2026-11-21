// F0 纯人物：只有人物和底部字幕。
// 可选 tags：左上角圆角小标签（说到哪个弹哪个；说到下一个时前一个退场，后一个更大），适合开头句没有强钩子时点题。
import { box, bounce, itemsAt } from './_kit.js';
export default {
  build(root, seg, h) {
    const base = 72, scale = 1.7;
    let y = 70;
    const tags = (seg.slots.tags || []).map((t, i) => {
      const fs = Math.round(base * (i ? scale : 1));
      const b = box(root, '', [120, y, 1100, fs * 1.7], h);
      const n = h.text(b, 'k-h k-tagbig', t, 'label');
      n.style.fontSize = fs + 'px';
      y += Math.round(base * 0.55);
      return n;
    });
    return { tags };
  },
  render(root, lt, seg, c, h) {
    if (!c.tags?.length) return;
    const at = itemsAt(seg), tagAt = i => at[i] ?? 0.1 + i * 0.6;
    c.tags.forEach((n, i) => {
      const t0 = tagAt(i), next = c.tags[i + 1] ? tagAt(i + 1) : Infinity;
      bounce(n, lt, t0, h);
      if (lt > next - 0.18) n.style.opacity = Math.max(0, (next - 0.03 - lt) / 0.15);
    });
    const d = seg.t1 - seg.t0; root.style.opacity = lt > d - 0.15 ? Math.max(0, (d - lt) / 0.15) : 1;
  },
};
