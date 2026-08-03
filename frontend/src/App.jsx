import { useCallback, useEffect, useRef, useState } from 'react';
import TitleScreen from './features/title/TitleScreen.jsx';
import StoryScreen from './features/story/StoryScreen.jsx';
import WakeUpOverlay from './features/story/WakeUpOverlay.jsx';
import MapScreen from './features/map/MapScreen.jsx';
import BattleScreen from './features/battle/BattleScreen.jsx';
import BattleTransition from './features/battle/BattleTransition.jsx';
import MapReturnTransition from './features/battle/MapReturnTransition.jsx';
import CutsceneFlowScreen from './features/cutsceneflow/CutsceneFlowScreen.jsx';
import PlazaScreen from './features/plaza/PlazaScreen.jsx';
import CreditsScreen from './features/ending/CreditsScreen.jsx';
import CreditsEditorScreen from './features/ending/editor/CreditsEditorScreen.jsx';
import useProgressStore from './stores/progressStore.js';
import useCutsceneStore from './stores/cutsceneStore.js';
import useMapStore from './stores/mapStore.js';
import usePlayerStore from './stores/playerStore.js';
import stagesData from './data/stagesLoader.js';
import mapsData from './data/maps.json';
import useDebugCommands from './hooks/useDebugCommands.js';
import { TRAVEL_BUTTON_DEBUT_MS } from './features/map/MapTravelButton.jsx';
import ENDING_SLIDES from './data/ending_slides.json';

/*
 * このステージをクリア（勝利演出経由で退出）したら、マップではなく
 * エンディング紙芝居（`screen === 'ending'`）へ遷移する。ラスボスの 4-4。
 */
const ENDING_STAGE_ID = '4-4';

