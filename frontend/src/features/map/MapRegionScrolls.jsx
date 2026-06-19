import styles from './MapRegionScrolls.module.css';
import LandmarkScroll from './LandmarkScroll';
import buildRegionPolygons from './buildRegionPolygons';
import polygonCentroid from './polygonCentroid';

/*
 * 全体マップの巻物は、バイオームマップ上のランドマーク巻物より一回り大きく
 * 見せたいので 1.5 倍に拡大する。中心（重心）を原点に描く `LandmarkScroll`
 * を、重心へ平行移動したあと拡大することで、重心を保ったまま拡大する。
 */
const SCROLL_SCALE = 1.5;

/**
 * 全体マップ（`map_0`）の各領域の中央に、移動先マップへ飛ぶための巻物
 * （スクロール）を配置するコンポーネント。
 *
 * `mapDef.regionCenter` と `mapDef.regionBorders` から `buildRegionPolygons` で
 * 4 領域のポリゴンを求め、各ポリゴンの重心（`polygonCentroid`）へ
 * `LandmarkScroll` を 1 つずつ置く。巻物には「ステージ N」（N は移動先マップ
 * キー末尾の数字）を載せ、ランドマーク巻物より大きく見せるため 1.5 倍に拡大
 * する。巻物クリックで `onSelectRegion` にその領域の移動先マップキー
 * （`map_1`〜`map_4`）を渡し、マップ移動を発火する。
 *
 * 境界線が 4 本そろっていない（領域を確定できない）場合、`buildRegionPolygons`
 * は空配列を返すため何も描画しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         mapDef (object): 全体マップの定義。`regionCenter` / `regionBorders` /
 *             `viewBox` を参照する。
 *         onSelectRegion (function): 巻物クリック時に移動先マップキーを渡して
 *             呼ぶ関数。
 *
 * Returns:
 *     JSX.Element: 領域ごとの巻物を含む `<g>` 要素。
 */
function MapRegionScrolls({ mapDef, onSelectRegion }) {
  const regions = buildRegionPolygons(
    mapDef.regionCenter,
    mapDef.regionBorders,
    mapDef.viewBox,
  );

  return (
    <g>
      {regions.map((region) => {
        const center = polygonCentroid(region.points);
        const stageNumber = region.stageId.replace(/^map_/, '');
        return (
          <g
            key={region.id}
            className={styles.region}
            transform={`translate(${center.x}, ${center.y}) scale(${SCROLL_SCALE})`}
            onClick={() => onSelectRegion(region.stageId)}
          >
            <LandmarkScroll text={`ステージ${stageNumber}`} isStage={false} />
          </g>
        );
      })}
    </g>
  );
}

export default MapRegionScrolls;
