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
 *         points: Array<{x: number, y: number}>}>:
 *         各領域 ID・移動先・色・閉じたポリゴン頂点列。分割未確定なら `[]`。
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
    return {
      id: preset.id,
      stageId: preset.stageId,
      color: preset.color,
      points,
    };
  });
}
