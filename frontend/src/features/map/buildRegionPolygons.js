import REGION_PRESETS from './regionPresets';

/**
 * 境界線（`up`/`right`/`down`/`left`）の終端を地図の対応する辺へスナップする。
 *
 * 各境界線は中心点から外側へ伸び、最後の頂点が地図の辺に乗る前提。終端を辺へ
 * 正確に乗せることで、隣り合う領域ポリゴンが地図の縁まですき間なく届く。
 *
 * Args:
 *     arm (Array<{x: number, y: number}>): 中心側から外側へ並ぶ境界線の頂点列。
 *     name (string): 境界線名（`up`/`right`/`down`/`left`）。
 *     viewBox (object): `{width, height}`。スナップ先の辺の決定に使う。
 *
 * Returns:
 *     Array<{x: number, y: number}>: 終端のみ辺へスナップした頂点列の複製。
 */
function snapArmToEdge(arm, name, viewBox) {
  const points = arm.map((p) => ({ x: p.x, y: p.y }));
  const last = points[points.length - 1];
  if (name === 'up') {
    last.y = 0;
  } else if (name === 'down') {
    last.y = viewBox.height;
  } else if (name === 'left') {
    last.x = 0;
  } else if (name === 'right') {
    last.x = viewBox.width;
  }
  return points;
}

/**
 * 2 本の境界線名の組から、その領域が占める地図の角座標を求める。
 *
 * Args:
 *     arms (Array<string>): 境界線名 2 つ（順不同）。
 *     viewBox (object): `{width, height}`。
 *
 * Returns:
 *     {x: number, y: number}: 領域の角（地図四隅のいずれか）。
 */
function cornerForArms(arms, viewBox) {
  const set = new Set(arms);
  const x = set.has('left') ? 0 : viewBox.width;
  const y = set.has('up') ? 0 : viewBox.height;
  return { x, y };
}

/**
 * 順序付き頂点列を Catmull-Rom スプラインで滑らかにつなぐ三次ベジェ
 * （`C ...`）コマンド文字列に変換する。
 *
 * 先頭点へはあらかじめ `M`/`L` で到達している前提で、`points[0]` から
 * `points[末尾]` までを結ぶ曲線コマンドだけを返す。各セグメントの制御点は
 * 標準の Catmull-Rom → ベジェ変換（隣接点の差の 1/6）で求める。端点は
 * 自身を複製して扱うため、頂点列を逆順にしても得られる曲線は同一になる
 * （＝隣り合う領域が共有する境界アームを、どちら向きから描いても同じ曲線
 * にできる）。
 *
 * Args:
 *     points (Array<{x: number, y: number}>): 順序付き頂点列。
 *
 * Returns:
 *     string: 先頭点に続く曲線コマンド列。点が 1 つ以下なら空文字。
 */
function smoothSegments(points) {
  if (points.length < 2) {
    return '';
  }
  let d = '';
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? points[i + 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * 領域の輪郭を、2 本の境界アームを曲線・マップ辺に沿う閉じ部分を直線にした
 * SVG パス（`d` 属性）として組み立てる。
 *
 * 「マップの角 → 1 本目アームの辺側端点（直線）→ アームに沿って中心まで曲線
 * → 2 本目アームに沿って辺側端点まで曲線 → 角へ直線（閉じる）」の順で描く。
 * 各アームは中心を含めた頂点列を `smoothSegments` で滑らかにするため、隣り
 * 合う領域が同じアームを共有してもまったく同じ曲線になり、すき間も重なりも
 * 生じない。マップ辺に沿う 2 本の閉じ部分だけは直線のまま残す。
 *
 * Args:
 *     corner (object): 領域が占める地図の角 `{x, y}`。
 *     firstArm (Array<{x: number, y: number}>): 1 本目アームの中心側→外側の
 *         頂点列（辺へスナップ済み、中心点は含まない）。
 *     center (object): 中心点 `{x, y}`。
 *     secondArm (Array<{x: number, y: number}>): 2 本目アームの中心側→外側の
 *         頂点列（辺へスナップ済み、中心点は含まない）。
 *
 * Returns:
 *     string: 閉じた領域輪郭の SVG パス `d` 属性値。
 */
function buildRegionOutlinePath(corner, firstArm, center, secondArm) {
  const arm1FromEdge = [...firstArm].reverse().concat(center);
  const arm2FromCenter = [center, ...secondArm];
  const edgeStart = arm1FromEdge[0];
  // M corner → 直線で 1 本目アームの辺側端点へ → アーム曲線で中心へ →
  // アーム曲線で 2 本目アームの辺側端点へ → Z で角まで直線で閉じる。
  return [
    `M ${corner.x} ${corner.y}`,
    `L ${edgeStart.x} ${edgeStart.y}`,
    smoothSegments(arm1FromEdge),
    smoothSegments(arm2FromCenter),
    'Z',
  ].join('');
}

/**
 * 中心点と 4 本の境界線から、全面をすき間なく覆う領域ポリゴン群を生成する。
 *
 * 各領域は「地図の角 → 1 本目の境界線（逆向き）→ 中心 → 2 本目の境界線
 * （順向き）」の順に頂点を並べた単純多角形として組み立てる。隣り合う領域は
 * 同じ境界線を共有するため、すき間も重なりも生じない。終端を辺へスナップ
 * することで地図の縁まで完全に埋まる。いずれかの境界線がまだ 1 点も無い
 * 場合は分割を確定できないため、空配列を返す。
 *
 * Args:
 *     center (object): 中心点 `{x, y}`。全境界線が共有する。
 *     borders (object): `{up, right, down, left}`。各値は中心側から外側へ
 *         並ぶ頂点列 `[{x, y}, ...]`（中心点は含まない）。
 *     viewBox (object): `{width, height}`。
 *
 * Returns:
 *     Array<{id: string, stageId: string, color: string,
 *         points: Array<{x: number, y: number}>, path: string}>:
 *         各領域 ID・移動先・色・閉じたポリゴン頂点列・境界アームを曲線にした
 *         SVG パス `d` 属性。分割未確定なら `[]`。
 */
export default function buildRegionPolygons(center, borders, viewBox) {
  if (!center || !borders) {
    return [];
  }
  const names = ['up', 'right', 'down', 'left'];
  const hasAllArms = names.every((name) => (borders[name] ?? []).length > 0);
  if (!hasAllArms) {
    return [];
  }

  const snapped = {};
  for (const name of names) {
    snapped[name] = snapArmToEdge(borders[name], name, viewBox);
  }

  return REGION_PRESETS.map((preset) => {
    const [firstArm, secondArm] = preset.arms;
    const corner = cornerForArms(preset.arms, viewBox);
    const reversedFirst = [...snapped[firstArm]].reverse();
    const points = [corner, ...reversedFirst, center, ...snapped[secondArm]];
    const path = buildRegionOutlinePath(
      corner,
      snapped[firstArm],
      center,
      snapped[secondArm],
    );
    return {
      id: preset.id,
      stageId: preset.stageId,
      color: preset.color,
      points,
      path,
    };
  });
}
