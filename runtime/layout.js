// 排版检查小工具：浏览器端用来避免孤字换行，node 端用来判断文字互相压住。

// 两段可读文字互相压住超过较小一段的 15%，算重叠
export function textCollision(a, b) {
  if (a.entering || b.entering) return false;
  const overlap = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const small = Math.min((a.x1 - a.x0) * (a.y1 - a.y0), (b.x1 - b.x0) * (b.y1 - b.y0));
  return small > 0 && overlap / small > .15;
}

// 量出实际渲染的每一行文字
export function textLines(node) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), rows = [];
  let text;
  while ((text = walker.nextNode())) for (let i = 0; i < text.length; i++) {
    const ch = text.data[i]; if (!ch.trim()) continue;
    const range = document.createRange(); range.setStart(text, i); range.setEnd(text, i + 1);
    const b = range.getBoundingClientRect(); if (!b.width || !b.height) continue;
    let row = rows.find(r => Math.abs(r.y - b.y) < b.height * .35);
    if (!row) rows.push(row = { y: b.y, text: '' });
    row.text += ch;
  }
  return rows.sort((a, b) => a.y - b.y).map(r => r.text);
}

// 最后一行只剩一个汉字（孤字）
export function hasOrphan(node) {
  const lines = textLines(node);
  return lines.length > 1 && /^[\p{Script=Han}][，。？！、；：]*$/u.test(lines.at(-1));
}
