// plan.json → timeline.json
// 计划里只有语义：用哪个版式、填什么字、覆盖哪几条字幕。
// 时间、人物窗轨道、字幕分页全部在这里按规则算出；不合规就给出可照着改的中文报错。
import fs from 'node:fs';
import path from 'node:path';
import { readSrt } from './srt.mjs';
import { charStream, findPhrase, estimateInCue } from './align.mjs';
import { ROOT } from './server.mjs';

export const loadCatalog = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'archetypes/catalog.json'), 'utf8'));
export const loadStyle = id => JSON.parse(fs.readFileSync(path.join(ROOT, 'styles', id, 'style.json'), 'utf8'));
const strip = s => s.replace(/[，。、！？!?,.;；：:]+$/g, '').replace(/[，。！？!?,;；]/g, ' ').replace(/(?<!\d)\.|\.(?!\d)/g, ' ').replace(/\s+/g, ' ').trim();
const seg = new Intl.Segmenter('zh', { granularity: 'word' });
const cjkLen = s => [...s].reduce((n, c) => n + (/[\x00-\xff]/.test(c) ? 0.55 : 1), 0);

export function compile(planFile, { fps = 30 } = {}) {
  const dir = path.dirname(path.resolve(planFile));
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
  const rel = p => (p && !path.isAbsolute(p) ? path.join(dir, p) : p);
  const errors = [], warnings = [];
  const cat = loadCatalog(), byId = Object.fromEntries(cat.archetypes.map(a => [a.id, a]));
  plan.style ||= 'basic';
  if (!fs.existsSync(path.join(ROOT, 'styles', plan.style, 'style.json'))) errors.push(`style「${plan.style}」不存在；可选：${fs.readdirSync(path.join(ROOT, 'styles')).join('、')}`);
  if (!plan.srt || !fs.existsSync(rel(plan.srt))) { errors.push(`找不到字幕文件 srt：${plan.srt}`); return { timeline: null, errors, warnings, plan, dir }; }
  if (plan.aroll && !fs.existsSync(rel(plan.aroll))) errors.push(`找不到口播视频 aroll：${plan.aroll}`);
  const S = errors.length ? null : loadStyle(plan.style);
  const cues = readSrt(rel(plan.srt));
  if (!cues.length) { errors.push('字幕文件里没有读到任何字幕'); return { timeline: null, errors, warnings, plan, dir }; }
  const wordsFile = rel(plan.words || 'words.json');
  const stream = fs.existsSync(wordsFile) ? charStream(JSON.parse(fs.readFileSync(wordsFile, 'utf8')).words) : null;
  if (!stream) warnings.push('没有 words.json：文字出现时点按字幕条内字数估算（先运行 words 命令会更准）');
  const dur = plan.duration || cues.at(-1).end + 0.5;

  const timeOf = (phrase, t0, t1, cueRange) => {
    const hit = stream && findPhrase(stream, phrase, t0, t1);
    if (hit) return hit;
    for (const c of cueRange) { const e = estimateInCue(c, phrase); if (e) return e; }
    return null;
  };

  // ---- 段落 ----
  const segs = [];
  let lastEnd = -1;
  for (const [i, s] of (plan.segments || []).entries()) {
    const where = `第 ${i + 1} 段（${s.id || '无 id'}）`;
    const a = byId[s.archetype];
    if (!a) { errors.push(`${where}：版式「${s.archetype}」不存在；可选：${Object.keys(byId).join('、')}`); continue; }
    if (!Array.isArray(s.cues) || s.cues.length !== 2) { errors.push(`${where}：cues 必须写成 [起始字幕号, 结束字幕号]`); continue; }
    const [c0, c1] = s.cues;
    if (!(c0 >= 1 && c1 >= c0 && c1 <= cues.length)) { errors.push(`${where}：cues [${c0}, ${c1}] 超出字幕范围 1–${cues.length}`); continue; }
    if (c0 <= lastEnd) errors.push(`${where}：字幕 ${c0} 已被上一段占用，段落不能重叠`);
    lastEnd = c1;
    const range = cues.slice(c0 - 1, c1);
    const t0 = range[0].start, t1 = c1 < cues.length ? cues[c1].start : range.at(-1).end + 0.3;
    if (t1 - t0 < (a.minDur || 0)) errors.push(`${where}：${a.id} 至少需要 ${a.minDur}s，现在只有 ${(t1 - t0).toFixed(2)}s；请合并相邻字幕`);
    const slots = s.slots || {};
    // 字段校验：必填、类型、字数、素材存在
    for (const sl of a.slots) {
      const v = slots[sl.name];
      if (sl.required && (v == null || v === '' || (Array.isArray(v) && !v.length))) { errors.push(`${where}：${a.id} 缺少「${sl.name}」（${sl.desc}）`); continue; }
      if (v == null) continue;
      if (sl.type === 'box') {
        if (!Array.isArray(v) || v.length !== 4 || v.some(n => !Number.isFinite(n) || n < 0) || v[2] <= 0 || v[3] <= 0 || v[0] + v[2] > 1.001 || v[1] + v[3] > 1.001) errors.push(`${where}：「${sl.name}」要写成截图内的归一化 [x, y, w, h]，每个数 0–1 且不越界`);
        continue;
      }
      const list = Array.isArray(v) ? v : [v];
      if (sl.type.endsWith('[]') && !Array.isArray(v)) errors.push(`${where}：「${sl.name}」应为数组`);
      if (sl.minItems && list.length < sl.minItems) errors.push(`${where}：「${sl.name}」至少 ${sl.minItems} 项`);
      if (sl.maxItems && list.length > sl.maxItems) errors.push(`${where}：「${sl.name}」最多 ${sl.maxItems} 项`);
      for (const x of list) {
        if (sl.type.startsWith('text') && sl.max && cjkLen(String(x)) > sl.max) errors.push(`${where}：「${sl.name}」的「${x}」超过 ${sl.max} 字，请精简`);
        if (sl.type.startsWith('media') && !fs.existsSync(rel(x))) errors.push(`${where}：素材不存在 ${x}`);
        if (sl.type.startsWith('enum') && !sl.values.includes(x)) errors.push(`${where}：「${sl.name}」只能是 ${sl.values.join(' / ')}`);
      }
    }
    const extra = Object.keys(slots).filter(k => !a.slots.some(sl => sl.name === k));
    if (extra.length) errors.push(`${where}：${a.id} 没有这些字段：${extra.join('、')}；可用：${a.slots.map(x => x.name).join('、')}`);
    if (s.header && cjkLen(s.header) > 13) errors.push(`${where}：header「${s.header}」超过 13 字；标题条字号全片统一，请精简`);
    if (s.host && !['full', 'rect', 'circle'].includes(s.host)) errors.push(`${where}：host 只能是 full / rect / circle`);
    // 平台敏感词不上画面；同一句话不在一个画面里写两遍
    const allText = [s.header, ...Object.values(slots).flat().filter(v => typeof v === 'string' && !/\.(png|jpe?g|webp)$/i.test(v))].filter(Boolean);
    for (const b of cat.bannedWords || []) for (const v of allText) if (String(v).includes(b.word)) errors.push(`${where}：「${v}」里有「${b.word}」：${b.why}；改为：${b.use}`);
    const nz = v => String(v || '').replace(/[\s，。、！？!?,.:：·+/]/g, '').toLowerCase();
    if (s.header) for (const sl of a.slots.filter(x => x.type === 'text' && typeof slots[x.name] === 'string'))
      if (nz(s.header) === nz(slots[sl.name])) errors.push(`${where}：标题条和「${sl.name}」是同一句话，画面上会出现两遍；删掉 header 或改成上一级的概括`);
    // 问句保留问号
    for (const sl of a.slots.filter(x => x.type.startsWith('text'))) for (const v of [].concat(slots[sl.name] ?? []))
      if (typeof v === 'string' && /(要不要|能不能|是不是|怎么|什么|为什么|哪|多少|吗|呢)$/.test(v.replace(/\s/g, ''))) warnings.push(`${where}：「${v}」是问句，要带问号`);

    // 文字不早于它被说出的那一刻：say 字段和其他文字字段都去原声里找发音时点
    const say = {}, sayEnd = {}, sayAs = s.sayAs || {};
    for (const sl of a.slots.filter(x => x.type === 'text' && slots[x.name])) {
      const hit = sl.say ? timeOf(String(sayAs[sl.name] || slots[sl.name]), t0, t1, range) : stream && findPhrase(stream, String(sayAs[sl.name] || slots[sl.name]), t0, t1);
      if (hit) { say[sl.name] = hit.start - t0; sayEnd[sl.name] = hit.end - t0; }
      else if (sl.say) warnings.push(`${where}：「${slots[sl.name]}」没在原声里找到，按默认时点出现（改成口播原话，或写 sayAs）`);
    }
    // 列表逐项找发音时点；找不到就在段内依次排开
    const items = [], lists = {};
    for (const listSlot of a.slots.filter(x => x.timed && Array.isArray(slots[x.name]))) {
      const arr = slots[listSlot.name], says = s.say || [], ts = [];
      let from = t0;
      arr.forEach((it, k) => { const hit = timeOf(says[k] || sayAs[it] || String(it), from, t1, range); ts.push(hit ? hit.start - t0 : null); if (hit) from = hit.start + 0.05; });
      const n = arr.length, span = Math.max(0.6, (t1 - t0) - 1.2);
      ts.forEach((v, k) => { if (v == null) { ts[k] = 0.3 + span * k / n; if (!listSlot.free) warnings.push(`${where}：「${listSlot.name}」第 ${k + 1} 项「${arr[k]}」没在原声找到，按段内顺序排时`); } });
      for (let k = 1; k < ts.length; k++) if (ts[k] < ts[k - 1] + 0.25) ts[k] = ts[k - 1] + 0.25;
      lists[listSlot.name] = ts;
      if (!items.length) items.push(...ts);
    }
    const details = [];
    const detSlot = a.slots.find(x => x.detailOf);
    if (detSlot && Array.isArray(slots[detSlot.name])) slots[detSlot.name].forEach((d, k) => {
      const hit = d && timeOf(String(d), t0, t1, range);
      details[k] = hit ? Math.max(hit.start - t0, (items[k] ?? 0) + 0.3) : (items[k] ?? 0) + 0.4;
    });
    const host = s.host || a.host;
    const stage = host === 'full' || a.stage === 'none' ? 'none' : 'card';
    segs.push({ id: s.id || `s${String(i + 1).padStart(2, '0')}`, archetype: a.id, t0, t1, slots, host, stage, header: s.header || '',
      beats: { items, say, sayEnd, lists, details }, speech: range.map(c => c.text).join(''),
      media: Object.fromEntries(a.slots.filter(x => x.type.startsWith('media') && slots[x.name]).map(x => [x.name, rel(slots[x.name])])) });
  }
  for (let i = 2; i < segs.length; i++) if (segs[i].archetype !== 'F0' && segs[i].archetype === segs[i - 1].archetype && segs[i].archetype === segs[i - 2].archetype)
    warnings.push(`${segs[i].id}：连续 3 段都用 ${segs[i].archetype}，考虑换一种讲法`);

  // ---- 没写到的字幕：补人物全屏（F0） ----
  const gapSeg = (id, t0, t1) => ({ id, archetype: 'F0', t0, t1, slots: {}, host: 'full', stage: 'none', header: '', beats: { items: [], say: {}, details: [] }, media: {} });
  const full = [];
  let cur = 0;
  for (const s of segs) {
    const prev = full.at(-1);
    // 片头不足 2s 的空白沿用第一段的人物窗，不先闪一下全屏再缩小
    if (s.t0 - cur > 0.05) { if (prev && s.t0 - cur < 2) prev.t1 = s.t0; else full.push(!prev && s.t0 - cur < 2 ? { ...gapSeg('gap0', cur, s.t0), host: s.host, stage: s.stage } : gapSeg(`gap${full.length}`, cur, s.t0)); }
    full.push(s); cur = s.t1;
  }
  if (dur - cur > 0.05) { const prev = full.at(-1); if (prev && dur - cur < 2) prev.t1 = dur; else full.push(gapSeg('gapEnd', cur, dur)); }

  // ---- 每样东西至少完整停 1 秒；不够就提醒（换场永远卡口播，不为凑时长拖进下一句） ----
  for (const sg of full) {
    if (sg.archetype === 'F0') continue;
    const b = sg.beats, last = Math.max(0, ...b.items, ...Object.values(b.say), ...b.details);
    const hold = sg.t1 - sg.t0 - last - 0.25;
    if (hold < 0.98) warnings.push(`${sg.id}：最后出现的内容只能停 ${hold.toFixed(2)}s，不足 1 秒；把这段多包含后一条字幕，或换更早的触发词`);
  }

  // ---- 人物窗轨道、舞台轨道 ----
  const hostTrack = [], stageTrack = [];
  for (const s of full) {
    const lh = hostTrack.at(-1);
    if (lh && lh.state === s.host && lh.kind === s.stage) lh.t1 = s.t1; else hostTrack.push({ state: s.host, kind: s.stage, t0: s.t0, t1: s.t1 });
    const ls = stageTrack.at(-1), key = `${s.stage}|${s.host}`;
    if (ls && ls.key === key) ls.t1 = s.t1; else stageTrack.push({ key, kind: s.stage, host: s.host, t0: s.t0, t1: s.t1 });
  }

  // ---- 字幕：单行；超宽按标点、再按字数分页，后页的起点取原声 ----
  const captions = [];
  if (S) {
    const maxChars = Math.min(Math.floor(S.slots.caption[2] / S.type.caption) - 1, S.captionMaxChars || 14);
    for (const c of cues) {
      const parts = [];
      for (const piece of strip(c.text).split(' ').filter(Boolean)) {
        let p = piece;
        while (cjkLen(p) > maxChars) {
          // 长句分页：在均分点附近找中文词边界（系统自带分词），不把「软件」拆成「软 / 件」
          const pages = Math.ceil(cjkLen(p) / maxChars), even = Math.ceil(p.length / pages), bounds = new Set();
          let k = 0; for (const w of seg.segment(p)) bounds.add(k += w.segment.length);
          let n = even;
          for (let d = 0; d <= 3; d++) { if (even - d > 1 && bounds.has(even - d)) { n = even - d; break; } if (cjkLen(p.slice(0, even + d)) <= maxChars && bounds.has(even + d)) { n = even + d; break; } }
          parts.push(p.slice(0, n)); p = p.slice(n);
        }
        if (p) parts.push(p);
      }
      const pages = [];
      for (const p of parts) { const last = pages.at(-1); if (last && cjkLen(last + ' ' + p) <= maxChars) pages[pages.length - 1] = last + ' ' + p; else pages.push(p); }
      let t = c.start;
      pages.forEach((p, k) => {
        const hit = stream && k > 0 && findPhrase(stream, p.slice(0, 4), t, c.end);
        const start = k === 0 ? c.start : hit ? hit.start : t;
        if (k > 0 && captions.length) captions.at(-1).t1 = start;
        captions.push({ t0: start, t1: c.end, text: p });
        t = start + 0.2;
      });
    }
    for (const b of cat.bannedWords || []) for (const c of captions) if (c.text.includes(b.word)) warnings.push(`字幕「${c.text}」里有「${b.word}」（${b.why}）；字幕按原话保留，要不要改由你决定`);
  }

  // 风格包里的字体：只交给页面本机真实存在的文件；可选字体缺了就提醒一句
  const fonts = {};
  for (const [family, f] of Object.entries(S?.fonts || {})) {
    const file = f.file.startsWith('/styles/') ? path.join(ROOT, f.file) : f.file;
    if (fs.existsSync(file)) fonts[family] = f;
    else if (f.optional) warnings.push(`没找到可选字体 ${f.file}，用系统黑体代替（运行 npm run font 可下载开源粗黑体，效果更好）`);
    else errors.push(`风格字体文件不存在：${f.file}`);
  }
  const timeline = { version: 1, style: plan.style, fonts, dur, fps, segments: full, hostTrack, stageTrack, captions, warnings,
    aroll: plan.aroll ? { src: rel(plan.aroll), fps, offset: plan.audioOffset || 0 } : null };
  return { timeline, errors, warnings, plan, dir };
}
