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
 * 二次ベジェ（`M from Q control to`）として描画する。直線にしないのは、
 * `getPointAtLength` の結果が直線補間と区別できる「カーブに沿った動き」
 * になることを保証するため（要件 6-4）。
 *
 * Args:
 *     edge (object): エッジ定義。`from` / `to` はノード ID（landmark or
 *         junction）、`control` は二次ベジェの制御点。
 *     nodeById (Map<string, object>): ノード ID から定義（landmark or
 *         junction）を引くマップ。
 *
 * Returns:
 *     string: SVG `<path>` の `d` 属性値。
 */
function buildPathD(edge, nodeById) {
  const from = nodeById.get(edge.from).stopPoint;
  const to = nodeById.get(edge.to).stopPoint;
  const c = edge.control;
  return `M ${from.x},${from.y} Q ${c.x},${c.y} ${to.x},${to.y}`;
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
    </g>
  );
}

export default MapPaths;
