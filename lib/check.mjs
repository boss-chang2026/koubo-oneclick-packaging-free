// 出片前自动检查：平台右侧图标遮挡、字压人脸、出画、字太小、孤字换行、重点文字互相压住。
// 只读页面申报的 TEXTS(t)，不看像素；结论写入 check.json。
import { openPage } from './render.mjs';
import { douyinRegions, occlusionVerdict, KEY_ROLES } from '../runtime/occlusion.js';
import { textCollision } from '../runtime/layout.js';

const inter = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
const area = b => (b.x1 - b.x0) * (b.y1 - b.y0);

// 人脸大致范围：大窗/全屏取中上部，圆窗整窗都算
function faceZone(h) {
  const [x, y, w, hh] = h.r;
  if (h.state === 'circle') return { x0: x, y0: y, x1: x + w, y1: y + hh };
  if (h.state === 'full') return { x0: x + w * 0.37, y0: y + hh * 0.06, x1: x + w * 0.62, y1: y + hh * 0.55 };
  return { x0: x + w * 0.3, y0: y + hh * 0.08, x1: x + w * 0.7, y1: y + hh * 0.58 };
}

export async function check({ buildDir, framesDir, dur, step = 0.1, W = 1920, H = 1080 }) {
  const p = await openPage({ buildDir, framesDir });
  const regions = douyinRegions(W, H), issues = new Map();
  const add = (kind, level, t, x, msg) => {
    const k = `${kind}|${x.seg}|${x.text}`, it = issues.get(k);
    if (it) it.t1 = t; else issues.set(k, { kind, level, seg: x.seg, text: x.text, t0: t, t1: t, msg });
  };
  for (let t = 0; t < dur; t += step) {
    const { texts, host } = await p.page.evaluate(async t => ({ texts: await window.TEXTS(t), host: window.HOST(t) }), t);
    const face = host.k < 1 ? null : faceZone(host); // 人物窗形变途中不判压脸
    const keys = texts.filter(x => KEY_ROLES.includes(x.role));
    for (const x of texts) {
      if (x.orphan) add('孤字断行', 'error', t, x, '最后一行只剩一个字；缩短文字或换个说法');
      if (x.x0 < -2 || x.y0 < -2 || x.x1 > W + 2 || x.y1 > H + 2) add('出画', 'error', t, x, '文字超出画面');
      if (x.role !== 'caption' && x.fontSize < 39.5) add('字太小', 'error', t, x, `${Math.round(x.fontSize)}px，手机上看不清，至少 40px`);
    }
    for (const x of keys) {
      const v = occlusionVerdict(x, regions);
      if (v) add('平台遮挡', 'error', t, x, v.reason);
      if (face && inter(x, face) / area(x) > 0.3) add('压人脸', 'warn', t, x, '重点文字压在人物脸上');
    }
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++)
      if (keys[i].seg === keys[j].seg && textCollision(keys[i], keys[j])) add('文字重叠', 'error', t, keys[i], `和「${keys[j].text}」互相压住`);
  }
  const nudges = await p.page.evaluate(() => window.NUDGES);
  const pageErrors = p.errors;
  await p.close();
  const list = [...issues.values()].map(it => ({ ...it, t0: +it.t0.toFixed(2), t1: +it.t1.toFixed(2) }));
  const errors = list.filter(x => x.level === 'error').length;
  return { pass: errors === 0 && !pageErrors.length, errors, warnings: list.length - errors, issues: list, nudges, pageErrors };
}
