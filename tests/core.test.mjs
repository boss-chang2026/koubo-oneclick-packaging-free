import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseSrt } from '../lib/srt.mjs';
import { charStream, findPhrase } from '../lib/align.mjs';
import { compile, loadCatalog } from '../lib/compile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('SRT 解析', () => {
  const c = parseSrt('1\n00:00:01,000 --> 00:00:02,500\n你好\n\n2\n00:00:02,500 --> 00:00:04,000\n世界\n');
  assert.equal(c.length, 2); assert.equal(c[1].start, 2.5); assert.equal(c[0].text, '你好');
});

test('原声找词（中文数字与阿拉伯数字互认）', () => {
  const s = charStream([{ w: '省下', s: 1, e: 1.4 }, { w: '九十', s: 1.4, e: 1.8 }, { w: '分钟', s: 1.8, e: 2.2 }]);
  assert.equal(findPhrase(s, '90分钟').start, 1.4);
  assert.equal(findPhrase(s, '不存在的词'), null);
});

test('版式目录里的图标名都有图形', async () => {
  const src = fs.readFileSync(path.join(ROOT, 'archetypes/_icons.js'), 'utf8');
  for (const a of loadCatalog().archetypes) for (const sl of a.slots) if (sl.name === 'icons') for (const v of sl.values) assert.ok(src.includes(`${v}:`), `缺图标 ${v}`);
  for (const a of loadCatalog().archetypes) assert.ok(fs.existsSync(path.join(ROOT, 'archetypes', a.id + '.js')), `缺版式 ${a.id}`);
});

test('演示计划能编译、无报错', () => {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts/make-demo.mjs')]);
  const r = compile(path.join(ROOT, 'examples/demo/plan.json'));
  assert.deepEqual(r.errors, []);
  assert.ok(r.timeline.segments.some(s => s.archetype === 'D1'));
  assert.ok(r.timeline.captions.every(c => c.text.length <= 14));
});

test('计划写错时给出可照着改的中文报错', () => {
  const dir = fs.mkdtempSync(path.join(ROOT, 'examples/demo/.tmp-'));
  try {
    fs.copyFileSync(path.join(ROOT, 'examples/demo/demo.srt'), path.join(dir, 'demo.srt'));
    fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ version: 1, srt: 'demo.srt', segments: [{ cues: [2, 2], archetype: 'A1', slots: { key: '这个关键词实在是太长了' } }, { cues: [2, 3], archetype: 'ZZ' }] }));
    const r = compile(path.join(dir, 'plan.json'));
    assert.ok(r.errors.some(e => e.includes('超过 8 字')));
    assert.ok(r.errors.some(e => e.includes('不存在')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
