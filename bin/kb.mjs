#!/usr/bin/env node
// 口播一键包装 · 免费版 命令行。Agent 只需要：写 plan.json → compile → check → render。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { compile, loadCatalog } from '../lib/compile.mjs';
import { extractFrames, renderVideo, stills, probe } from '../lib/render.mjs';
import { check } from '../lib/check.mjs';
import { hostFocus } from '../lib/hostfocus.mjs';
import { ROOT } from '../lib/server.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {}; const args = [];
for (let i = 0; i < rest.length; i++) { if (rest[i].startsWith('--')) { const k = rest[i].slice(2); flags[k] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true; } else args.push(rest[i]); }
const die = m => { console.error(m); process.exit(1); };

const help = `口播一键包装 · 免费版
用法：
  kb catalog                        列出全部版式（选版式的依据）
  kb words   <plan.json>            从口播原声生成逐字时间 words.json（需要 faster-whisper，可选但推荐）
  kb compile <plan.json>            校验计划并生成时间轴（只报错，不出片）
  kb check   <plan.json>            平台遮挡 / 压脸 / 出画 / 字太小检查
  kb still   <plan.json> <秒> [...] 出指定时刻的静帧，自查用
  kb render  <plan.json> [--range 起:止] [--proxy] [--out 文件]
                                    检查通过后逐帧渲染并混入原声；--proxy 出 960×540 快速预览`;

async function build(planFile, { strict = true } = {}) {
  const r = compile(planFile, { fps: +(flags.fps || 30) });
  for (const w of r.warnings) console.log('  提醒：' + w);
  if (r.errors.length) { console.error(`计划有 ${r.errors.length} 处需要修改：`); r.errors.forEach(e => console.error('  ✗ ' + e)); if (strict || !r.timeline) process.exit(2); }
  const cache = path.resolve(r.dir, r.plan.cacheDir || '.cache');
  const buildDir = path.join(cache, 'build'), framesDir = path.join(cache, 'frames');
  fs.mkdirSync(buildDir, { recursive: true });
  if (r.timeline.aroll) {
    const n = extractFrames({ aroll: r.timeline.aroll.src, framesDir, fps: r.timeline.fps });
    r.timeline.aroll = { ...r.timeline.aroll, frames: '/frames', count: n, focus: r.plan.hostFocus || await hostFocus(r.timeline.aroll.src, path.join(buildDir, 'hostfocus.json')) };
  }
  fs.writeFileSync(path.join(buildDir, 'timeline.json'), JSON.stringify(r.timeline, null, 1));
  return { ...r, buildDir, framesDir, cache };
}

if (!cmd || cmd === 'help' || cmd === '--help') { console.log(help); process.exit(0); }

if (cmd === 'catalog') {
  for (const a of loadCatalog().archetypes) {
    console.log(`\n## ${a.id} ${a.name}  （人物窗：${a.host}${a.minDur ? `，至少 ${a.minDur}s` : ''}）`);
    console.log(`用：${a.when}`);
    console.log(`不用：${a.not}`);
    console.log('字段：' + a.slots.map(s => `${s.name}${s.required ? '*' : ''}（${s.type}${s.max ? `，≤${s.max}字` : ''}${s.maxItems ? `，≤${s.maxItems}项` : ''}）${s.desc}`).join('；'));
    if (a.example) console.log('例：' + JSON.stringify(a.example));
  }
  process.exit(0);
}

const planFile = args[0] && path.resolve(args[0]);
if (!planFile || !fs.existsSync(planFile)) die('找不到计划文件：' + (args[0] || '（未给）') + '\n\n' + help);

if (cmd === 'words') {
  const plan = JSON.parse(fs.readFileSync(planFile, 'utf8')), dir = path.dirname(planFile);
  const rel = p => (path.isAbsolute(p) ? p : path.join(dir, p));
  const py = process.env.KB_PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  try { execFileSync(py, ['-I', path.join(ROOT, 'lib/words.py'), rel(plan.aroll), rel(plan.words || 'words.json'), '--srt', rel(plan.srt), '--model', flags.model || 'small'], { stdio: 'inherit' }); }
  catch { die('逐字对时失败。确认已安装：pip install faster-whisper（或用 KB_PYTHON 指向装了它的 Python）。不跑这一步也能出片，只是文字出现时点按字幕估算。'); }
} else if (cmd === 'compile') {
  const r = await build(planFile, { strict: false });
  console.log(`段落 ${r.timeline.segments.length}，字幕页 ${r.timeline.captions.length}，片长 ${r.timeline.dur.toFixed(2)}s → ${path.join(r.buildDir, 'timeline.json')}`);
  process.exit(r.errors.length ? 2 : 0);
} else if (cmd === 'still') {
  const r = await build(planFile);
  const files = await stills({ buildDir: r.buildDir, framesDir: r.framesDir, times: args.slice(1).map(Number), outDir: flags.out ? path.resolve(flags.out) : path.join(r.cache, 'stills') });
  files.forEach(f => console.log(f));
} else if (cmd === 'check' || cmd === 'render') {
  const r = await build(planFile);
  const c = await check({ buildDir: r.buildDir, framesDir: r.framesDir, dur: r.timeline.dur });
  fs.writeFileSync(path.join(r.buildDir, 'check.json'), JSON.stringify(c, null, 1));
  if (c.nudges.length) console.log('自动避让：' + c.nudges.map(n => `${n.seg} 左移 ${n.px}px`).join('，'));
  for (const it of c.issues) console.log(`  ${it.level === 'error' ? '✗' : '·'} [${it.kind}] ${it.t0.toFixed(1)}–${it.t1.toFixed(1)}s ${it.seg || '字幕'}「${it.text}」${it.msg}`);
  if (c.pageErrors.length) console.log('页面报错：' + c.pageErrors.join(' | '));
  console.log(c.pass ? `检查通过（提醒 ${c.warnings} 条）` : `检查未通过：${c.errors} 处错误`);
  if (cmd === 'check') process.exit(c.pass ? 0 : 3);
  if (!c.pass && !flags.force) die('有错误未修，不出片；修好计划后重试，或加 --force 先出样片看看');
  const range = flags.range ? String(flags.range).split(':').map(Number) : null;
  const out = flags.out ? path.resolve(flags.out) : path.join(r.cache, 'out', `preview${flags.proxy ? '-proxy' : ''}${range ? `-${range[0]}-${range[1]}` : ''}.mp4`);
  const v = await renderVideo({ buildDir: r.buildDir, framesDir: r.framesDir, fps: r.timeline.fps, dur: r.timeline.dur, out,
    audio: r.timeline.aroll?.src, audioOffset: r.timeline.aroll?.offset || 0, workers: +(flags.workers || 4), range, scale: flags.proxy ? 0.5 : 1 });
  const pr = probe(v.out);
  console.log(`出片：${v.out}\n  ${v.frames} 帧，用时 ${v.seconds.toFixed(0)}s；${pr.w}×${pr.h} ${pr.fps.toFixed(2)}fps ${pr.dur.toFixed(2)}s 音轨：${pr.hasAudio ? '有' : '无'}`);
} else die(help);
