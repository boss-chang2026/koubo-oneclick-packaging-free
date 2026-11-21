// 主播位置：每秒抽 2 帧缩成小图，统计相邻帧变化最大的区域（说话的人一直在动，背景不动），
// 按列求变化量的加权中心，作为主播水平中心。结果缓存在 cacheDir/build/hostfocus.json。
import fs from 'node:fs';
import { spawn } from 'node:child_process';

export function hostFocus(video, cacheFile, { fps = 2, w = 160, h = 90 } = {}) {
  const sig = JSON.stringify({ video, mtime: fs.statSync(video).mtimeMs });
  try { const c = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); if (c.sig === sig) return Promise.resolve(c.focus); } catch {}
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-loglevel', 'error', '-i', video, '-vf', `fps=${fps},scale=${w}:${h},format=gray`, '-f', 'rawvideo', '-']);
    const chunks = []; ff.stdout.on('data', d => chunks.push(d));
    ff.on('close', code => {
      if (code) return reject(new Error('ffmpeg ' + code));
      const buf = Buffer.concat(chunks), size = w * h, n = Math.floor(buf.length / size);
      const col = new Float64Array(w), row = new Float64Array(h);
      for (let i = 1; i < n; i++) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const d = Math.abs(buf[i * size + y * w + x] - buf[(i - 1) * size + y * w + x]);
        if (d > 6) { col[x] += d; row[y] += d; }
      }
      const total = col.reduce((a, b) => a + b, 0);
      let fx = 0.5;
      if (total > 0) {
        // 去掉两侧各 10% 的长尾（手势），取中间 80% 的加权中心
        let acc = 0, lo = 0, hi = w - 1;
        for (let x = 0; x < w; x++) { acc += col[x]; if (acc < total * 0.1) lo = x; if (acc < total * 0.9) hi = x; }
        let s = 0, m = 0; for (let x = lo; x <= hi; x++) { s += col[x]; m += col[x] * x; }
        fx = s ? m / s / (w - 1) : 0.5;
      }
      const focus = [+fx.toFixed(3), 0.34];
      fs.writeFileSync(cacheFile, JSON.stringify({ sig, focus }));
      resolve(focus);
    });
  });
}
