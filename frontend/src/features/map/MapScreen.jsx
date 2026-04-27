import { useEffect } from 'react';
import styles from './MapScreen.module.css';
import MapBackground from './MapBackground';
import MapPaths from './MapPaths';
import Landmark from './Landmark';
import PlayerSprite from './PlayerSprite';
import useMapStore from '../../stores/mapStore';
import mapsData from '../../data/maps.json';

const mapDef = mapsData.maps.map_1;

/**
 * マップ画面のルートコンポーネント。
 *
 * 単一の SVG（viewBox 1920×1080）の中に、背景画像 → 道（エッジ） →
 * ランドマーク → プレイヤーの順で重ねて描画する。マウント時に
 * `mapStore.initializeMap(mapDef)` を呼んでストアを初期化する
 * （要件 1-1, 3-1, 3-3）。viewBox スケーリングにより、ウィンドウ
 * リサイズ時も背景・道・キャラの相対位置が崩れない（要件 6-3）。
 *
 * Returns:
 *     JSX.Element: マップ画面全体を表す `<section>` 要素。
 */
function MapScreen() {
  const initializeMap = useMapStore((state) => state.initializeMap);
  const isMoving = useMapStore((state) => state.isMoving);
  const requestMove = useMapStore((state) => state.requestMove);

  useEffect(() => {
    initializeMap(mapDef);
  }, [initializeMap]);

  const { viewBox } = mapDef;

  return (
    <section className={styles.root}>
      <svg
        className={styles.svg}
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <MapBackground mapDef={mapDef} />
        <MapPaths mapDef={mapDef} />
        {mapDef.landmarks.map((landmark) => (
          <Landmark
            key={landmark.id}
            landmark={landmark}
            isMoving={isMoving}
            onClick={requestMove}
          />
        ))}
        <PlayerSprite />
      </svg>
    </section>
  );
}

export default MapScreen;
