import { useEffect } from 'react';
import styles from './MapScreen.module.css';
import MapBackground from './MapBackground';
import MapPaths from './MapPaths';
import Landmark from './Landmark';
import PlayerSprite from './PlayerSprite';
import BattleDemoButton from './BattleDemoButton';
import FullscreenToggleButton from './FullscreenToggleButton';
import useMapStore from '../../stores/mapStore';
import useProgressStore from '../../stores/progressStore';
import mapsData from '../../data/maps.json';

const mapDef = mapsData.maps.map_1;

/**
 * マップ画面のルートコンポーネント。
 *
 * 単一の SVG（viewBox 1920×1080）の中に、背景画像 → 道（エッジ） →
 * ランドマーク → プレイヤーの順で重ねて描画する。マウント時に
 * `mapStore.initializeMap(mapDef)` を呼んでストアを初期化する
 * （要件 1-1, 3-1, 3-3）。ただしバトル画面に遷移して戻ってきた際の
 * 再マウントで初期化が走ると `currentLocation` が出発点に戻ってしまい、
 * 「戦った場所に居続ける」要件を満たせない。そのため初期化はストアが
 * 未初期化（`mapDef === null`）のときだけ行う。viewBox スケーリングに
 * より、ウィンドウリサイズ時も背景・道・キャラの相対位置が崩れない
 * （要件 6-3）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onStartBattle (function): ランドマーク詳細パネルの「たたかう」
 *             ボタン押下時に `stageId` を渡して呼ぶ関数。
 *         onStartBattleDemo (function): デバッグ用「バトルデモ」ボタン
 *             押下時に呼ぶ関数（引数なし）。
 *
 * Returns:
 *     JSX.Element: マップ画面全体を表す `<section>` 要素。
 */
function MapScreen({ onStartBattle, onStartBattleDemo }) {
  const initializeMap = useMapStore((state) => state.initializeMap);
  const isMoving = useMapStore((state) => state.isMoving);
  const currentLocation = useMapStore((state) => state.currentLocation);
  const requestMove = useMapStore((state) => state.requestMove);

  useEffect(() => {
    if (useMapStore.getState().mapDef === null) {
      initializeMap(mapDef);
    }
  }, [initializeMap]);

  /*
   * バトル画面から戻った直後に `pendingUnlockStageId` が立っていれば、
   * 解放アニメーションを起動する（要件 5-1）。既にアニメ中であれば
   * `startUnlockAnimation` 側で no-op になるため、マウント時に毎回
   * 呼んで構わない。空依存配列にして「マウントごとに 1 回だけ判定」
   * の挙動にする。
   */
  useEffect(() => {
    const { pendingUnlockStageId, startUnlockAnimation } =
      useProgressStore.getState();
    if (pendingUnlockStageId !== null) {
      startUnlockAnimation();
    }
  }, []);

  /*
   * テスト用ショートカット：Space キーを押すと全ステージを即座に解放する。
   * input/textarea にフォーカスがある場合と、修飾キー同時押しは無視する。
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code !== 'Space') {
        return;
      }
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA')
      ) {
        return;
      }
      event.preventDefault();
      useProgressStore.getState().unlockAllStages();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const { viewBox } = mapDef;

  return (
    <section className={styles.root}>
      <div className={styles.canvas}>
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
              currentLocation={currentLocation}
              onClick={requestMove}
              onStartBattle={onStartBattle}
            />
          ))}
          <PlayerSprite />
        </svg>
        <FullscreenToggleButton />
        <BattleDemoButton onClick={onStartBattleDemo} />
      </div>
    </section>
  );
}

export default MapScreen;
