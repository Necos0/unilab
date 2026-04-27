import styles from './MapPaths.module.css';

/**
 * 1 本のエッジを SVG path 文字列に変換する。
 *
 * 二次ベジェ（`M from Q control to`）として描画する。直線にしないのは、
 * `getPointAtLength` の結果が直線補間と区別できる「カーブに沿った動き」
 * になることを保証するため（要件 6-4）。
 *
 * Args:
 *     edge (object): エッジ定義。`from` / `to` は両端ランドマーク ID、
 *         `control` は二次ベジェの制御点。
 *     landmarkById (Map<string, object>): ランドマーク ID から
 *         ランドマーク定義を引くマップ。
 *
 * Returns:
 *     string: SVG `<path>` の `d` 属性値。
 */
function buildPathD(edge, landmarkById) {
  const from = landmarkById.get(edge.from).position;
  const to = landmarkById.get(edge.to).position;
  const c = edge.control;
  return `M ${from.x},${from.y} Q ${c.x},${c.y} ${to.x},${to.y}`;
}

/**
 * マップ上の道（エッジ）をすべて SVG `<path>` として描画するコンポーネント。
 *
 * `mapDef.edges` をループしてエッジごとに 1 本の `<path>` を生成する
 * （要件 2-2, 6-2）。各 `<path>` には `data-edge-id` を付け、`PlayerSprite`
 * から DOM 経由で `getPointAtLength()` を呼び出せるようにする（要件 6-4）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         mapDef (object): `maps.json` の 1 マップ分。
 *
 * Returns:
 *     JSX.Element: 道の `<path>` 群を含む `<g>` 要素。
 */
function MapPaths({ mapDef }) {
  const landmarkById = new Map(mapDef.landmarks.map((lm) => [lm.id, lm]));

  return (
    <g className={styles.paths}>
      {mapDef.edges.map((edge) => (
        <path
          key={edge.id}
          data-edge-id={edge.id}
          d={buildPathD(edge, landmarkById)}
          className={styles.path}
        />
      ))}
    </g>
  );
}

export default MapPaths;
