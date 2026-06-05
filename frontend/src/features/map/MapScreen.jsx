import { useCallback, useEffect, useMemo, useState } from 'react';
import styles from './MapScreen.module.css';
import MapBackground from './MapBackground';
import MapPaths from './MapPaths';
import Landmark from './Landmark';
import PlayerSprite from './PlayerSprite';
import MapOverlay from './MapOverlay';
import BattleDemoButton from './BattleDemoButton';
// DEBUG: 座標調整時に有効化する。再開時は下のコメントアウトと合わせて戻す。
// import CoordinateGrid from './CoordinateGrid';
import FullscreenToggleButton from './FullscreenToggleButton';
import MapTravelButton from './MapTravelButton';
import MapSelectOverlay from './MapSelectOverlay';
import MapSwitchTransition from './MapSwitchTransition';
import MapEditorLayer from './MapEditorLayer';
import MapEditorPanel from './MapEditorPanel';
import MapEditorToggleButton from './MapEditorToggleButton';
import useMapStore from '../../stores/mapStore';
import useMapEditorStore from '../../stores/mapEditorStore';
import useProgressStore from '../../stores/progressStore';
import mapsData from '../../data/maps.json';

const DEFAULT_MAP_ID = 'map_1';

/*
 * マップ ID → 表示ラベル の対応表。専用のアイコン画像と日本語名を用意
 * するまでの暫定で、`maps.json` の側にラベルを持たせる選択肢もあるが、
 * 現状はマップ移動 UI でしか使わないためこの近くに置く。マップを増やし
 * たらここに 1 行足す。
 */
const MAP_LABELS = {
  map_1: 'マップ 1（草原）',
  map_2: 'マップ 2（砂漠）',
  map_3: 'マップ 3（海岸）',
};

/**
 * マップ画面のルートコンポーネント。
 *
 * 単一の SVG（viewBox 1920×1080）の中に、背景画像 → 道（エッジ） →
 * ランドマーク → プレイヤーの順で重ねて描画する。マウント時にストアが
 * 未初期化（`mapDef === null`）であれば `initializeMap` を呼ぶ
 * （要件 1-1, 3-1, 3-3）。バトル画面に遷移して戻ってきた際の再マウントで
 * 初期化が走ると `currentLocation` が出発点に戻ってしまうため、初期化は
 * 未初期化のときだけに限定する。viewBox スケーリングにより、ウィンドウ
 * リサイズ時も背景・道・キャラの相対位置が崩れない（要件 6-3）。
 *
 * 表示するマップ定義はストアの `currentMapId` から `maps.json` を引いて
 * 解決する。右下の「マップ移動」ボタンを押すと `MapSelectOverlay` を開き、
 * マップを選ぶと `MapSwitchTransition`（黒フェード）を挟んで `switchMap`
 * を呼ぶ。フェードイン完了時にマップを切り替えることで、画像の差し替えと
 * 勇者の `startId` への再配置が黒幕の裏側で行われ、視覚的に唐突さが出ない。
 * 切替時は新マップの `startId` に勇者を再配置する（移動中状態と残セグメント
 * もリセット）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onStartBattle (function): ランドマーク詳細パネルの「たたかう」
 *             ボタン押下時に `stageId` を渡して呼ぶ関数。
 *         onStartBattleDemo (function): デバッグ用「バトルデモ」ドロップダウン
 *             で選択されたステージ ID を渡して呼ぶ関数（`onStartBattle` と
 *             同じシグネチャ）。`BattleDemoButton` の `onSelectStage` props
 *             として転送される。
 *         demoStageIds (Array<string>): バトルデモドロップダウンに並べる
 *             ステージ ID 配列。`stagesLoader.js` 経由で `stages.json` の
 *             `demoStageIds` から流れてくる。
 *
 * Returns:
 *     JSX.Element: マップ画面全体を表す `<section>` 要素。
 */
