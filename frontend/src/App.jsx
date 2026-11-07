import { useCallback, useEffect, useRef, useState } from 'react';
import TitleScreen from './features/title/TitleScreen.jsx';
import StoryScreen from './features/story/StoryScreen.jsx';
import WakeUpOverlay from './features/story/WakeUpOverlay.jsx';
import IslandVoyageOverlay from './features/cutscene/IslandVoyageOverlay.jsx';
import ScreenFadeTransition from './components/ScreenFadeTransition.jsx';
import CharacterGallery from './editer/CharacterGallery.jsx';
import MapScreen from './features/map/MapScreen.jsx';
import BattleScreen from './features/battle/BattleScreen.jsx';
import BattleTransition from './features/battle/BattleTransition.jsx';
import MapReturnTransition from './features/battle/MapReturnTransition.jsx';
import CutsceneFlowScreen from './features/cutsceneflow/CutsceneFlowScreen.jsx';
import CreditsScreen from './features/ending/CreditsScreen.jsx';
import EpilogueScreen from './features/ending/EpilogueScreen.jsx';
import CreditsEditorScreen from './features/ending/editor/CreditsEditorScreen.jsx';
import useProgressStore from './stores/progressStore.js';
import useCutsceneStore from './stores/cutsceneStore.js';
import useMapStore from './stores/mapStore.js';
import useBattleStore from './stores/battleStore.js';
import usePlayerStore from './stores/playerStore.js';
import stagesData from './data/stagesLoader.js';
import mapsData from './data/maps.json';
import useDebugCommands from './hooks/useDebugCommands.js';
import { TRAVEL_BUTTON_DEBUT_MS } from './features/map/MapTravelButton.jsx';
import ENDING_SLIDES from './data/ending_slides.json';
import { forgetPlayer, markCleared } from './services/clearRecordApi.js';

/*
 * このステージをクリア（勝利演出経由で退出）したら、マップではなく
 * エンディング紙芝居（`screen === 'ending'`）へ遷移する。ラスボスの 4-4。
 */
const ENDING_STAGE_ID = '4-4';

/*
 * ステージ5のマップ ID。全体マップ（`map_0`）に領域を持たない独立マップで、
 * エピローグ後にタイトルの入口ボタンからだけ入る。
 */
const WORLD5_MAP_ID = 'map_5';
/* ステージ5の入口ステージ。入場の会話（`enterMapArea`）の判定に使う。 */
const WORLD5_ENTRY_STAGE_ID = '5-1';

/*
 * 本編の最初のマップ ID（`MapScreen` の初期マップと同じ）。続きの位置が
 * 無いままステージ5からタイトルへ戻ってスタートしたときの戻り先。
 */
const MAIN_START_MAP_ID = 'map_1';

/**
 * アプリケーションのルートコンポーネント。
 *
 * `screen` 状態（`'title' | 'story' | 'map' | 'battle' | 'cutsceneflow' | 'ending' | 'credits' | 'epilogue' | 'creditseditor' | 'gallery'`）と `stageId` 状態（次に戦うステージ ID）
 * を `useState` で管理し、画面切替の起点として機能する。起動直後はタイトル
 * 画面（`TitleScreen`）を表示し、中央の「スタート」ボタン（`handleStartGame`）
 * でオープニング紙芝居（`StoryScreen`）へ遷移する。紙芝居はカットシーンと
 * 同様に視聴履歴を持ち（`progressStore.hasSeenOpeningStory`、localStorage
 * 永続）、視聴済みなら紙芝居・目覚め演出を飛ばしてマップへ直行する
 * （隠しコマンド `wqreset` の全リセットで履歴も消え、再び最初から見られる）。紙芝居を最後まで見終える
 * （`handleStoryFinish`）と、ステージ1の入り口にあたるマップ画面
 * （`MapScreen`＝`map_1`）へ遷移する。このときマップの上に「目覚め」演出
 * （`WakeUpOverlay`）を重ね、2 秒の暗転ののち、気絶から目を覚ますように
 * ゆっくりと平原を現す（完了で `handleWakeUpEnd` がオーバーレイを外す）。
 * 併せて目覚めの会話カットシーン（`opening-wake`）を発火し、フロチャロボ
 * との初対面 → 名前入力 → ステージ1への誘導ガイドへと続ける。
 * マップ画面では、ランドマーク詳細パネルの「たたかう」ボタンが押されると、
 * 対応する `stageId` を保持しつつ戦闘画面（`BattleScreen`）に遷移する。
 * テスト用途のため、戦闘画面右上の「マップへ戻る」ボタンで戦闘進行や勝敗に
 * 関係なく即座にマップ画面へ戻れる（戦闘ステートはマウント解除でリセット
 * される）。
 *
 * マップ → 戦闘の遷移は `BattleTransition` の黒フェードオーバーレイを挟み、
 * フェードイン中にバトル画面で使う画像（敵スプライト・カード・フローチャート
 * アイコン）を並列で事前読み込みする。フェードイン完了とプリロード完了の
 * 両方が揃ったタイミング（`handleTransitionMidpoint`）で `BattleScreen` に
 * 切り替え、その後フェードアウトでバトル画面を露出させる。
 *
 * 戦闘 → マップの帰り道は 2 経路ある：
 *   - 右上テスト用 `BackToMapButton`・敗北時 `BattleFailOverlay` →
 *     `handleBattleExitToMap`：画面遷移のみ。クリア記録は変更しない
 *     （要件 3-3）。
 *   - 勝利演出 `VictoryClearOverlay` の「マップへ戻る」 → `handleClearedExitToMap`：
 *     `progressStore.markStageCleared(stageId)` でクリア記録を更新してから
 *     マップ画面へ遷移する（要件 3-1）。`markStageCleared` 内で次ステージの
 *     解放判定と `pendingUnlockStageId` のセットも行われ、`MapScreen` の
 *     マウント時 useEffect が拾って解放アニメを起動する。ラスボス
 *     （`ENDING_STAGE_ID` = 4-4）のクリア時だけは、マップではなく
 *     エンディング紙芝居（`screen === 'ending'`、`StoryScreen` に
 *     `data/ending_slides.json` を渡して再生）へ遷移し、見終えたら
 *     `handleEndingFinish` でマップへ戻る。
 * どちらの経路も即座に画面を切り替えるのではなく、`MapReturnTransition` の
 * 黒フェード（暗転 → 画面切替 → 明転）を挟んで自然に戻す。実際の退出処理
 * （クリア記録・`setScreen`）は `returnToMapActionRef` に退避しておき、
 * 暗転完了時の `handleReturnMidpoint` が実行する。
 *
 * 将来「ステージ選択画面」「タイトル画面」「戦闘終了→マップ復帰」など
 * 本格的な画面遷移ロジックを追加する際は、ここの `useState` を Zustand
 * ストアやルーターに置き換える形で拡張する。
 *
 * Returns:
 *     JSX.Element: 現在の画面に応じたコンポーネント。
 */
