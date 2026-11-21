// B1 左右对比：两栏以内容区中线对称，各占 40%，栏标题同一水平线，内容与本栏标题左对齐，箭头在中线；
// 胜出一栏标题金底，结论落在胜出一栏下方回弹；说明文字按口播出现，用两级文字
import { area, scene, box, reveal, bounce, sayAt, thickArrow, wipe, typeOn } from './_kit.js';
export default {
  build(root, seg, h) {
    const [x, y, w, hh] = area(seg, h), s = seg.slots, win = s.winner === 'left' ? 'left' : 'right';
    const title = s.title ? h.text(box(root, '', [x, y, w, 100], h), 'k-h', s.title, 'title') : null;
    if (title) { title.style.fontSize = '64px'; title.parentElement.style.textAlign = 'center'; }
    const top = y + (title ? 140 : 40), cw = w * 0.4, lx = x, rx = x + w * 0.6;
    const col = (cx, label, sub, isWin) => {
      const b = box(root, '', [cx, top, cw, 400], h);
      Object.assign(b.style, { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '26px' });
      const lb = h.text(b, 'k-h' + (isWin ? ' k-hl' : ' gold'), label, 'label');
      lb.style.fontSize = '68px'; lb.style.whiteSpace = 'nowrap';
      const sb = sub ? h.text(b, 'k-detail', '', 'body') : null;
      if (sb) sb.style.fontSize = '48px';
      return { lb, sb, text: sub || '' };
    };
    const L = col(lx, s.leftLabel, s.leftSub, win === 'left'), R = col(rx, s.rightLabel, s.rightSub, win === 'right');
    const arrow = thickArrow(root, [x + w / 2 - 60, top + 10, 120, 70], h);
    let res = null;
    if (s.result) { res = h.text(box(root, '', [win === 'left' ? lx : rx, top + 260, cw, 140], h), 'k-h k-hl', s.result, 'key'); res.style.fontSize = '80px'; res.style.display = 'inline-block'; }
    return { title, L, R, arrow, res, cw };
  },
  layout(root, seg, c, h) { for (const k of [c.L, c.R]) h.fit(k.lb, c.cw, 110, [68, 64, 60, 56]); },
  render(root, lt, seg, c, h) {
    scene(root, lt, seg, h);
    if (c.title) reveal(c.title, lt, seg.beats.say?.title ?? 0.05, h, { shake: false });
    const tl = Math.min(sayAt(seg, 'leftLabel', 0.05), 0.4), tr = Math.max(tl + 0.5, sayAt(seg, 'rightLabel', 0.45));
    reveal(c.L.lb, lt, tl, h); if (c.L.sb) typeOn(c.L.sb, lt, seg.beats.say?.leftSub ?? tl + 0.35, c.L.text, 12);
    wipe(c.arrow, lt, tr - 0.3, 0.22);
    reveal(c.R.lb, lt, tr, h); if (c.R.sb) typeOn(c.R.sb, lt, seg.beats.say?.rightSub ?? tr + 0.35, c.R.text, 12);
    if (c.res) bounce(c.res, lt, Math.max(tr + 0.5, sayAt(seg, 'result', 0.75)), h);
  },
};
