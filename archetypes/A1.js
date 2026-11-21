// A1 金句关键词：白色引导句 → 说到核心词时金色大字短震。
// 核心词以「？」结尾（总领下文的问句）时，说完后大问号像盖章一样砸下。
import { area, scene, box, reveal, sayAt, stamp } from './_kit.js';
export default {
  build(root, seg, h) {
    const [x, y, w, hh] = area(seg, h);
    const wrap = box(root, '', [x, y, w, hh], h);
    Object.assign(wrap.style, { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', gap: '36px' });
    const lead = seg.slots.lead ? h.text(wrap, 'k-title', seg.slots.lead, 'title') : null;
    const kw = h.el('div', '', wrap); kw.style.position = 'relative'; kw.style.display = 'inline-block';
    const q = /[？?]$/.test(seg.slots.key);
    const shown = q ? seg.slots.key.replace(/[？?]$/, '') : seg.slots.key; // 有大问号盖章时，正文不再重复问号
    const key = h.text(kw, 'k-key', shown, 'key'); key.style.whiteSpace = 'nowrap';
    const qm = q ? h.el('div', 'k-qmark', kw, '?') : null;
    return { lead, key, kw, qm, w };
  },
  layout(root, seg, c, h) {
    if (c.lead) { c.lead.style.whiteSpace = 'nowrap'; h.fit(c.lead, c.w, 240, [88, 80, 72, 64, 56]); } // 引导句尽量一行，不在词中间断开
    h.fit(c.key, c.w - (c.qm ? 200 : 0), 320, [166, 150, 136, 120, 110, 100, 90]);
    if (c.qm) Object.assign(c.qm.style, { left: c.key.offsetWidth + 20 + 'px', top: -40 + 'px' });
  },
  render(root, lt, seg, c, h) {
    scene(root, lt, seg, h);
    const tl = seg.beats.say?.lead ?? 0.05, tk = sayAt(seg, 'key', 0.45);
    if (c.lead) reveal(c.lead, lt, tl, h, { shake: false });
    reveal(c.key, lt, tk, h);
    if (c.qm) {
      const ke = seg.beats.sayEnd?.key ?? (tk + 0.5);
      const sh = stamp(c.qm, lt, Math.max(tk + 0.3, ke), h, 12);
      c.kw.style.transform = sh ? `translate(${sh.toFixed(1)}px, ${(sh * 0.3).toFixed(1)}px)` : '';
    }
  },
};