function App() {
  const [screen, setScreen] = useState('title');
  const [stageId, setStageId] = useState(stagesData.demoStageIds[0]);
  const [pendingStageId, setPendingStageId] = useState(null);
  /*
   * バトル → マップの黒フェード帰還演出（`MapReturnTransition`）を表示中か。
   * 実際の退出処理（クリア記録・`setScreen`）は `returnToMapActionRef` に
   * 退避し、暗転完了時（`handleReturnMidpoint`）に実行する。ref の
   * 非 null は「演出予約済み」を意味し、二重予約のガードにも使う。
   */
  const [isReturningToMap, setIsReturningToMap] = useState(false);
  const returnToMapActionRef = useRef(null);
  /* 紙芝居 → マップ到着時の「目覚め」演出（`WakeUpOverlay`）を出すか。 */
  const [isWakingUp, setIsWakingUp] = useState(false);
  /*
   * ステージ5に初めて入るときの「島へ渡る」移動シーン
   * （`IslandVoyageOverlay`）を出しているか。
   */
  const [isVoyaging, setIsVoyaging] = useState(false);
  /*
   * タイトル ⇄ マップの切り替えに挟む黒フェード（`ScreenFadeTransition`）を
   * 出しているか。暗転しきったときに実行する画面切替の処理は
   * `screenFadeActionRef` に退避しておく（`returnToMapActionRef` と同じ方式）。
   */
  const [isScreenFading, setIsScreenFading] = useState(false);
  const screenFadeActionRef = useRef(null);

  /*
   * クリア退出時の `exitStage` カットシーンは、次ステージの開放アニメーション
   * （またはワールド解放シネマ）が終わってから出したい。演出が走る場合は
   * ここに対象ステージ ID を退避し、完了（`isUnlockAnimating` /
   * `pendingWorldUnlock` の true→終了）を検知して発火する。
   */
  const pendingExitStageIdRef = useRef(null);
  /*
   * クリア後にマップへ戻った直後のカットシーン（`returnToMap`、例: 1-4
   * クリア後にドラゴンの影がマップを横切る `map-stage1-shadow`）の制御。
   *   - `pendingReturnCutsceneStageIdRef`: 帰還演出の明転完了
   *     （`handleReturnEnd`）で発火するステージ ID。暗転中（`handleReturn
   *     Midpoint`）に退避し、明転後に `fireTrigger` する。
   *   - `isWorldUnlockHeld` / `heldWorldUnlockCutsceneIdRef`: そのカット
   *     シーンが終わるまで次ワールド解放シネマ（`WorldUnlockCutscene`）を
   *     待たせるフラグと、待たせる原因になっているカットシーン ID。
   *     `MapScreen` はフラグが立っている間シネマをマウントしない。カット
   *     シーンの終了（`activeId` がその ID → null）をストア購読で検知して
   *     解除すると、シネマ（暗転 → 全体マップ → 開放アニメ → 復帰）が走り、
   *     その後に `exitStage`（「このマップを押して追いかけよう」）が続く。
   *     購読は zustand の `subscribe` で行い、effect 本体で同期的に setState
   *     しない（`react-hooks/set-state-in-effect` を避ける）。
   */
  const pendingReturnCutsceneStageIdRef = useRef(null);
  const heldWorldUnlockCutsceneIdRef = useRef(null);
  const [isWorldUnlockHeld, setIsWorldUnlockHeld] = useState(false);
  useEffect(
    () =>
      useCutsceneStore.subscribe((state, prev) => {
        if (
          prev.activeId !== null &&
          state.activeId === null &&
          heldWorldUnlockCutsceneIdRef.current === prev.activeId
        ) {
          heldWorldUnlockCutsceneIdRef.current = null;
          setIsWorldUnlockHeld(false);
        }
      }),
    [],
  );
  /*
   * 開発用カットシーン・フロー画面（隠しコマンド `wqflow`）を開く直前の画面を
   * 控えておき、「戻る」で元の画面へ復帰できるようにする。バトル中に開いた
   * 場合は戻るとバトルが再マウントされてトリガーが再発火するため、`map` に
   * 丸めて退避する。
   */
  const prevScreenRef = useRef('map');
  /*
   * ラスボス（4-4）をクリア済みか。エンディングを一度迎えたプレイヤーの
   * 目印で、タイトル画面の「エンディングゲームで あそぶ」ボタンの表示
   * 条件に使う（フラグを二重管理せず `clearedStageIds` から導出する）。
   */
  const isEndingUnlocked = useProgressStore((s) =>
    s.clearedStageIds.includes(ENDING_STAGE_ID),
  );
  /*
   * おまけミニゲーム「陣取り合戦」の入口をタイトルに出すか。ラスボス（4-4）を
   * クリアし、かつエンディングロール（コイン集め）も最後まで遊び切った
   * プレイヤーにだけ、スタートの下に「じんとりがっせん で あそぶ」ボタンを
   * 出す。両条件そろって初めて解放される、本編＋エンディングのさらにおまけ。
   */
  const hasFinishedEndingGame = useProgressStore((s) => s.hasFinishedEndingGame);
  const canPlayLaneBattle = isEndingUnlocked && hasFinishedEndingGame;
  /*
   * スタートボタンのラベルを「つづきから」に切り替える目印．App が「再開するか
   * 最初からか」を判定している当のフラグ（オープニング視聴済み＝再開する）を
   * そのまま使い，進行フラグを二重に作らない．resetProgress で false に戻り，
   * 表示も「スタート」に戻る（スタッフがリセット要否をラベルで判別できる）．
   */
  const hasSeenOpeningStory = useProgressStore((s) => s.hasSeenOpeningStory);
  /*
   * ステージ5（`map_5`）の入口をタイトルに出すか。陣取り合戦と同じく、
   * ラスボス（4-4）をクリアし、エンディングロール（コイン集め）も最後まで
   * 遊び切ったプレイヤーにだけ出す。本編の流れ（エピローグ経由）でも、
   * タイトルからの再プレイでも、遊び切った時点で解放される。ステージ5は
   * 全体マップに領域を持たない独立マップで、入口はこのボタンだけ。
   */
  const canPlayWorld5 = isEndingUnlocked && hasFinishedEndingGame;
  const isUnlockAnimating = useProgressStore((s) => s.isUnlockAnimating);
  const wasUnlockAnimatingRef = useRef(false);
  useEffect(() => {
    if (
      wasUnlockAnimatingRef.current &&
      !isUnlockAnimating &&
      pendingExitStageIdRef.current !== null
    ) {
      useCutsceneStore
        .getState()
        .fireTrigger({ type: 'exitStage', stageId: pendingExitStageIdRef.current });
      pendingExitStageIdRef.current = null;
    }
    wasUnlockAnimatingRef.current = isUnlockAnimating;
  }, [isUnlockAnimating]);

  /*
   * ワールド最終ステージ（1-4 / 2-4 / 3-4）クリア時は、次ワールド解放シネマ
   * （`WorldUnlockCutscene`）が終わってから `exitStage` カットシーンを出す。
   * シネマ完了（`pendingWorldUnlock` が非 null → null）を検知して発火する
   * （例: 1-4 クリア後の「このマップを押して次のステージに進もう！」誘導。
   * 1-4 以外のワールド最終ステージには `exitStage` の定義が無いため no-op に
   * なる）。シネマ明けはマップ移動ボタンの初登場アニメ（`MapTravelButton` の
   * `.debut`）が走るため、その長さ分（`TRAVEL_BUTTON_DEBUT_MS`）だけ待って
   * から発火し、「ボタンがポンと現れる → ロボがそれを指差して誘導する」の
   * 順につなげる。
   */
  const pendingWorldUnlock = useProgressStore((s) => s.pendingWorldUnlock);
  const wasWorldUnlockingRef = useRef(false);
  useEffect(() => {
    if (
      wasWorldUnlockingRef.current &&
      pendingWorldUnlock === null &&
      pendingExitStageIdRef.current !== null
    ) {
      const exitStageId = pendingExitStageIdRef.current;
      pendingExitStageIdRef.current = null;
      setTimeout(() => {
        useCutsceneStore
          .getState()
          .fireTrigger({ type: 'exitStage', stageId: exitStageId });
      }, TRAVEL_BUTTON_DEBUT_MS);
    }
    wasWorldUnlockingRef.current = pendingWorldUnlock !== null;
  }, [pendingWorldUnlock]);

  /*
   * 開発用の隠しコマンド（`useDebugCommands`）。以前の R / T / C / Space の
   * 単キーショートカットは、プレイヤーが偶然押して発動する事故があり得たため、
   * `wq` で始まる文字列をタイプしたときだけ効くコマンドに置き換えた。
   * どの画面でも効き、会話中・紙芝居中でも打てる（capture フェーズで
   * 遮断より先に観測するため）。
   *   - wqreset : ゲームの状態をすべて初期化して、タイトル画面
   *               （`TitleScreen`）へ戻る。対象はガイドの表示履歴
   *               （`seenIds`）と再生中のカットシーン・ステージの開放状況
   *               （`progressStore`）・マップの現在位置（`mapStore`）・
   *               プレイヤー名（`playerStore`）。紙芝居の視聴履歴も消える
   *               ため、タイトルの「スタート」から紙芝居 → 目覚め → ロボとの
   *               会話（名前入力）→ チュートリアルの流れを完全な初期状態から
   *               通しで見直せる。
   *   - wqtitle : タイトル画面（`TitleScreen`）へ戻る。
   *   - wqflow  : カットシーン・フロー画面（`CutsceneFlowScreen`、開発用）を
   *               開閉する。開く直前の画面を `prevScreenRef` に退避し、
   *               画面内の「戻る」で復帰する。
   *   - wqend   : エンディング紙芝居（`screen === 'ending'`）をその場で再生
   *               する。4-4 を倒さずに最後の演出を確認する用途。あわせて
   *               進捗を「4-4 クリア済み」まで一括設定し（`wqgo4-4` ＋
   *               4-4 クリアに相当）、エンディング後の世界を本番と同じに
   *               そろえる。紙芝居を見終えるとエンディングロール
   *               （`CreditsScreen`）へ続き、リザルトからタイトルへ戻る。
   *   - wqgo<ステージID> : 例 `wqgo2-3`（ハイフン省略の `wqgo23` も可）。
   *               そのステージに「到達した」状態まで進捗を一括設定する
   *               （旧・到達ステージ選択ドロップダウンの置き換え）。
   *   - wqedit  : エンディング配置エディタ（`CreditsEditorScreen`、開発用）を
   *               開閉する。行の横位置とコインの配置を GUI で編集し、JSON を
   *               書き出して `data/ending_credits.json` を置き換える。
   *   - wqchara : キャラクター一覧（`CharacterGallery`、開発用）を開閉する。
   *               全キャラクターのスプライト（idle / attack / dead）を並べて
   *               確認する。開く前の画面へ戻る。
   *   - wqfull  : ブラウザの全画面表示（Fullscreen API）を切り替える。展示や
   *               プレイ時にアドレスバー等を隠して大画面で遊ぶための切替。
   *               Esc（ブラウザ標準）でも解除できる。
   *   - wqwin   : バトル画面にいるとき、そのバトルを即座に勝ちにする
   *               （`battleStore.debugInstantWin`）。実行前・実行中・失敗表示中の
   *               どこからでも効き、通常の勝利と同じ CLEAR! 演出と撃破後
   *               カットシーン（`defeatEnemy`）が流れる。「マップへ戻る」で
   *               クリア記録・帰還カットシーン（`returnToMap`）も本番どおり進む。
   *               4-4 は第一形態ならフェイクアウト〜復活へ、第二形態なら勝利へ。
   *   - wqstage5 : ステージ5（5-1）に初めて入る直前の状態にして、タイトル
   *               画面へ戻る。`wqgo5-1` の進捗（4-4 までクリア・5-1 以降の
   *               カットシーンは未視聴）に加えて、エンディングロールを遊び
   *               切った記録を立てて「つづきの ぼうけんへ」ボタンを出し、
   *               ステージ5の途中位置も消す。ボタンを押すと島へ渡る移動
   *               シーン → 入口からのステージ5を本番どおり確認できる。
   */
  const handleDebugReset = useCallback(() => {
    useCutsceneStore.getState().resetSeen();
    useProgressStore.getState().resetProgress();
    useMapStore.getState().reset();
    usePlayerStore.getState().resetName();
    forgetPlayer();
    /*
     * 巻き戻し後はタイトル画面へ戻る。視聴履歴も消えているので、タイトルの
     * 「スタート」からオープニング紙芝居を通しでやり直せる。目覚め演出の
     * 途中だった場合に備えてオーバーレイのフラグも下ろす。
     */
    setIsWakingUp(false);
    setScreen('title');
  }, []);

  const handleDebugTitle = useCallback(() => {
    setScreen('title');
  }, []);

  /*
   * 黒フェード（暗転 → 画面切替 → 明転）を挟んで画面を切り替える。
   * `action` は暗転しきった時点（`handleScreenFadeMidpoint`）で実行する。
   * フェード中に呼ばれた場合（ボタンの連打など）は無視する。
   *
   * 切替先のマップで会話がすぐ始まることがあるため、明転が終わるまでは
   * 会話送りの入力をロックし、黒画面の下でセリフが送られてしまうのを防ぐ。
   */
  const startScreenFade = useCallback((action) => {
    if (screenFadeActionRef.current) {
      return;
    }
    screenFadeActionRef.current = action;
    setIsScreenFading(true);
  }, []);

  const handleScreenFadeMidpoint = useCallback(() => {
    useCutsceneStore.getState().setInputLocked(true);
    screenFadeActionRef.current?.();
  }, []);

  const handleScreenFadeEnd = useCallback(() => {
    screenFadeActionRef.current = null;
    setIsScreenFading(false);
    useCutsceneStore.getState().setInputLocked(false);
  }, []);

  /*
   * マップ画面左上の「タイトルに もどる」ボタン。進行状況・マップ上の
   * 現在位置は各ストアが localStorage へ常時保存しているため、単純な
   * 画面切替だけでよい（タイトルの「スタート」で同じ場所から再開できる）。
   */
  const handleBackToTitle = useCallback(() => {
    startScreenFade(() => setScreen('title'));
  }, [startScreenFade]);

  const handleDebugCutsceneFlow = useCallback(() => {
    setScreen((prev) => {
      if (prev === 'cutsceneflow') {
        return prevScreenRef.current;
      }
      prevScreenRef.current = prev === 'battle' ? 'map' : prev;
      return 'cutsceneflow';
    });
  }, []);

  /*
   * `wqend` はエンディングの演出確認だけでなく、進捗も「4-4 をクリアした」
   * 状態まで一括で進める。エンディングは本来ラスボス撃破後にしか出ない
   * 画面なので、見た後の世界（タイトルの「エンディングゲームで あそぶ」
   * ボタンの表示や、マップへ戻ったときの解放状況）も本番と同じにそろえる
   * ため。カットシーンの視聴履歴も同様に既読へ倒す。
   */
  const handleDebugEnding = useCallback(() => {
    const progress = useProgressStore.getState();
    progress.setProgressUpToStage(ENDING_STAGE_ID);
    progress.markStageCleared(ENDING_STAGE_ID);
    useCutsceneStore.getState().markSeenBeforeStage(ENDING_STAGE_ID);
    setScreen('ending');
  }, []);

  /*
   * エンディング配置エディタの開閉トグル。`wqflow` と同じ方針で、開く直前の
   * 画面を `prevScreenRef` に退避し、「もどる」やコマンド再入力で復帰する
   * （バトル中に開いた場合は再マウント事故を避けて `map` に丸める）。
   */
  const handleDebugCreditsEditor = useCallback(() => {
    setScreen((prev) => {
      if (prev === 'creditseditor') {
        return prevScreenRef.current;
      }
      prevScreenRef.current = prev === 'battle' ? 'map' : prev;
      return 'creditseditor';
    });
  }, []);

  const handleExitCreditsEditor = useCallback(() => {
    setScreen(prevScreenRef.current);
  }, []);

  /* `wqchara`：キャラクター一覧の開閉（`wqedit` と同じく開く前の画面へ戻す）。 */
  const handleDebugGallery = useCallback(() => {
    setScreen((prev) => {
      if (prev === 'gallery') {
        return prevScreenRef.current;
      }
      prevScreenRef.current = prev === 'battle' ? 'map' : prev;
      return 'gallery';
    });
  }, []);

  const handleExitGallery = useCallback(() => {
    setScreen(prevScreenRef.current);
  }, []);

  /*
   * 全画面表示のトグル。非全画面なら文書全体（`documentElement`）を
   * 全画面化し、全画面中なら解除する。keydown はユーザー操作扱いなので
   * Fullscreen API のジェスチャ要件を満たす。iOS Safari など未対応環境や
   * ユーザー拒否では Promise が reject されるため、握りつぶして無視する。
   */
  const handleDebugFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      return;
    }
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  const handleDebugInstantWin = useCallback(() => {
    /* バトル画面以外（マップ・タイトル等）では何もしない。 */
    if (screen !== 'battle') {
      return;
    }
    useBattleStore.getState().debugInstantWin(stagesData.stages[stageId]);
  }, [screen, stageId]);

  const handleDebugUnlock = useCallback((unlockStageId) => {
    /* 実在しないステージ ID（例: wqgo9-9）は何もしない。 */
    if (!stagesData.stages[unlockStageId]) {
      return;
    }
    useProgressStore.getState().setProgressUpToStage(unlockStageId);
    useCutsceneStore.getState().markSeenBeforeStage(unlockStageId);
  }, []);

  const handleDebugStage5Entry = useCallback(() => {
    const progress = useProgressStore.getState();
    progress.setProgressUpToStage(WORLD5_ENTRY_STAGE_ID);
    progress.markOpeningStorySeen();
    progress.markEndingGameFinished();
    progress.clearStandalonePosition();
    useCutsceneStore.getState().markSeenBeforeStage(WORLD5_ENTRY_STAGE_ID);
    setIsWakingUp(false);
    setIsVoyaging(false);
    setScreen('title');
  }, []);

  useDebugCommands({
    onReset: handleDebugReset,
    onTitle: handleDebugTitle,
    onCutsceneFlow: handleDebugCutsceneFlow,
    onEnding: handleDebugEnding,
    onCreditsEditor: handleDebugCreditsEditor,
    onGallery: handleDebugGallery,
    onFullscreen: handleDebugFullscreen,
    onInstantWin: handleDebugInstantWin,
    onUnlock: handleDebugUnlock,
    onStage5Entry: handleDebugStage5Entry,
  });

  const handleStartBattle = (id) => {
    if (pendingStageId !== null) {
      return;
    }
    setPendingStageId(id);
  };

  const handleTransitionMidpoint = useCallback(() => {
    setStageId((current) => pendingStageId ?? current);
    setScreen('battle');
  }, [pendingStageId]);

  const handleTransitionEnd = useCallback(() => {
    setPendingStageId(null);
  }, []);

  /*
   * バトル → マップの帰還演出。押下時は退出処理を `returnToMapActionRef` に
   * 退避して黒フェード（`MapReturnTransition`）を開始するだけにし、実際の
   * 画面切替は暗転が完了した `handleReturnMidpoint` で行う。演出中の再押下は
   * ref が埋まっているあいだ無視する（オーバーレイ自体もクリックを遮る）。
   */
  const handleBattleExitToMap = useCallback(() => {
    if (returnToMapActionRef.current) return;
    returnToMapActionRef.current = () => setScreen('map');
    setIsReturningToMap(true);
  }, []);

  const handleReturnMidpoint = useCallback(() => {
    returnToMapActionRef.current?.();
    returnToMapActionRef.current = null;
  }, []);

  const handleReturnEnd = useCallback(() => {
    setIsReturningToMap(false);
    /*
     * マップが明転しきった時点で、帰還直後のカットシーン（`returnToMap`、
     * 例: 1-4 クリア後にドラゴンの影がマップを横切る）を発火する。暗転中に
     * 発火すると、影の演出が黒幕の下で見えないまま進んでしまうため、ここで
     * 出す。何らかの理由で再生が始まらなかった（別の会話が再生中など）
     * 場合は、解放シネマを待たせたまま詰まらないよう待ちを即解除する。
     */
    const returnStageId = pendingReturnCutsceneStageIdRef.current;
    if (returnStageId !== null) {
      pendingReturnCutsceneStageIdRef.current = null;
      const cutscene = useCutsceneStore.getState();
      cutscene.fireTrigger({ type: 'returnToMap', stageId: returnStageId });
      if (
        useCutsceneStore.getState().activeId !== heldWorldUnlockCutsceneIdRef.current
      ) {
        heldWorldUnlockCutsceneIdRef.current = null;
        setIsWorldUnlockHeld(false);
      }
    }
  }, []);

  const enterGameFromTitle = useCallback(() => {
    /*
     * オープニング紙芝居はカットシーンと同様に視聴履歴を持つ
     * （`progressStore.hasSeenOpeningStory`、localStorage 永続）。視聴済み
     * なら紙芝居・目覚め演出を飛ばしてマップへ直行する。目覚めの会話
     * （`opening-wake`）が未視聴の場合（紙芝居直後に中断した等）は、
     * `fireTrigger` がそのままマップ上で会話を開始する（視聴済みなら
     * no-op）。
     */
    if (useProgressStore.getState().hasSeenOpeningStory) {
      /*
       * 「続きから」の位置復元。前回終了時のマップ位置（`progressStore.
       * lastPosition`、localStorage 永続）があれば、MapScreen マウント前に
       * `switchMap` でそのマップ・地点へ勇者を配置しておく。ここで mapDef を
       * セットしておくと MapScreen の初期化 effect（最初のマップの入口で
       * `initializeMap`）はスキップされる。保存されていた地点 ID がマップ
       * 定義に存在しない場合（マップ改訂後など）は、そのマップの入口
       * （`startId`）へフォールバックする。
       */
      /*
       * ステージ5（`map_5`）の位置は本編の「続きから」に使わない。
       * 独立マップの位置は別枠（`lastStandalonePosition`）に保存するが、
       * それ以前のセーブデータでは `lastPosition` に `map_5` が残っている
       * ことがあるため、ここでも除外する。
       */
      const savedLast = useProgressStore.getState().lastPosition;
      const last = savedLast?.mapId === WORLD5_MAP_ID ? null : savedLast;
      const lastDef = last ? mapsData.maps[last.mapId] : null;
      /*
       * 同じセッションでステージ5から「タイトルに もどる」で戻った場合、
       * マップの状態（`mapStore`）はまだ `map_5` のまま。続きの位置が無い
       * ときは本編最初のマップの入口へ戻し、ステージ5に入らないようにする。
       */
      if (!lastDef && useMapStore.getState().currentMapId === WORLD5_MAP_ID) {
        useMapStore
          .getState()
          .switchMap(MAIN_START_MAP_ID, mapsData.maps[MAIN_START_MAP_ID]);
      }
      if (lastDef) {
        const isKnownNode = [
          ...(lastDef.landmarks ?? []),
          ...(lastDef.junctions ?? []),
        ].some((node) => node.id === last.locationId);
        useMapStore
          .getState()
          .switchMap(last.mapId, lastDef, isKnownNode ? last.locationId : undefined);
      }
      setScreen('map');
      useCutsceneStore.getState().fireTrigger({ type: 'wakeUp' });
      return;
    }
    setScreen('story');
  }, []);

  /* タイトル画面の「スタート」。黒フェードを挟んでマップ（または紙芝居）へ進む。 */
  const handleStartGame = useCallback(() => {
    startScreenFade(enterGameFromTitle);
  }, [startScreenFade, enterGameFromTitle]);

  const handleStoryFinish = useCallback(() => {
    useProgressStore.getState().markOpeningStorySeen();
    setIsWakingUp(true);
    setScreen('map');
    /*
     * 目覚めの会話（`opening-wake`、フロチャロボとの初対面）を発火する。
     * ここで先に再生を始めておくと、MapScreen マウント時の `enterMapArea`
     * ガイドは「再生中」で no-op になり、順番が入れ替わらない。ステージ1への
     * 誘導ガイドは `opening-wake` の `nextTrigger` が会話終了後に連鎖発火する。
     * 会話は `WakeUpOverlay` の暗転の下で始まり、目が開くと同時に見える。
     * 演出が終わるまでは会話送りの入力をロックし、黒画面の下で Enter に
     * よってセリフが見えないまま進んでしまうのを防ぐ（`isInputLocked`）。
     */
    const cutscene = useCutsceneStore.getState();
    cutscene.setInputLocked(true);
    cutscene.fireTrigger({ type: 'wakeUp' });
  }, []);

  const handleWakeUpEnd = useCallback(() => {
    setIsWakingUp(false);
    /* 目覚め演出が終わったので、ロボの会話を送れるように入力ロックを解く */
    useCutsceneStore.getState().setInputLocked(false);
  }, []);

  /*
   * エンディングロールをどの入口から開いたか。
   *   - 'story'  : 本編の流れ（紙芝居のあと）。リザルトは「つぎへ すすむ」
   *                1 つで、ビットのエピローグ会話へ続く
   *   - 'replay' : タイトルの「エンディングゲームで あそぶ」からの再プレイ。
   *                リザルトは「もういちど あそぶ」「タイトルに もどる」の
   *                2 つで、エピローグは流さない（次回作予告は本編の締めで
   *                一度見せれば十分なため）
   */
  const [creditsMode, setCreditsMode] = useState('story');
  /* 再プレイ「もういちど あそぶ」用の再マウントキー。 */
  const [creditsRunId, setCreditsRunId] = useState(0);

  /*
   * エンディング紙芝居を見終えたら、続けてエンディングロール
   * （`CreditsScreen`、クレジットの上を歩く足場ゲーム付き）へ進む。
   * `StoryScreen` 自身が黒へフェードアウトしてから `onFinish` を呼ぶので、
   * 追加の遷移演出は挟まない。
   */
  const handleEndingFinish = useCallback(() => {
    setCreditsMode('story');
    setScreen('credits');
  }, []);

  /*
   * エンディングロールのリザルトパネル「つぎへ すすむ」（本編モード）。
   * ビットが次回作を匂わせるエピローグ会話（`EpilogueScreen`）へ進める。
   */
  const handleCreditsFinish = useCallback(() => {
    /* エンディングロールを遊び切った目印（タイトルの陣取り合戦ボタン解放用）。 */
    useProgressStore.getState().markEndingGameFinished();
    setScreen('epilogue');
  }, []);

  /*
   * エピローグの「つづく…」を見終えたらタイトルへ戻る。本編を最後まで
   * 見終えたこの時点を「クリア」として、集計スクリーン用にサーバーへ送る
   * （結果は待たない）。
   */
  const handleEpilogueFinish = useCallback(() => {
    markCleared();
    setScreen('title');
  }, []);

  /*
   * ステージ5のマップ（`map_5`）へ切り替える。前回ステージ5の途中で終えて
   * いれば（`progressStore.lastStandalonePosition`）、その地点から再開し、
   * そうでなければ入口（`startId`）に立たせる。MapScreen マウント前に
   * `switchMap` しておくと、MapScreen の初期化 effect（最初のマップの入口）
   * はスキップされる（`handleStartGame` の「続きから」と同じ仕組み）。
   */
  const enterWorld5Map = useCallback(() => {
    const world5Def = mapsData.maps[WORLD5_MAP_ID];
    const last = useProgressStore.getState().lastStandalonePosition;
    const isResumable =
      last?.mapId === WORLD5_MAP_ID &&
      [...(world5Def.landmarks ?? []), ...(world5Def.junctions ?? [])].some(
        (node) => node.id === last.locationId,
      );
    useMapStore
      .getState()
      .switchMap(
        WORLD5_MAP_ID,
        world5Def,
        isResumable ? last.locationId : undefined,
      );
    setScreen('map');
  }, []);

  /*
   * タイトル画面のステージ5入口ボタン。初めて入るとき（入場の会話
   * `map-stage5-enter` がまだ再生できる）は、マップをいきなり出さずに
   * 「島へ渡る」移動シーン（`IslandVoyageOverlay`）を挟む。2 回目以降は
   * 黒フェード（`ScreenFadeTransition`）を挟んでマップへ入る。
   */
  const handlePlayWorld5 = useCallback(() => {
    const isFirstVisit =
      useCutsceneStore
        .getState()
        .peekCutsceneId({ type: 'enterMapArea', stageId: WORLD5_ENTRY_STAGE_ID }) !==
      null;
    if (isFirstVisit) {
      setIsVoyaging(true);
      return;
    }
    startScreenFade(enterWorld5Map);
  }, [enterWorld5Map, startScreenFade]);

  /*
   * 移動シーンのナレーションが終わり画面が真っ黒になったところでマップへ切り替える。
   * マップのマウントで入場の会話が始まるが、明転が終わるまでは会話送りの
   * 入力をロックしておく（`WakeUpOverlay` と同じ扱い）。
   */
  const handleVoyageMidpoint = useCallback(() => {
    useCutsceneStore.getState().setInputLocked(true);
    enterWorld5Map();
  }, [enterWorld5Map]);

  const handleVoyageEnd = useCallback(() => {
    setIsVoyaging(false);
    useCutsceneStore.getState().setInputLocked(false);
  }, []);

  /*
   * タイトル画面の「エンディングゲームで あそぶ」。ラスボスクリア済みの
   * プレイヤー向けの再プレイ導線で、紙芝居は挟まずエンディングロール
   * （コイン集め）へ直行する。
   */
  const handlePlayEndingGame = useCallback(() => {
    setCreditsMode('replay');
    setScreen('credits');
  }, []);

  /* 再プレイのリザルト「もういちど あそぶ」。ロールを最初からやり直す。 */
  const handleCreditsReplay = useCallback(() => {
    setCreditsRunId((runId) => runId + 1);
  }, []);

  /* 再プレイのリザルト「タイトルに もどる」。エピローグは挟まない。 */
  const handleCreditsBackToTitle = useCallback(() => {
    /* 再プレイでも遊び切った目印を立てておく（初回を取りこぼさない保険）。 */
    useProgressStore.getState().markEndingGameFinished();
    setScreen('title');
  }, []);

  /*
   * タイトル画面の「じんとりがっせん で あそぶ」。おまけミニゲーム
   * （陣取り合戦）を開く。feature 側（`LaneBattleGate`）が `lanebattle:open`
   * を購読していて、受け取ると全画面オーバーレイでゲームを起動する。本編は
   * この feature の中身を import せず DOM イベントを投げるだけなので、隔離を
   * 保ったままタイトルから起動できる。閉じるとオーバーレイが外れてタイトルへ戻る。
   */
  const handlePlayLaneBattle = useCallback(() => {
    window.dispatchEvent(new Event('lanebattle:open'));
  }, []);

  const handleExitCutsceneFlow = useCallback(() => {
    setScreen(prevScreenRef.current);
  }, []);

  const handleClearedExitToMap = useCallback((clearedStageId) => {
    if (returnToMapActionRef.current) return;
    /*
     * クリア記録〜画面切替の一連の退出処理は、黒フェードの暗転が完了した
     * タイミング（`handleReturnMidpoint`）で実行する。マップ側の解放
     * アニメーションやカットシーンが、暗転中ではなく明転後のマップ上で
     * 始まるようにするため。
     */
    returnToMapActionRef.current = () => {
      useProgressStore.getState().markStageCleared(clearedStageId);
      /*
       * ラスボス（4-4）クリア時はマップへ戻らず、暗転したままエンディング
       * 紙芝居へ遷移する。4-4 には次ステージの解放・`exitStage` カット
       * シーンが無いため、以降の演出分岐は通らなくてよい。マップへは
       * 紙芝居を見終えた `handleEndingFinish` で戻る。
       */
      if (clearedStageId === ENDING_STAGE_ID) {
        setScreen('ending');
        return;
      }
      const progress = useProgressStore.getState();
      /*
       * 帰還直後のカットシーン（`returnToMap`）が再生できるなら、明転後の
       * 発火を予約し、次ワールド解放シネマをその終了まで待たせる。再生
       * できない（視聴済み・定義なし）なら待たせない。待ちフラグは毎回
       * 明示的に true/false で上書きし、途中リセット等で古い true が残って
       * シネマが永久に出なくなるのを防ぐ。
       */
      const returnCutsceneId = useCutsceneStore
        .getState()
        .peekCutsceneId({ type: 'returnToMap', stageId: clearedStageId });
      pendingReturnCutsceneStageIdRef.current = returnCutsceneId
        ? clearedStageId
        : null;
      heldWorldUnlockCutsceneIdRef.current = returnCutsceneId;
      setIsWorldUnlockHeld(returnCutsceneId !== null);
      /*
       * ワールド最終ステージ（1-4 / 2-4 / 3-4）クリアで次ワールド解放シネマ
       * （`WorldUnlockCutscene`）が走るときは、シネマ完了後に `exitStage` を
       * 出す（上の `pendingWorldUnlock` 監視 useEffect が発火する）。
       * それ以外で次ステージの開放アニメーションが走るなら、`exitStage` は
       * アニメ完了後に出す（`isUnlockAnimating` 監視の useEffect が発火する）。
       * どちらの演出も無ければここで即時発火する。
       */
      if (progress.pendingWorldUnlock !== null) {
        pendingExitStageIdRef.current = clearedStageId;
      } else if (progress.pendingUnlockStageId !== null) {
        pendingExitStageIdRef.current = clearedStageId;
      } else {
        useCutsceneStore
          .getState()
          .fireTrigger({ type: 'exitStage', stageId: clearedStageId });
      }
      setScreen('map');
    };
    setIsReturningToMap(true);
  }, []);

  let currentScreen;
  if (screen === 'title') {
    currentScreen = (
      <TitleScreen
        onStart={handleStartGame}
        hasStarted={hasSeenOpeningStory}
        onPlayEnding={handlePlayEndingGame}
        canPlayEnding={isEndingUnlocked}
        onPlayLaneBattle={handlePlayLaneBattle}
        canPlayLaneBattle={canPlayLaneBattle}
        onPlayWorld5={handlePlayWorld5}
        canPlayWorld5={canPlayWorld5}
      />
    );
  } else if (screen === 'story') {
    currentScreen = <StoryScreen onFinish={handleStoryFinish} />;
  } else if (screen === 'battle') {
    currentScreen = (
      <BattleScreen
        stageId={stageId}
        onExitToMap={handleBattleExitToMap}
        onClearedExitToMap={handleClearedExitToMap}
      />
    );
  } else if (screen === 'cutsceneflow') {
    currentScreen = <CutsceneFlowScreen onExit={handleExitCutsceneFlow} />;
  } else if (screen === 'ending') {
    currentScreen = (
      <StoryScreen slides={ENDING_SLIDES} onFinish={handleEndingFinish} />
    );
  } else if (screen === 'credits') {
    currentScreen =
      creditsMode === 'replay' ? (
        <CreditsScreen
          key={creditsRunId}
          onFinish={handleCreditsBackToTitle}
          onReplay={handleCreditsReplay}
        />
      ) : (
        <CreditsScreen onFinish={handleCreditsFinish} />
      );
  } else if (screen === 'epilogue') {
    currentScreen = <EpilogueScreen onFinish={handleEpilogueFinish} />;
  } else if (screen === 'creditseditor') {
    currentScreen = <CreditsEditorScreen onExit={handleExitCreditsEditor} />;
  } else if (screen === 'gallery') {
    currentScreen = <CharacterGallery onExit={handleExitGallery} />;
  } else {
    currentScreen = (
      <MapScreen
        onStartBattle={handleStartBattle}
        onBackToTitle={handleBackToTitle}
        isWorldUnlockHeld={isWorldUnlockHeld}
      />
    );
  }

  return (
    <>
      {currentScreen}
      {isWakingUp && screen === 'map' && <WakeUpOverlay onEnd={handleWakeUpEnd} />}
      {isVoyaging && (
        <IslandVoyageOverlay
          onMidpoint={handleVoyageMidpoint}
          onEnd={handleVoyageEnd}
        />
      )}
      {isScreenFading && (
        <ScreenFadeTransition
          onMidpoint={handleScreenFadeMidpoint}
          onEnd={handleScreenFadeEnd}
        />
      )}
      {pendingStageId !== null && (
        <BattleTransition
          targetStageId={pendingStageId}
          onMidpoint={handleTransitionMidpoint}
          onEnd={handleTransitionEnd}
        />
      )}
      {isReturningToMap && (
        <MapReturnTransition
          onMidpoint={handleReturnMidpoint}
          onEnd={handleReturnEnd}
        />
      )}
    </>
  );
}

export default App;