function MapScreen({ onStartBattle, onStartBattleDemo, demoStageIds }) {
  const initializeMap = useMapStore((state) => state.initializeMap);
  const switchMap = useMapStore((state) => state.switchMap);
  const isMoving = useMapStore((state) => state.isMoving);
  const currentLocation = useMapStore((state) => state.currentLocation);
  const requestMove = useMapStore((state) => state.requestMove);
  const currentMapId =
    useMapStore((state) => state.currentMapId) ?? DEFAULT_MAP_ID;

  /*
   * マップ座標エディタ（開発用）。編集中は表示マップを `draft` に差し替えて
   * 道・背景をライブ更新し、ランドマーク／プレイヤーの代わりに座標ハンドル
   * （`MapEditorLayer`）と操作パネル（`MapEditorPanel`）を出す。
   */
  const isEditing = useMapEditorStore((state) => state.isEditing);
  const editorDraft = useMapEditorStore((state) => state.draft);
  const stopEditing = useMapEditorStore((state) => state.stopEditing);

  const mapDef = mapsData.maps[currentMapId];
  const renderMap = isEditing && editorDraft ? editorDraft : mapDef;

  const [isMapSelectOpen, setIsMapSelectOpen] = useState(false);
  /*
   * `pendingMapId` が立っている間は `MapSwitchTransition` がマウントされ、
   * 黒フェード演出が走る。フェードイン完了で `switchMap` を呼び、フェード
   * アウト完了で `pendingMapId` を null に戻してアンマウントする。
   */
  const [pendingMapId, setPendingMapId] = useState(null);

  useEffect(() => {
    if (useMapStore.getState().mapDef === null) {
      initializeMap(DEFAULT_MAP_ID, mapsData.maps[DEFAULT_MAP_ID]);
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

  const mapList = useMemo(
    () =>
      Object.keys(mapsData.maps).map((id) => ({
        id,
        label: MAP_LABELS[id] ?? id,
      })),
    [],
  );

  const handleSelectMap = (mapId) => {
    setIsMapSelectOpen(false);
    if (mapId === currentMapId) {
      return;
    }
    /*
     * 黒フェードを起動するだけにとどめ、実際の `switchMap` はフェードイン
     * 完了時の `handleSwitchTransitionMidpoint` で行う。多重発火を防ぐため
     * 既にフェード中（`pendingMapId !== null`）なら無視する。
     */
    if (pendingMapId !== null) {
      return;
    }
    setPendingMapId(mapId);
  };

  const handleSwitchTransitionMidpoint = useCallback(() => {
    setPendingMapId((mapId) => {
      if (mapId !== null) {
        switchMap(mapId, mapsData.maps[mapId]);
      }
      return mapId;
    });
  }, [switchMap]);

  const handleSwitchTransitionEnd = useCallback(() => {
    setPendingMapId(null);
  }, []);

  const { viewBox } = renderMap;

  return (
    <section className={styles.root}>
      <div className={styles.canvas}>
        <svg
          className={styles.svg}
          viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
          preserveAspectRatio="xMidYMid meet"
        >
          <MapBackground mapDef={renderMap} />
          <MapPaths mapDef={renderMap} />
          {isEditing && editorDraft ? (
            <MapEditorLayer draft={editorDraft} />
          ) : (
            <>
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
              <MapOverlay viewBox={viewBox} />
            </>
          )}
          {/* DEBUG: 座標調整用の格子オーバーレイ。必要なときに有効化する。*/}
          {/* <CoordinateGrid viewBox={viewBox} /> */}
        </svg>
        <FullscreenToggleButton />
        {!isEditing && (
          <>
            <BattleDemoButton
              demoStageIds={demoStageIds}
              onSelectStage={onStartBattleDemo}
            />
            <MapTravelButton onClick={() => setIsMapSelectOpen(true)} />
          </>
        )}
        <MapEditorToggleButton mapId={currentMapId} mapDef={mapDef} />
        {isEditing && <MapEditorPanel onClose={stopEditing} />}
        {isMapSelectOpen && (
          <MapSelectOverlay
            maps={mapList}
            currentMapId={currentMapId}
            onSelect={handleSelectMap}
            onClose={() => setIsMapSelectOpen(false)}
          />
        )}
      </div>
      {pendingMapId !== null && (
        <MapSwitchTransition
          onMidpoint={handleSwitchTransitionMidpoint}
          onEnd={handleSwitchTransitionEnd}
        />
      )}
    </section>
  );
}

export default MapScreen;
