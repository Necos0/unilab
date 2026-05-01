import styles from './MapPaths.module.css';

/**
 * 1 本のエッジを SVG path 文字列に変換する。
 *
 * 端点には両端ノードの `stopPoint`（道上の停止点）を使う。エッジは
 * クリック可能な「ランドマーク」と、クリック不可の「分岐点（junction）」
 * のどちらにも繋がり得るため、ノード ID から両配列を横断して引く。
 * `position`（アイコン・クリック位置）はランドマーク本体の見た目位置で
 * あり、道のラインとは別軸で設定するため両者を区別する。
 *
 * `edge.waypoints`（道上の通過点列）と両端の `stopPoint` をつないだ
 * 点列に対し、各セグメントを **Catmull-Rom スプライン** として 3 次ベジェに
 * 変換し連結する。これにより指定した全 waypoint を必ず通り、隣接セグメント
 * とは接線を共有して滑らかに繋がる。曲線の追従性は waypoint 数に応じて
 * 細かく制御でき、複雑な道に直接合わせられる。`getPointAtLength` は
 * 連結 path 上でも一貫して動作するためプレイヤーの移動ロジックに影響なし
 * （要件 6-4）。
 *
 * Catmull-Rom → 3 次ベジェ変換: 連続する 4 点 P_{i-1}, P_i, P_{i+1}, P_{i+2}
 * から、P_i → P_{i+1} 区間の制御点を
 *   C1 = P_i     + (P_{i+1} − P_{i-1}) / 6
 *   C2 = P_{i+1} − (P_{i+2} − P_i)     / 6
 * で定める（テンション=1 の標準 Catmull-Rom）。両端では仮想点を反射で生成
 * （`P_{-1} = 2 P_0 − P_1` 等）して「端点で滑らかに開始/終了」させる。
 *
 * Args:
 *     edge (object): エッジ定義。`from` / `to` はノード ID、
 *         `waypoints` は道に沿った通過点 `[{x,y}, ...]`（任意、0 個でも可）。
 *     nodeById (Map<string, object>): ノード ID から定義（landmark or
 *         junction）を引くマップ。
 *
 * Returns:
 *     string: SVG `<path>` の `d` 属性値（`M` + 連結された `C` 群）。
 */
function buildPathD(edge, nodeById) {
  const from = nodeById.get(edge.from).stopPoint;
  const to = nodeById.get(edge.to).stopPoint;
  const waypoints = edge.waypoints ?? [];
  const pts = [from, ...waypoints, to];

  const first = pts[0];
  const second = pts[1];
  const last = pts[pts.length - 1];
  const secondLast = pts[pts.length - 2];
  const phantomStart = { x: 2 * first.x - second.x, y: 2 * first.y - second.y };
  const phantomEnd = { x: 2 * last.x - secondLast.x, y: 2 * last.y - secondLast.y };
  const ext = [phantomStart, ...pts, phantomEnd];

  const parts = [`M ${first.x},${first.y}`];
  for (let i = 1; i < ext.length - 2; i += 1) {
    const pPrev = ext[i - 1];
    const p0 = ext[i];
    const p1 = ext[i + 1];
    const pNext = ext[i + 2];
    const c1x = p0.x + (p1.x - pPrev.x) / 6;
    const c1y = p0.y + (p1.y - pPrev.y) / 6;
    const c2x = p1.x - (pNext.x - p0.x) / 6;
    const c2y = p1.y - (pNext.y - p0.y) / 6;
    parts.push(`C ${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p1.x},${p1.y}`);
  }
  return parts.join(' ');
}

/**
 * マップ上の道（エッジ）をすべて SVG `<path>` として描画するコンポーネント。
 *
 * `mapDef.edges` をループしてエッジごとに 1 本の `<path>` を生成する
 * （要件 2-2, 6-2）。各 `<path>` には `data-edge-id` を付け、`PlayerSprite`
 * から DOM 経由で `getPointAtLength()` を呼び出せるようにする（要件 6-4）。
 * エッジ端点は landmark / junction のどちらでもよく、ノード探索マップを
 * 両配列から構築する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         mapDef (object): `maps.json` の 1 マップ分。
 *
 * Returns:
 *     JSX.Element: 道の `<path>` 群を含む `<g>` 要素。
 */
function MapPaths({ mapDef }) {
  const nodeById = new Map([
    ...mapDef.landmarks.map((lm) => [lm.id, lm]),
    ...(mapDef.junctions ?? []).map((j) => [j.id, j]),
  ]);

  return (
    <g className={styles.paths}>
      {mapDef.edges.map((edge) => (
        <path
          key={edge.id}
          data-edge-id={edge.id}
          d={buildPathD(edge, nodeById)}
          className={styles.path}
        />
      ))}
      {/* DEBUG: waypoints を可視化（座標調整用、確定後は削除）*/}
      <g className={styles.waypointsDebug}>
        {mapDef.edges.flatMap((edge) =>
          (edge.waypoints ?? []).map((wp, idx) => (
            <circle
              key={`${edge.id}-wp-${idx}`}
              cx={wp.x}
              cy={wp.y}
              r="8"
              className={styles.waypoint}
            />
          )),
        )}
      </g>
    </g>
  );
}

export default MapPaths;
