// SRT 读写。时间统一为秒（浮点）。
import fs from 'node:fs';

const TS = /(\d+):(\d+):(\d+)[,.](\d+)/;
const toSec = s => { const m = TS.exec(s); return m ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) + (+m[4]) / 10 ** m[4].length : NaN; };

export function parseSrt(text) {
  const cues = [];
  for (const block of text.replace(/\r/g, '').replace(/^﻿/, '').split(/\n\s*\n/)) {
    const lines = block.trim().split('\n');
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const body = lines.slice(i + 1).join('').trim();
    if (!body) continue;
    cues.push({ index: cues.length + 1, start: toSec(a), end: toSec(b), text: body });
  }
  return cues;
}

export const readSrt = file => parseSrt(fs.readFileSync(file, 'utf8'));

const pad = (n, w = 2) => String(n).padStart(w, '0');
export function fmtTs(sec) {
  const ms = Math.round(sec * 1000);
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

export const writeSrt = cues => cues.map((c, i) => `${i + 1}\n${fmtTs(c.start)} --> ${fmtTs(c.end)}\n${c.text}\n`).join('\n');
