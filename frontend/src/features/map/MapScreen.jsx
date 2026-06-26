import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './MapScreen.module.css';
import MapBackground from './MapBackground';
import MapPaths from './MapPaths';
import Landmark from './Landmark';
import PlayerSprite from './PlayerSprite';
import MapOverlay from './MapOverlay';
import BattleDemoButton from './BattleDemoButton';
import UnlockSelectButton from './UnlockSelectButton';
// DEBUG: 座標調整時に有効化する。再開時は下のコメントアウトと合わせて戻す。
// import CoordinateGrid from './CoordinateGrid';
import FullscreenToggleButton from './FullscreenToggleButton';
import MapTravelButton from './MapTravelButton';
import MapRegionScrolls from './MapRegionScrolls';
import MapSwitchTransition from './MapSwitchTransition';
import WorldUnlockCutscene from './WorldUnlockCutscene';
import MapEditorLayer from './MapEditorLayer';
import MapRegionEditorLayer from './MapRegionEditorLayer';
import MapEditorPanel from './MapEditorPanel';
import MapEditorToggleButton from './MapEditorToggleButton';
import EditorEntryButton from '../../editer/EditorEntryButton';
import GalleryEntryButton from '../../editer/GalleryEntryButton';
import RoboBubble from '../cutscene/RoboBubble';
import useMapStore from '../../stores/mapStore';
import useMapEditorStore from '../../stores/mapEditorStore';
import useProgressStore from '../../stores/progressStore';
import useCutsceneStore from '../../stores/cutsceneStore';
import mapsData from '../../data/maps.json';

const DEFAULT_MAP_ID = 'map_1';

/*
 * 全体マップ（オーバーワールド）の ID。右上「マップ移動」ボタンはこの
 * マップへ遷移し、各領域の巻物（`MapRegionScrolls`）から各バイオームマップ
 * へ移動する。
 */
const OVERWORLD_MAP_ID = 'map_0';

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
 * 解決する。マップ移動はすべて `travelToMap` を起点とし、`MapSwitchTransition`
 * （黒フェード）を挟んで `switchMap` を呼ぶ。右上の「マップ移動」ボタンは
 * 全体マップ（`OVERWORLD_MAP_ID`）へ遷移し、全体マップ上では各領域の中央に
 * 置いた巻物（`MapRegionScrolls`）クリックで各バイオームマップへ遷移する。
 * フェードイン完了時にマップを切り替えることで、画像の差し替えと勇者の
 * `startId` への再配置が黒幕の裏側で行われ、視覚的に唐突さが出ない。切替時は
 * 新マップの `startId` に勇者を再配置する（移動中状態と残セグメントもリセット）。
 * 全体マップは `startId` が null でランドマークも持たないため、勇者スプライトは
 * 表示されず、巻物だけが並ぶハブ画面になる。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onStartBattle (function): ランドマーク詳細パネルの「たたかう」
 *             ボタン押下時に `stageId` を渡して呼ぶ関数。
 *         onStartBattleDemo (function): デバッグ用「バトルデモ」ドロップダウン
 *             で選択されたステージ ID を渡して呼ぶ関数（`onStartBattle` と
 *             同じシグネチャ）。`BattleDemoButton` の `onSelectStage` props
 *             として転送される。
 *         onOpenEditor (function): 右下の「スプライトシートエディタ」ボタン
 *             押下時に呼ぶ関数（引数なし）。App 側でエディタ画面へ切り替える。
 *         onOpenGallery (function): 右下の「キャラクター一覧」ボタン押下時に
 *             呼ぶ関数（引数なし）。App 側でキャラクター一覧画面へ切り替える。
 *         demoStageIds (Array<string>): バトルデモドロップダウンに並べる
 *             ステージ ID 配列。`stagesLoader.js` 経由で `stages.json` の
 *             `demoStageIds` から流れてくる。
 *
 * Returns:
 *     JSX.Element: マップ画面全体を表す `<section>` 要素。
 */
