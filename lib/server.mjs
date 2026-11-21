// 本地静态服务：/runtime /archetypes /styles 来自本仓库；/build 与 /frames 来自本片缓存目录；
// /asset?p=<绝对路径> 读取本片素材（截图等）。只监听 127.0.0.1，随机端口，渲染完就关。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf' };

export function serve({ buildDir, framesDir, port = 0 }) {
  const mounts = { runtime: path.join(ROOT, 'runtime'), archetypes: path.join(ROOT, 'archetypes'), styles: path.join(ROOT, 'styles'), build: buildDir, frames: framesDir };
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    let file;
    if (u.pathname === '/asset') file = u.searchParams.get('p');
    else {
      const [, top, ...rest] = decodeURIComponent(u.pathname).split('/');
      const base = mounts[top];
      if (base) { file = path.join(base, ...rest); if (!file.startsWith(base)) file = null; }
    }
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(r => server.listen(port, '127.0.0.1', () => r({ server, url: `http://127.0.0.1:${server.address().port}` })));
}
