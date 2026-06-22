import styles from './MapRegionScrolls.module.css';
import LandmarkScroll from './LandmarkScroll';
import buildRegionPolygons from './buildRegionPolygons';
import polygonCentroid from './polygonCentroid';
import useProgressStore, { isWorldUnlocked } from '../../stores/progressStore';

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
 * 各領域はワールド単位の解放状態（`progressStore` の `unlockedWorlds`）を
 * 参照する。ワールド `1` は常に解放、それ以外は初期状態でロックされ、
 * 未解放の領域は `buildRegionPolygons` が返す曲線パス（`region.path`）で
 * 灰色に塗りつぶし、巻物にも南京錠オーバーレイ（`LandmarkScroll` の
 * `isLocked`）を重ねてクリックを抑止する。開発用 Space キー
 * （`unlockAllStages`）を押すと全ワールドが解放され、灰色塗りが消えて
 * すべての巻物がクリックできるようになる。
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
  const unlockedWorlds = useProgressStore((state) => state.unlockedWorlds);

  const regionViews = regions.map((region) => {
    const stageNumber = region.stageId.replace(/^map_/, '');
    return {
      region,
      stageNumber,
      center: polygonCentroid(region.points),
      isUnlocked: isWorldUnlocked(unlockedWorlds, stageNumber),
    };
  });

  return (
    <g>
      {/*
       * 未解放領域のグレーアウト。曲線にした領域パス（`region.path`）で
       * 該当領域だけを覆う。巻物より背面に置きたいので先に描画する。
       */}
      {regionViews
        .filter((view) => !view.isUnlocked)
        .map((view) => (
          <path
            key={`locked-${view.region.id}`}
            d={view.region.path}
            className={styles.lockedRegion}
          />
        ))}

      {regionViews.map(({ region, stageNumber, center, isUnlocked }) => (
        <g
          key={region.id}
          className={styles.region}
          data-locked={isUnlocked ? 'false' : 'true'}
          transform={`translate(${center.x}, ${center.y}) scale(${SCROLL_SCALE})`}
          onClick={isUnlocked ? () => onSelectRegion(region.stageId) : undefined}
        >
          <LandmarkScroll
            text={`ステージ${stageNumber}`}
            isStage={false}
            isLocked={!isUnlocked}
          />
        </g>
      ))}
    </g>
  );
}

export default MapRegionScrolls;
