import { useCallback, useEffect, useRef, useState } from 'react';
import MapScreen from './features/map/MapScreen.jsx';
import BattleScreen from './features/battle/BattleScreen.jsx';
import BattleTransition from './features/battle/BattleTransition.jsx';
import SpriteSheetEditor from './editer/SpriteSheetEditor.jsx';
import CharacterGallery from './editer/CharacterGallery.jsx';
import useProgressStore from './stores/progressStore.js';
import useCutsceneStore from './stores/cutsceneStore.js';
import stagesData from './data/stagesLoader.js';

/**
 * アプリケーションのルートコンポーネント。
 *
 * `screen` 状態（`'map' | 'battle' | 'editor' | 'gallery'`）と `stageId` 状態（次に戦うステージ ID）
 * を `useState` で管理し、画面切替の起点として機能する。起動直後はマップ
 * 画面（`MapScreen`）を表示し、ランドマーク詳細パネルの「たたかう」ボタン、
 * またはマップ右上のデバッグ用「バトルデモ」ボタンが押されると、対応する
 * `stageId` を保持しつつ戦闘画面（`BattleScreen`）に遷移する。テスト用途
 * のため、戦闘画面右上の「マップへ戻る」ボタンで戦闘進行や勝敗に関係なく
 * 即座にマップ画面へ戻れる（戦闘ステートはマウント解除でリセットされる）。
 * また、マップ画面右下の「スプライトシートエディタ」ボタン（`onOpenEditor`）
 * を押すと開発用のスプライトシート分割エディタ（`SpriteSheetEditor`）へ
 * 切り替わり、エディタの「マップへ戻る」（`handleExitToMap`）でマップへ戻る。
 * 同じくマップ右下のエディタボタン上に並ぶ「キャラクター一覧」ボタン
 * （`onOpenGallery`）からは、全キャラクターの idle を閲覧する `CharacterGallery`
 * へ切り替わり、こちらも「マップへ戻る」でマップへ戻る。
 *
 * マップ → 戦闘の遷移は `BattleTransition` の黒フェードオーバーレイを挟み、
 * フェードイン中にバトル画面で使う画像（敵スプライト・カード・フローチャート
 * アイコン）を並列で事前読み込みする。フェードイン完了とプリロード完了の
 * 両方が揃ったタイミング（`handleTransitionMidpoint`）で `BattleScreen` に
 * 切り替え、その後フェードアウトでバトル画面を露出させる。
 *
 * 戦闘 → マップの帰り道は 2 経路ある：
 *   - 右上テスト用 `BackToMapButton` → `handleExitToMap`：画面遷移のみ。
 *     クリア記録は変更しない（要件 3-3）。
 *   - 勝利演出 `VictoryClearOverlay` の「マップへ戻る」 → `handleClearedExitToMap`：
 *     `progressStore.markStageCleared(stageId)` でクリア記録を更新してから
 *     マップ画面へ遷移する（要件 3-1）。`markStageCleared` 内で次ステージの
 *     解放判定と `pendingUnlockStageId` のセットも行われ、`MapScreen` の
 *     マウント時 useEffect が拾って解放アニメを起動する。
 *
 * 将来「ステージ選択画面」「タイトル画面」「戦闘終了→マップ復帰」など
 * 本格的な画面遷移ロジックを追加する際は、ここの `useState` を Zustand
 * ストアやルーターに置き換える形で拡張する。
 *
 * Returns:
 *     JSX.Element: 現在の画面に応じたコンポーネント。
 */
function App() {
  const [screen, setScreen] = useState('map');
  const [stageId, setStageId] = useState(stagesData.demoStageIds[0]);
  const [pendingStageId, setPendingStageId] = useState(null);

  /*
   * クリア退出時の `exitStage` カットシーンは、次ステージの開放アニメーション
   * が終わってから出したい。開放アニメが走る場合はここに対象ステージ ID を
   * 退避し、アニメ完了（`isUnlockAnimating` が true→false）を検知して発火する。
   */
  const pendingExitStageIdRef = useRef(null);
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
   * 開発用ショートカット（自動ガイドの履歴操作）。マップ・バトルどちらの
   * 画面でも効くようグローバルに登録する。input/textarea へのフォーカス中と
   * 修飾キー同時押しは無視する（`UnlockSelectButton` の Space キーと同じガード方針）。
   *   - R : ガイドの表示履歴（`seenIds`）とステージの開放状況（`progressStore`）を
   *         まとめてリフレッシュ。最初の状態からガイドを見直せるようにする。
   *   （どこまで解放するかを選ぶ Space は `UnlockSelectButton`（MapScreen）が扱う。）
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.code !== 'KeyR') {
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
      useCutsceneStore.getState().resetSeen();
      useProgressStore.getState().resetProgress();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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

  const handleOpenEditor = useCallback(() => {
    setScreen('editor');
  }, []);

  const handleOpenGallery = useCallback(() => {
    setScreen('gallery');
  }, []);

  const handleClearedExitToMap = useCallback((clearedStageId) => {
    useProgressStore.getState().markStageCleared(clearedStageId);
    const progress = useProgressStore.getState();
    /*
     * ワールド最終ステージ（1-4 / 2-4 / 3-4）クリアで次ワールド解放シネマ
     * （`WorldUnlockCutscene`）が走るときは、吹き出し無しの全自動演出に任せ、
     * `exitStage` カットシーンは出さない。
     * それ以外で次ステージの開放アニメーションが走るなら、`exitStage` は
     * アニメ完了後に出す（上の useEffect が発火する）。開放アニメも無ければ
     * ここで即時発火する。
     */
    if (progress.pendingWorldUnlock !== null) {
      /* ワールド解放シネマが演出を担当するため何もしない。 */
    } else if (progress.pendingUnlockStageId !== null) {
      pendingExitStageIdRef.current = clearedStageId;
    } else {
      useCutsceneStore
        .getState()
        .fireTrigger({ type: 'exitStage', stageId: clearedStageId });
    }
    setScreen('map');
  }, []);

  let currentScreen;
  if (screen === 'battle') {
    currentScreen = (
      <BattleScreen
        stageId={stageId}
        onExitToMap={handleExitToMap}
        onClearedExitToMap={handleClearedExitToMap}
      />
    );
  } else if (screen === 'editor') {
    currentScreen = <SpriteSheetEditor onExit={handleExitToMap} />;
  } else if (screen === 'gallery') {
    currentScreen = <CharacterGallery onExit={handleExitToMap} />;
  } else {
    currentScreen = (
      <MapScreen
        onStartBattle={handleStartBattle}
        onStartBattleDemo={handleStartBattle}
        onOpenEditor={handleOpenEditor}
        onOpenGallery={handleOpenGallery}
        demoStageIds={stagesData.demoStageIds}
      />
    );
  }

  return (
    <>
      {currentScreen}
      {pendingStageId !== null && (
        <BattleTransition
          targetStageId={pendingStageId}
          onMidpoint={handleTransitionMidpoint}
          onEnd={handleTransitionEnd}
        />
      )}
    </>
  );
}

export default App;
