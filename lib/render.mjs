// 逐帧渲染：无头 Chromium 打开页面，按帧调用 render(t) 截图，管道送 ffmpeg；最后混入口播原声。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { chromium } from 'playwright-core';
import { serve } from './server.mjs';

// 浏览器：优先 KB_CHROME；否则用 Playwright 安装的 chromium（npx playwright-core install chromium-headless-shell）
export function findChrome() {
  if (process.env.KB_CHROME) return process.env.KB_CHROME;
  try { const p = chromium.executablePath(); if (p && fs.existsSync(p)) return p; } catch {}
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || { darwin: path.join(os.homedir(), 'Library/Caches/ms-playwright'), win32: path.join(os.homedir(), 'AppData/Local/ms-playwright') }[process.platform] || path.join(os.homedir(), '.cache/ms-playwright');
  const dirs = fs.existsSync(base) ? fs.readdirSync(base).filter(d => /^chromium(_headless_shell)?-/.test(d)).sort().reverse() : [];
  for (const d of dirs) for (const sub of fs.readdirSync(path.join(base, d))) for (const exe of ['chrome-headless-shell', 'chrome-headless-shell.exe', 'chrome', 'chrome.exe', 'Chromium.app/Contents/MacOS/Chromium']) {
    const p = path.join(base, d, sub, exe);
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  return null; // 交给 Playwright 自己找；找不到会报错并提示安装命令
}

export async function openPage({ buildDir, framesDir, W = 1920, H = 1080, scale = 1 }) {
  const { server, url } = await serve({ buildDir, framesDir });
  const exe = findChrome();
  const args = ['--font-render-hinting=none', '--disable-lcd-text', ...(process.platform === 'darwin' ? ['--use-angle=metal'] : [])];
  let browser;
  try { browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args }); }
  catch (e) { server.close(); throw new Error('启动无头浏览器失败：' + e.message.split('\n')[0] + '\n先运行：npx playwright-core install chromium-headless-shell（或设置 KB_CHROME 指向 Chrome）'); }
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: scale });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${url}/runtime/index.html`);
  await page.waitForFunction(() => window.READY === true || window.__ERR, null, { timeout: 180000 }).catch(() => {});
  const [ready, err] = await page.evaluate(() => [window.READY === true, window.__ERR || '']);
  if (!ready) { await browser.close(); server.close(); throw new Error('页面未就绪：' + ([err, ...errors].filter(Boolean).join(' | ') || '超时')); }
  return { page, browser, server, errors, close: async () => { await browser.close(); server.close(); } };
}

export async function stills({ buildDir, framesDir, times, outDir }) {
  fs.mkdirSync(outDir, { recursive: true });
  const p = await openPage({ buildDir, framesDir });
  const files = [];
  for (const t of times) {
    await p.page.evaluate(t => window.render(t), t);
    const f = path.join(outDir, `t_${t.toFixed(2)}.jpg`);
    await p.page.screenshot({ path: f, type: 'jpeg', quality: 90 });
    files.push(f);
  }
  await p.close();
  return files;
}

async function renderChunk({ buildDir, framesDir, fps, f0, f1, out, scale = 1 }) {
  const p = await openPage({ buildDir, framesDir, scale });
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', '-r', String(fps), out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => (c ? rej(new Error('ffmpeg ' + c)) : res())));
  for (let f = f0; f < f1; f++) {
    await p.page.evaluate(t => window.render(t), f / fps);
    const buf = await p.page.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end();
  await done;
  await p.close();
}

export async function renderVideo({ buildDir, framesDir, fps, dur, out, audio, audioOffset = 0, workers = 4, range, scale = 1 }) {
  const [a, b] = range || [0, dur];
  const F0 = Math.round(a * fps), F1 = Math.round(b * fps);
  const tmp = fs.mkdtempSync(path.join(path.dirname(buildDir), 'render-'));
  const n = Math.max(1, Math.min(workers, Math.ceil((F1 - F0) / (fps * 2))));
  const per = Math.ceil((F1 - F0) / n);
  const parts = [];
  const t = Date.now();
  await Promise.all(Array.from({ length: n }, (_, i) => {
    const f0 = F0 + i * per, f1 = Math.min(F1, f0 + per);
    const part = path.join(tmp, `part${i}.mp4`); parts.push(part);
    return renderChunk({ buildDir, framesDir, fps, f0, f1, out: part, scale });
  }));
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  const silent = path.join(tmp, 'video.mp4');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (audio) execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-ss', String(a + audioOffset), '-t', String(b - a), '-i', audio,
    '-map', '0:v', '-map', '1:a:0?', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out]);
  else fs.copyFileSync(silent, out);
  fs.rmSync(tmp, { recursive: true, force: true });
  return { out, frames: F1 - F0, seconds: (Date.now() - t) / 1000 };
}

// 口播视频抽帧到缓存目录（只在缺失时抽）
export function extractFrames({ aroll, framesDir, fps, W = 1920, H = 1080 }) {
  fs.mkdirSync(framesDir, { recursive: true });
  const stamp = path.join(framesDir, '.done.json');
  const sig = JSON.stringify({ aroll, fps, W, H, mtime: fs.statSync(aroll).mtimeMs });
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === sig) return fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).length;
  for (const f of fs.readdirSync(framesDir)) if (f.endsWith('.jpg')) fs.rmSync(path.join(framesDir, f));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', aroll, '-vf', `fps=${fps},scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
    '-q:v', '2', path.join(framesDir, '%06d.jpg')]);
  fs.writeFileSync(stamp, sig);
  return fs.readdirSync(framesDir).filter(f => f.endsWith('.jpg')).length;
}

export function probe(file) {
  const j = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', file]).toString());
  const v = j.streams.find(s => s.codec_type === 'video');
  const [n, d] = (v?.r_frame_rate || '30/1').split('/').map(Number);
  return { dur: +j.format.duration, w: v?.width, h: v?.height, fps: n / d, hasAudio: j.streams.some(s => s.codec_type === 'audio') };
}
