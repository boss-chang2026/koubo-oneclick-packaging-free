// 下载开源粗黑体 Noto Sans SC Black（SIL Open Font License 1.1，可免费商用）到 styles/basic/fonts/heavy.otf。
// 不下载也能用：页面会退回系统黑体（Mac 苹方 / Windows 微软雅黑），只是没那么粗。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const URL = 'https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Black.otf';
const out = path.join(ROOT, 'styles/basic/fonts/heavy.otf');
if (fs.existsSync(out) && fs.statSync(out).size > 1e6) { console.log('字体已存在：' + out); process.exit(0); }
console.log('下载 Noto Sans SC Black（约 9MB）…');
const res = await fetch(URL);
if (!res.ok) { console.error('下载失败：HTTP ' + res.status + '。可手动下载后放到 ' + out); process.exit(1); }
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log('已保存：' + out + '（许可：SIL OFL 1.1，https://openfontlicense.org）');
