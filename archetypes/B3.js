// B3 流程链（layout=vertical：人物大方窗在左时，节点从上到下排、箭头向下，可带标题）：段首先出暗色占位节点，说到哪一环就点亮成米白纸卡，粗箭头擦出；当前环金底
import { area, scene, box, reveal, itemsAt, current, thickArrow, wipe, ease, prog } from './_kit.js';
export default {
  build(root, seg, h) {
    const [x, y, w, hh] = area(seg, h), n = seg.slots.nodes.length, gap = 90;
    if (seg.slots.layout === 'vertical') {
      // 只有三四个框、横排会上下留白时：人物放大成左侧长方形，右侧从上到下排，箭头向下
      const head = seg.slots.title ? h.text(box(root, '', [x, y, w, 96], h), 'k-h', seg.slots.title, 'title') : null;
      if (head) { head.style.fontSize = '68px'; head.parentElement.style.textAlign = 'center'; }
      const top0 = y + (head ? 118 : 0), avail = hh - (head ? 118 : 0), vg = 64;
      const nh = Math.min(150, (avail - vg * (n - 1)) / n), nw = Math.min(w, 600), nx = x + (w - nw) / 2, ny = top0 + (avail - (nh * n + vg * (n - 1))) / 2;
      const nodes = seg.slots.nodes.map((t, i) => {
        const r = [nx, ny + i * (nh + vg), nw, nh];
        const ph = box(root, 'k-tile', r, h), card = box(root, 'k-paper', r, h);
        Object.assign(card.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px 18px' });
        const tx = h.text(card, 'k-h', t, 'item'); tx.style.whiteSpace = 'nowrap';
        return { ph, card, tx };
      });
      const arrows = seg.slots.nodes.slice(1).map((_, i) => {
        const a = thickArrow(root, [nx + nw / 2 - (vg - 12) / 2, ny + (i + 1) * nh + i * vg + vg / 2 - 26, vg - 12, 52], h);
        a.style.transformOrigin = '50% 50%'; a.style.transform = 'rotate(90deg)';
        return a;
      });
      return { nodes, arrows, nw, nh, head };
    }
    const nw = Math.min(330, (w - gap * (n - 1)) / n), nh = 170, x0 = x + (w - (nw * n + gap * (n - 1))) / 2, ny = y + (hh - nh) / 2 - 20;
    const nodes = seg.slots.nodes.map((t, i) => {
      const r = [x0 + i * (nw + gap), ny, nw, nh];
      const ph = box(root, 'k-tile', r, h);
      const card = box(root, 'k-paper', r, h);
      Object.assign(card.style, { display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '10px 18px' });
      const tx = h.text(card, 'k-h', t, 'item'); tx.style.whiteSpace = 'nowrap';
      return { ph, card, tx };
    });
    const arrows = seg.slots.nodes.slice(1).map((_, i) => thickArrow(root, [x0 + (i + 1) * nw + i * gap + 18, ny + nh / 2 - 26, gap - 36, 52], h));
    return { nodes, arrows, nw, nh };
  },
  layout(root, seg, c, h) { const fs = Math.min(...c.nodes.map(k => h.fit(k.tx, c.nw - 36, c.nh - 20, [64, 60, 56, 52, 48, 44]))); c.nodes.forEach(k => (k.tx.style.fontSize = fs + 'px')); },
  render(root, lt, seg, c, h) {
    scene(root, lt, seg, h);
    if (c.head) reveal(c.head, lt, seg.beats.say?.title ?? 0.1, h, { shake: false });
    const at = itemsAt(seg), cur = current(at, lt);
    c.nodes.forEach((k, i) => {
      k.ph.style.opacity = Math.min(1, lt / 0.25);
      const f = ease.outCubic(prog(lt, at[i] - 0.08, 0.25));
      k.card.style.opacity = lt < at[i] - 0.08 ? 0 : f;
      k.card.style.transform = `scale(${(0.85 + 0.15 * f).toFixed(3)})`;
      k.card.style.background = i === cur ? 'var(--gold)' : '';
    });
    c.arrows.forEach((a, i) => wipe(a, lt, at[i + 1] - 0.3, 0.22));
  },
};
