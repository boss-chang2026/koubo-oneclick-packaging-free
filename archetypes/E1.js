// E1 并列关键词：按数量铺匀——3 个以内一行等分，4–5 个两行；每个词上方可配语义图标；说到哪个点亮哪个
import { area, scene, box, reveal, bounce, itemsAt, current, sayAt } from './_kit.js';
import { icon } from './_icons.js';
export default {
  build(root, seg, h) {
    const [x, y, w, hh] = area(seg, h), items = seg.slots.items, n = items.length, ics = seg.slots.icons || [];
    const cols = n <= 3 ? n : Math.ceil(n / 2), rows = Math.ceil(n / cols), hasIcon = ics.some(Boolean);
    const tagH = seg.slots.tag ? 150 : 0, cellH = Math.min(hasIcon ? 220 : 140, (hh - tagH) / rows), colW = w / cols;
    const top = y + (hh - tagH - cellH * rows) / 2;
    const cells = items.map((t, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      const b = box(root, '', [x + c * colW, top + r * cellH, colW, cellH], h);
      Object.assign(b.style, { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px' });
      const ic = ics[i] ? icon(b, ics[i], 76) : null;
      const nd = h.text(b, 'k-h k-uline', t, 'item'); nd.style.whiteSpace = 'nowrap';
      return { b, ic, nd };
    });
    const tag = seg.slots.tag ? h.text(box(root, '', [x, top + rows * cellH + 10, w, 130], h), 'k-h k-hl', seg.slots.tag, 'key') : null;
    if (tag) { tag.style.fontSize = '88px'; tag.style.display = 'inline-block'; tag.parentElement.style.textAlign = 'center'; }
    return { cells, tag, colW, cellH, hasIcon };
  },
  layout(root, seg, c, h) { const fs = Math.min(...c.cells.map(k => h.fit(k.nd, c.colW - 40, c.cellH - (c.hasIcon ? 100 : 20), [80, 72, 64, 56]))); c.cells.forEach(k => (k.nd.style.fontSize = fs + 'px')); },
  render(root, lt, seg, c, h) {
    scene(root, lt, seg, h);
    const at = itemsAt(seg), cur = current(at, lt);
    c.cells.forEach((k, i) => { reveal(k.b, lt, at[i], h); k.nd.classList.toggle('gold', i === cur); });
    if (c.tag) bounce(c.tag, lt, sayAt(seg, 'tag', 0.85), h);
  },
};
