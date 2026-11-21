// G2 章节 / 用法编号卡：大编号 + 小节类别一行，下面本节标题；整体按内容区排版，不溢出
import { area, scene, box, reveal, sayAt } from './_kit.js';
export default {
  build(root, seg, h) {
    const [x, y, w, hh] = area(seg, h);
    const wrap = box(root, '', [x, y, w, hh], h);
    Object.assign(wrap.style, { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '28px' });
    const row = h.el('div', '', wrap); Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '30px' });
    const idx = h.text(row, 'k-num', seg.slots.index, 'number'); idx.style.fontSize = '150px';
    const label = h.text(row, 'k-h k-hl', seg.slots.label, 'label'); label.style.fontSize = '64px'; label.style.whiteSpace = 'nowrap';
    const head = h.text(wrap, 'k-h', seg.slots.headline, 'title'); head.style.fontSize = '76px';
    return { idx, label, head, w, hh };
  },
  layout(root, seg, c, h) {
    if (c.hh < 360) { c.idx.style.fontSize = '110px'; }
    // 类别标签和标题按可用宽度尽量放大（标签最大 128），章节卡不留大片空白
    const lw = c.w - c.idx.offsetWidth - 30 - 40;
    const ls = c.hh < 360 ? 64 : [128, 112, 96, 80, 64].find(f => (c.label.style.fontSize = f + 'px', c.label.scrollWidth <= lw)) || 64; c.label.style.fontSize = ls + 'px';
    h.fit(c.head, c.w, Math.min(Math.max(120, c.hh - c.idx.parentElement.offsetHeight - 60), 260), c.hh < 360 ? [80, 76, 72, 64, 56] : [120, 108, 96, 88, 80, 76, 72, 64, 56]);
  },
  render(root, lt, seg, c, h) {
    scene(root, lt, seg, h);
    // 编号和类别在口播说到类别词（如「第一步」）时才出现；没说到就段首出现
    const tl = seg.beats.say?.label ?? 0.05;
    // 段落写 sayAs.index 指到更早的口播词时，编号跟那个词先出现；不写则和类别同时出现
    reveal(c.idx, lt, Math.min(seg.beats.say?.index ?? tl, tl), h);
    reveal(c.label, lt, tl + 0.12, h, { shake: false });
    reveal(c.head, lt, sayAt(seg, 'headline', 0.3), h); // 不早于口播
  },
};