function MapScreen({ onStartBattle, onStartBattleDemo, onOpenEditor, onOpenGallery, demoStageIds }) {
  const initializeMap = useMapStore((state) => state.initializeMap);
  const switchMap = useMapStore((state) => state.switchMap);
  const isMoving = useMapStore((state) => state.isMoving);
  const currentLocation = useMapStore((state) => state.currentLocation);
  const requestMove = useMapStore((state) => state.requestMove);
  const currentMapId =
    useMapStore((state) => state.currentMapId) ?? DEFAULT_MAP_ID;

  /*
   * ワールド最終ステージ（1-4 / 2-4 / 3-4）クリア後に立つ「次ワールド解放」
   * フラグ。非 null の間 `WorldUnlockCutscene`（暗転→全体マップ→開放アニメ→
   * 暗転→復帰）を再生する。完了で `finishWorldUnlockCutscene` が null に戻す。
   */
  const pendingWorldUnlock = useProgressStore(
    (state) => state.pendingWorldUnlock,
  );

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
   * テスト用ショートカット：Space キーは「到達ステージ選択」ドロップダウン
   * （`UnlockSelectButton`）の開閉を担う。どこまでステージ・カットシーンを
   * 解放するかを選べる。R キー（全リセット）と対になる「ここまで進める」キー。
   * 開閉とキーハンドリングは `UnlockSelectButton` 内に閉じている。
   */

  /*
   * ランドマーク到着時に自動ガイド（`arriveLandmark`）を発火する。移動完了
   * （`isMoving` が true→false）した時点の `currentLocation` が `stageId` を持つ
   * ランドマークなら、そのステージ ID でトリガーする。ランドマーク ID（例:
   * `well`）とステージ ID（例: `1-1`）は別物なので、`landmarks` から引き直す。
   */
  const wasMovingRef = useRef(false);
  useEffect(() => {
    if (wasMovingRef.current && !isMoving) {
      const landmark = mapDef?.landmarks?.find(
        (item) => item.id === currentLocation,
      );
      if (landmark?.stageId) {
        useCutsceneStore
          .getState()
          .fireTrigger({ type: 'arriveLandmark', stageId: landmark.stageId });
      }
    }
    wasMovingRef.current = isMoving;
  }, [isMoving, currentLocation, mapDef]);

  /*
   * バイオームマップ表示直後に自動ガイド（`enterMapArea`）を発火する。
   * そのマップの入口ステージ（番号 1 のステージ、例: `1-1`）を stageId に
   * 渡す。全体マップ（`OVERWORLD_MAP_ID`）と編集中は対象外。`once`＋`seenIds`
   * で一度見たら再表示されない。
   */
  useEffect(() => {
    if (isEditing || currentMapId === OVERWORLD_MAP_ID) {
      return;
    }
    const entry = mapDef?.landmarks?.find((item) =>
      /-1$/.test(item.stageId ?? ''),
    );
    if (entry?.stageId) {
      useCutsceneStore
        .getState()
        .fireTrigger({ type: 'enterMapArea', stageId: entry.stageId });
    }
  }, [currentMapId, isEditing, mapDef]);

  /*
   * 指定マップへの移動を要求する。黒フェードを起動するだけにとどめ、実際の
   * `switchMap` はフェードイン完了時の `handleSwitchTransitionMidpoint` で行う。
   * 同じマップへの移動と、フェード中（`pendingMapId !== null`）の多重発火は
   * 無視する。右上「マップ移動」ボタン（→ 全体マップ）と、全体マップ上の
   * 各領域の巻物（→ 各バイオームマップ）の双方から呼ぶ。
   */
  const travelToMap = (mapId) => {
    if (mapId === currentMapId || pendingMapId !== null) {
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

  const handleWorldUnlockEnd = useCallback(() => {
    useProgressStore.getState().finishWorldUnlockCutscene();
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
            <>
              <MapEditorLayer draft={editorDraft} />
              <MapRegionEditorLayer draft={editorDraft} />
            </>
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
              {currentMapId === OVERWORLD_MAP_ID && (
                <MapRegionScrolls mapDef={mapDef} onSelectRegion={travelToMap} />
              )}
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
            <UnlockSelectButton />
            {currentMapId !== OVERWORLD_MAP_ID && (
              <MapTravelButton onClick={() => travelToMap(OVERWORLD_MAP_ID)} />
            )}
            <GalleryEntryButton onClick={onOpenGallery} />
            <EditorEntryButton onClick={onOpenEditor} />
          </>
        )}
        <MapEditorToggleButton mapId={currentMapId} mapDef={mapDef} />
        {isEditing && <MapEditorPanel onClose={stopEditing} />}
      </div>
      {pendingMapId !== null && (
        <MapSwitchTransition
          onMidpoint={handleSwitchTransitionMidpoint}
          onEnd={handleSwitchTransitionEnd}
        />
      )}
      {pendingWorldUnlock !== null && (
        <WorldUnlockCutscene onEnd={handleWorldUnlockEnd} />
      )}
      <RoboBubble variant="map" />
    </section>
  );
}

export default MapScreen;
