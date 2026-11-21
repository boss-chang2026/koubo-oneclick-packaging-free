// D1 截图展示：真实截图（网页、仓库、文档、软件界面）完整放进大画面区，人物缩成小圆窗。
// 可选 focus：截图里要强调的区域（归一化 [x, y, w, h]）。说到 focusSay 时镜头推近这块并画金框，说完前停稳。
import { area, scene, box, reveal, sayAt, ease, prog, lerp } from './_kit.js';
export default {
  build(root, seg, h) {
    const [x, y, w, hh] = area(seg, h, { raw: true });
    const title = seg.slots.title ? h.text(box(root, '', [x, y, w, 90], h), 'k-h', seg.slots.title, 'title') : null;
    if (title) { title.style.fontSize = '60px'; title.parentElement.style.textAlign = 'center'; }
    const top = y + (title ? 110 : 0), avail = [x, top, w, hh - (title ? 110 : 0)];
    const frame = box(root, 'k-frame', avail, h);
    const inner = h.el('div', '', frame);
    Object.assign(inner.style, { position: 'absolute', left: 0, top: 0, transformOrigin: '0 0' });
    const img = h.el('img', '', inner); img.src = h.asset(seg.media.image);
    Object.assign(img.style, { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' });
    const fb = seg.slots.focus ? h.el('div', 'k-focusbox', inner) : null;
    return { title, frame, inner, img, fb, avail };
  },
  layout(root, seg, c, h) {
    // 按截图真实比例放进可用区，完整显示、不裁切
    const [x, y, w, hh] = c.avail, ar = c.img.naturalWidth / Math.max(1, c.img.naturalHeight);
    const fw = Math.min(w, hh * ar), fh = fw / ar;
    c.size = [fw, fh];
    h.rect(c.frame, [x + (w - fw) / 2, y + (hh - fh) / 2, fw, fh]);
    Object.assign(c.inner.style, { width: fw + 'px', height: fh + 'px' });
    if (c.fb) {
      const [fx, fy, fW, fH] = seg.slots.focus;
      h.rect(c.fb, [fx * fw, fy * fh, fW * fw, fH * fh]);
      // 推近倍率：让焦点区约占画面 70%，最多 2.2 倍，最少不推
      c.zoom = Math.max(1, Math.min(2.2, 0.7 * Math.min(1 / fW, 1 / fH)));
    }
  },
  render(root, lt, seg, c, h) {
    scene(root, lt, seg, h);
    if (c.title) reveal(c.title, lt, seg.beats.say?.title ?? 0.05, h, { shake: false });
    c.frame.style.opacity = Math.min(1, lt / 0.25);
    if (!c.fb) return;
    const t0 = sayAt(seg, 'focusSay', 0.3), k = ease.inOutCubic(prog(lt, t0 - 0.15, 0.45));
    const [fx, fy, fW, fH] = seg.slots.focus, [fw, fh] = c.size, z = lerp(1, c.zoom, k);
    // 焦点中心对准画面中心，但不露出截图外的空白
    const cx = (fx + fW / 2) * fw, cy = (fy + fH / 2) * fh;
    const tx = Math.min(0, Math.max(fw - fw * z, fw / 2 - cx * z)), ty = Math.min(0, Math.max(fh - fh * z, fh / 2 - cy * z));
    c.inner.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${z.toFixed(4)})`;
    const kb = ease.outCubic(prog(lt, t0 + 0.2, 0.25));
    c.fb.style.opacity = lt < t0 + 0.2 ? 0 : 1;
    c.fb.style.borderWidth = (6 / z).toFixed(2) + 'px';
    c.fb.style.clipPath = kb < 1 ? `inset(0 ${((1 - kb) * 100).toFixed(1)}% 0 0)` : '';
  },
};