/**
 * アプリケーションのルートコンポーネント。
 *
 * `screen` 状態（`'title' | 'story' | 'map' | 'battle' | 'cutsceneflow' | 'plaza' | 'ending' | 'credits' | 'creditseditor'`）と `stageId` 状態（次に戦うステージ ID）
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
 * 暗転完了時の `handleReturnMidpoint` が実行する。ひろばからの
 * `handleExitToMap` は従来どおり即時切替。
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
   * 紙芝居（`StoryScreen`）の再マウント用キー。隠しコマンド `wqreset` の
   * 全リセットで増やし、すでに紙芝居表示中でも 1 枚目から確実にやり直す。
   */
  const [storyRunId, setStoryRunId] = useState(0);

  /*
   * クリア退出時の `exitStage` カットシーンは、次ステージの開放アニメーション
   * （またはワールド解放シネマ）が終わってから出したい。演出が走る場合は
   * ここに対象ステージ ID を退避し、完了（`isUnlockAnimating` /
   * `pendingWorldUnlock` の true→終了）を検知して発火する。
   */
  const pendingExitStageIdRef = useRef(null);
  /*
   * 開発用カットシーン・フロー画面（隠しコマンド `wqflow`）を開く直前の画面を
   * 控えておき、「戻る」で元の画面へ復帰できるようにする。バトル中に開いた
   * 場合は戻るとバトルが再マウントされてトリガーが再発火するため、`map` に
   * 丸めて退避する。
   */
  const prevScreenRef = useRef('map');
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
   *   - wqreset : ゲームの状態をすべて初期化して、オープニング紙芝居
   *               （`StoryScreen`）まで巻き戻す。対象はガイドの表示履歴
   *               （`seenIds`）と再生中のカットシーン・ステージの開放状況
   *               （`progressStore`）・マップの現在位置（`mapStore`）・
   *               プレイヤー名（`playerStore`）。紙芝居 → 目覚め → ロボとの
   *               会話（名前入力）→ チュートリアルの流れを完全な初期状態から
   *               通しで見直せる。
   *   - wqtitle : タイトル画面（`TitleScreen`）へ戻る。
   *   - wqflow  : カットシーン・フロー画面（`CutsceneFlowScreen`、開発用）を
   *               開閉する。開く直前の画面を `prevScreenRef` に退避し、
   *               画面内の「戻る」で復帰する。
   *   - wqend   : エンディング紙芝居（`screen === 'ending'`）をその場で再生
   *               する。4-4 を倒さずに最後の演出を確認する用途。進捗・クリア
   *               記録には一切触れない。紙芝居を見終えるとエンディングロール
   *               （`CreditsScreen`）へ続き、リザルトからタイトルかマップへ
   *               戻る。
   *   - wqgo<ステージID> : 例 `wqgo2-3`（ハイフン省略の `wqgo23` も可）。
   *               そのステージに「到達した」状態まで進捗を一括設定する
   *               （旧・到達ステージ選択ドロップダウンの置き換え）。
   *   - wqedit  : エンディング配置エディタ（`CreditsEditorScreen`、開発用）を
   *               開閉する。行の横位置とコインの配置を GUI で編集し、JSON を
   *               書き出して `data/ending_credits.json` を置き換える。
   */
  const handleDebugReset = useCallback(() => {
    useCutsceneStore.getState().resetSeen();
    useProgressStore.getState().resetProgress();
    useMapStore.getState().reset();
    usePlayerStore.getState().resetName();
    /*
     * 巻き戻し後はオープニング紙芝居から通しでやり直す。目覚め演出の
     * 途中だった場合に備えてオーバーレイのフラグも下ろし、紙芝居表示中
     * だった場合に備えて `storyRunId` で `StoryScreen` を再マウントする。
     */
    setIsWakingUp(false);
    setStoryRunId((runId) => runId + 1);
    setScreen('story');
  }, []);

  const handleDebugTitle = useCallback(() => {
    setScreen('title');
  }, []);

  const handleDebugCutsceneFlow = useCallback(() => {
    setScreen((prev) => {
      if (prev === 'cutsceneflow') {
        return prevScreenRef.current;
      }
      prevScreenRef.current = prev === 'battle' ? 'map' : prev;
      return 'cutsceneflow';
    });
  }, []);

  const handleDebugEnding = useCallback(() => {
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

  const handleDebugUnlock = useCallback((unlockStageId) => {
    /* 実在しないステージ ID（例: wqgo9-9）は何もしない。 */
    if (!stagesData.stages[unlockStageId]) {
      return;
    }
    useProgressStore.getState().setProgressUpToStage(unlockStageId);
    useCutsceneStore.getState().markSeenBeforeStage(unlockStageId);
  }, []);

  useDebugCommands({
    onReset: handleDebugReset,
    onTitle: handleDebugTitle,
    onCutsceneFlow: handleDebugCutsceneFlow,
    onEnding: handleDebugEnding,
    onCreditsEditor: handleDebugCreditsEditor,
    onUnlock: handleDebugUnlock,
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

  const handleExitToMap = useCallback(() => {
    setScreen('map');
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
  }, []);

  const handleStartGame = useCallback(() => {
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
      const last = useProgressStore.getState().lastPosition;
      const lastDef = last ? mapsData.maps[last.mapId] : null;
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
   * エンディング紙芝居を見終えたら、続けてエンディングロール
   * （`CreditsScreen`、クレジットの上を歩く足場ゲーム付き）へ進む。
   * `StoryScreen` 自身が黒へフェードアウトしてから `onFinish` を呼ぶので、
   * 追加の遷移演出は挟まない。マップやタイトルへはロールのリザルト
   * パネル（`handleCreditsExitToTitle` / `handleExitToMap`）から戻る。
   */
  const handleEndingFinish = useCallback(() => {
    setScreen('credits');
  }, []);

  /* エンディングロールのリザルトパネル「タイトルへ」。 */
  const handleCreditsExitToTitle = useCallback(() => {
    setScreen('title');
  }, []);

  const handleOpenPlaza = useCallback(() => {
    setScreen('plaza');
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
    currentScreen = <TitleScreen onStart={handleStartGame} />;
  } else if (screen === 'story') {
    currentScreen = <StoryScreen key={storyRunId} onFinish={handleStoryFinish} />;
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
  } else if (screen === 'plaza') {
    currentScreen = <PlazaScreen onExitToMap={handleExitToMap} />;
  } else if (screen === 'ending') {
    currentScreen = (
      <StoryScreen slides={ENDING_SLIDES} onFinish={handleEndingFinish} />
    );
  } else if (screen === 'credits') {
    currentScreen = (
      <CreditsScreen
        onExitToTitle={handleCreditsExitToTitle}
        onExitToMap={handleExitToMap}
      />
    );
  } else if (screen === 'creditseditor') {
    currentScreen = <CreditsEditorScreen onExit={handleExitCreditsEditor} />;
  } else {
    currentScreen = (
      <MapScreen
        onStartBattle={handleStartBattle}
        onOpenPlaza={handleOpenPlaza}
      />
    );
  }

  return (
    <>
      {currentScreen}
      {isWakingUp && screen === 'map' && <WakeUpOverlay onEnd={handleWakeUpEnd} />}
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
