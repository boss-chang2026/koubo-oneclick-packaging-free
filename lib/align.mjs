// 在逐字时间流里查找短语的真实发音时间。
// 计划里只写「强调哪几个字」，秒数由这里从原声算出，不交给模型估。

// 语音识别常把「百万」「十一万」写成「100万」「11万」：两边都把中文数字转成阿拉伯数字再比
const D = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }, U = { 十: 10, 百: 100, 千: 1000 };
function cnNum(s) {
  let total = 0, cur = 0;
  for (const c of s) {
    if (c in D) cur = D[c];
    else { total += (cur || 1) * U[c]; cur = 0; }
  }
  return String(total + cur);
}
const numify = s => s.replace(/[零一二两三四五六七八九十百千]+/g, m => (m.length === 1 && m in D ? m : /[十百千]/.test(m) || m.length > 1 ? cnNum(m) : m));
const norm = s => numify(s.replace(/[\s，。、！？!?,.:：；;“”"'‘’（）()《》<>【】\[\]…—\-·+]/g, '')).toLowerCase();

// 把逐词流展开成逐字流：每个字分得该词时间的等份（词内均分，误差在一个词以内）。
export function charStream(words) {
  const out = [];
  for (const w of words) {
    const chars = [...norm(w.w)];
    if (!chars.length) continue;
    const d = (w.e - w.s) / chars.length;
    chars.forEach((c, i) => out.push({ c, s: w.s + d * i, e: w.s + d * (i + 1) }));
  }
  return out;
}

// 在 [from, to] 时间窗内找 phrase；找不到返回 null。允许少量识别错字（编辑距离）。
export function findPhrase(stream, phrase, from = 0, to = Infinity) {
  const p = [...norm(phrase)];
  if (!p.length) return null;
  const win = stream.filter(x => x.s >= from - 0.3 && x.s <= to + 0.3);
  let best = null;
  for (let i = 0; i + p.length <= win.length; i++) {
    let miss = 0;
    for (let k = 0; k < p.length && miss <= Math.floor(p.length / 4); k++) if (win[i + k].c !== p[k]) miss++;
    if (miss <= Math.floor(p.length / 4) && (!best || miss < best.miss)) best = { miss, s: win[i].s, e: win[i + p.length - 1].e };
    if (best && best.miss === 0) break;
  }
  return best && { start: best.s, end: best.e, exact: best.miss === 0 };
}

// 没有逐字数据时的退路：按字幕条内字符位置线性估计，并显式标记为估计值。
export function estimateInCue(cue, phrase) {
  const t = norm(cue.text), p = norm(phrase), i = t.indexOf(p);
  if (i < 0) return null;
  const d = (cue.end - cue.start) / Math.max(1, t.length);
  return { start: cue.start + d * i, end: cue.start + d * (i + p.length), exact: false, estimated: true };
}
