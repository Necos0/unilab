/**
 * 単純多角形の重心（面積加重の中心）を求める。
 *
 * 各頂点の符号付き面積（シューレース公式）で重み付けして中心を計算するため、
 * 頂点が偏って並んでいても「面積的な真ん中」を返す。全体マップの各領域
 * ポリゴンの中央へ巻物（スクロール）を配置するのに使う。退化（面積 0）の
 * 場合は頂点の単純平均にフォールバックする。
 *
 * Args:
 *     points (Array<{x: number, y: number}>): 多角形の頂点列（閉じていなくて
 *         よい。先頭と末尾は自動で結ぶ）。
 *
 * Returns:
 *     {x: number, y: number}: 重心座標。頂点が無い場合は `{x: 0, y: 0}`。
 */
export default function polygonCentroid(points) {
  if (!points || points.length === 0) {
    return { x: 0, y: 0 };
  }

  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i += 1) {
    const p0 = points[i];
    const p1 = points[(i + 1) % points.length];
    const cross = p0.x * p1.y - p1.x * p0.y;
    twiceArea += cross;
    cx += (p0.x + p1.x) * cross;
    cy += (p0.y + p1.y) * cross;
  }

  if (twiceArea === 0) {
    const sum = points.reduce(
      (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
      { x: 0, y: 0 },
    );
    return { x: sum.x / points.length, y: sum.y / points.length };
  }

  return { x: cx / (3 * twiceArea), y: cy / (3 * twiceArea) };
}
