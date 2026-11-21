// 抖音遮挡判定。浏览器端（排版时自动避让）和 node 端（出片前检查）共用这一份。
//
// 标定来源：1080×2348 抖音竖屏截图，
// 观看状态为「竖屏信息流中居中显示横版视频」。横版视频里只剩右侧头像/点赞/评论一列。
// 规则：遮挡区里可以放东西；只有重点信息被明显挡住才算失败——
// 被遮面积超过 AREA_LIMIT，或至少有一个字被整个盖住。装饰、底纹不判。

const REF = { width: 1080, height: 2348, landscapeCenterY: 0.4323 };
const REGIONS = [
  { id: 'avatar', label: '头像', x: .86, y: .391, width: .135, height: .075 },
  { id: 'like', label: '点赞', x: .868, y: .477, width: .125, height: .07 },
  { id: 'comment', label: '评论', x: .868, y: .557, width: .125, height: .064 },
  { id: 'favorite', label: '收藏', x: .868, y: .637, width: .125, height: .067 },
  { id: 'share', label: '分享', x: .868, y: .714, width: .125, height: .073 },
];

export const AREA_LIMIT = 0.15;
export const KEY_ROLES = ['title', 'label', 'key', 'number', 'quote', 'item'];

// 返回视频像素坐标下的遮挡矩形 [{id,label,x0,y0,x1,y1}]
export function douyinRegions(W, H) {
  const aspect = W / H, dev = REF.width / REF.height;
  if (aspect < 1) return []; // 竖版另行标定，本版不处理
  const fy = REF.landscapeCenterY - dev / aspect / 2, fh = dev / aspect;
  return REGIONS.flatMap(r => {
    const top = Math.max(r.y, fy), bottom = Math.min(r.y + r.height, fy + fh);
    if (bottom <= top) return [];
    return [{ id: r.id, label: r.label, x0: r.x * W, x1: (r.x + r.width) * W, y0: (top - fy) / fh * H, y1: (bottom - fy) / fh * H }];
  });
}

const inter = (a, b) => {
  const w = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0), h = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
  return w > 0 && h > 0 ? { w, h } : null;
};

// box: {x0,y0,x1,y1,fontSize?}; 返回 null 表示没问题，否则给出原因
export function occlusionVerdict(box, regions) {
  const area = (box.x1 - box.x0) * (box.y1 - box.y0);
  if (area <= 0) return null;
  const fs = box.fontSize || (box.y1 - box.y0);
  let covered = 0, fullChar = null;
  for (const r of regions) {
    const o = inter(box, r);
    if (!o) continue;
    covered += o.w * o.h;
    // 一个字被整个盖住：横向盖过约一个字宽，且纵向盖过字高的 80%
    if (o.w >= fs * 0.9 && o.h >= Math.min(fs, box.y1 - box.y0) * 0.8) fullChar = r.label;
  }
  const ratio = covered / area;
  if (fullChar) return { reason: `有字被「${fullChar}」整块挡住`, ratio };
  if (ratio > AREA_LIMIT) return { reason: `被遮 ${(ratio * 100).toFixed(0)}%（上限 ${AREA_LIMIT * 100}%）`, ratio };
  return null;
}

// 为通过检查需要整体左移多少像素（0 表示不用移）
export function nudgeLeft(box, regions, margin = 24) {
  if (!occlusionVerdict(box, regions)) return 0;
  let need = 0;
  for (const r of regions) if (inter(box, r)) need = Math.max(need, box.x1 - r.x0 + margin);
  return Math.ceil(need);
}
