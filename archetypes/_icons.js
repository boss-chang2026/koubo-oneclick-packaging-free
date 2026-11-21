// 线性小图标（短标签配图标点缀）。64×64 视窗，金色描边，按语义名取用。
const P = {
  产品: 'M8 12h48v40H8zM8 22h48M14 17h1M20 17h1M26 17h1M18 30h10v12H18zM36 30h10M36 37h10M18 47h28',
  行业: 'M10 54V22l14-8v40M24 54V10h22v44M46 54V28h10v26M8 54h50M30 18h4M38 18h4M30 28h4M38 28h4M30 38h4M38 38h4',
  岗位: 'M8 22h48v30H8zM24 22v-8h16v8M8 34h48',
  薪资: 'M32 8a24 24 0 1 0 .1 0M24 20l8 10 8-10M22 32h20M22 40h20M32 30v18',
  钱: 'M32 8a24 24 0 1 0 .1 0M24 20l8 10 8-10M22 32h20M22 40h20M32 30v18',
  时间: 'M32 8a24 24 0 1 0 .1 0M32 18v14l10 8',
  精力: 'M36 6L16 36h14l-4 22 22-32H34z',
  寿命: 'M32 54S8 40 8 24a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 16-24 30-24 30z',
  自由: 'M8 40c10-4 18-14 22-28 4 10 12 16 26 18-12 2-20 8-24 18-6-6-14-8-24-8z',
  搜索: 'M28 10a16 16 0 1 0 .1 0M40 40l14 14',
  筛选: 'M8 12h48L38 34v18l-12 6V34z',
  简历: 'M14 8h28l10 10v38H14zM42 8v10h10M22 28h22M22 36h22M22 44h14',
  文档: 'M14 8h28l10 10v38H14zM42 8v10h10M22 28h22M22 36h22M22 44h14',
  求职信: 'M8 16h48v32H8zM8 16l24 18 24-18',
  面试: 'M8 12h34v22H22l-8 8v-8H8zM26 38v6h16l8 8v-8h6V24H46',
  进度: 'M8 54h48M14 44v10M26 34v20M38 24v30M50 14v40',
  数据: 'M8 54h48M14 44v10M26 34v20M38 24v30M50 14v40',
  出处: 'M10 12h18a6 6 0 0 1 6 6v36a6 6 0 0 0-6-6H10zM54 12H38a6 6 0 0 0-6 6v36a6 6 0 0 1 6-6h16z',
  书: 'M10 12h18a6 6 0 0 1 6 6v36a6 6 0 0 0-6-6H10zM54 12H38a6 6 0 0 0-6 6v36a6 6 0 0 1 6-6h16z',
  成本收益: 'M32 8v46M14 54h36M10 20h44M10 20l-6 14h12zM54 20l-6 14h12z',
  勾: 'M12 34l14 14 26-30',
  星: 'M32 8l7 15 16 2-12 11 3 16-14-8-14 8 3-16L9 25l16-2z',
  文件夹: 'M8 18h18l6 6h24v28H8z',
  人: 'M32 10a10 10 0 1 0 .1 0M14 54c0-12 8-20 18-20s18 8 18 20',
  目标: 'M32 8a24 24 0 1 0 .1 0M32 18a14 14 0 1 0 .1 0M32 28a4 4 0 1 0 .1 0',
  灯泡: 'M32 8a16 16 0 0 0-10 28c3 3 4 6 4 10h12c0-4 1-7 4-10A16 16 0 0 0 32 8M26 52h12M28 58h8',
  手机: 'M20 6h24v52H20zM28 50h8',
  网络: 'M8 24a34 34 0 0 1 48 0M16 32a22 22 0 0 1 32 0M24 40a10 10 0 0 1 16 0M32 50h.1',
  公司: 'M10 54V22l14-8v40M24 54V10h22v44M46 54V28h10v26M8 54h50M30 18h4M38 18h4M30 28h4M38 28h4M30 38h4M38 38h4',
  工具: 'M40 8a12 12 0 0 0-10 18L10 46a5 5 0 0 0 8 8l20-20a12 12 0 0 0 18-10l-8 6-6-2-2-6z',
  视频: 'M8 14h48v36H8zM28 24v16l12-8z',
  流程: 'M4 24h14v16H4zM25 24h14v16H25zM46 24h14v16H46zM18 32h7M22 29l3 3-3 3M39 32h7M43 29l3 3-3 3',
};
export const ICON_NAMES = Object.keys(P);
export function icon(parent, name, size = 72) {
  const d = P[name];
  if (!d) return null;
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 64 64'); s.setAttribute('width', size); s.setAttribute('height', size);
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', d); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'var(--gold)'); p.setAttribute('stroke-width', '4');
  p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round');
  s.append(p); parent.append(s);
  return s;
}
