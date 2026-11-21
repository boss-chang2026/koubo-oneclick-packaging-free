// 生成演示素材：一段 20 秒的测试口播（彩色测试画面 + 提示音）和一张测试截图，用来验证安装是否成功。
// 真实使用时换成你自己的口播视频和字幕。
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../examples/demo');
const ff = a => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...a], { stdio: 'inherit' });
if (!fs.existsSync(path.join(dir, 'aroll.mp4'))) {
  ff(['-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=30:duration=20', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=20',
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', path.join(dir, 'aroll.mp4')]);
}
if (!fs.existsSync(path.join(dir, 'screenshot.png'))) {
  ff(['-f', 'lavfi', '-i', 'smptehdbars=size=1600x1000', '-frames:v', '1', path.join(dir, 'screenshot.png')]);
}
console.log('演示素材已生成：' + dir);
