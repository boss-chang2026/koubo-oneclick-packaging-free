// C1 数字卡组：段首先出暗色卡位，说到数字时金色大数字短震；下面一句说明（接近白）。
// 数字描述的是一个实物且有截图（backdrop）时，截图铺满做压暗底，数字卡变成半透明玻璃卡浮在上面——观众看得到「200 多页」说的是哪份东西
import { area, scene, box, reveal, itemsAt, typeOn } from './_kit.js';
export default {
  build(root, seg, h) {
    let bd = null;
    if (seg.media?.backdrop) {
      const [bx, by, bw, bh] = area(seg, h, { raw: true });
      const frame = box(root, 'k-frame', [bx, by, bw, bh], h);
      const img = h.el('img', '', frame); img.src = h.asset(seg.media.backdrop);
      Object.assign(img.style, { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', filter: 'brightness(.42) blur(1.5px)' });
      bd = frame;
    }
    const [x, y, w, hh] = area(seg, h), n = seg.slots.nums.length, gap = 36, cw = Math.min(440, (w - gap * (n - 1)) / n);
    const x0 = x + (w - (cw * n + gap * (n - 1))) / 2, ch = Math.min(380, hh - 20), top = y + (hh - ch) / 2;
    const cards = seg.slots.nums.map((num, i) => {
      const p = box(root, 'k-tile' + (bd ? ' k-glass' : ''), [x0 + i * (cw + gap), top, cw, ch], h);
      if (bd) Object.assign(p.style, { background: '#1c2124b8', backdropFilter: 'blur(10px)', border: '2px solid #ffffff38' });
      Object.assign(p.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '22px', padding: '20px' });
      const v = h.text(p, 'k-num', num, 'number');
      const note = seg.slots.notes?.[i] ? h.text(p, 'k-detail', '', 'body') : null;
      if (note) { note.style.textAlign = 'center'; note.style.fontSize = '48px'; }
      return { p, v, note, text: seg.slots.notes?.[i] || '' };
    });
    return { cards, cw, ch, bd };
  },
  layout(root, seg, c, h) {
    const fs = Math.min(...c.cards.map(k => h.fit(k.v, c.cw - 40, 170, [150, 130, 120, 110, 96])));
    c.cards.forEach(k => { k.v.style.fontSize = fs + 'px'; });
  },
  render(root, lt, seg, c, h) {
    scene(root, lt, seg, h);
    const at = itemsAt(seg);
    if (c.bd) c.bd.style.opacity = Math.min(1, lt / 0.3);
    c.cards.forEach((k, i) => {
      k.p.style.opacity = Math.min(1, lt / 0.25);
      k.p.classList.toggle('on', lt >= at[i]);
      reveal(k.v, lt, at[i], h);
      if (k.note) typeOn(k.note, lt, seg.beats.details?.[i] ?? at[i] + 0.4, k.text, 12);
    });
  },
};
