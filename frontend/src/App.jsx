import { useCallback, useState } from 'react';
import MapScreen from './features/map/MapScreen.jsx';
import BattleScreen from './features/battle/BattleScreen.jsx';
import BattleTransition from './features/battle/BattleTransition.jsx';
import stagesData from './data/stages.json';
import useProgressStore from './stores/progressStore.js';

/**
 * アプリケーションのルートコンポーネント。
 *
 * `screen` 状態（`'map' | 'battle'`）と `stageId` 状態（次に戦うステージ ID）
 * を `useState` で管理し、画面切替の起点として機能する。起動直後はマップ
 * 画面（`MapScreen`）を表示し、ランドマーク詳細パネルの「たたかう」ボタン、
 * またはマップ右上のデバッグ用「バトルデモ」ボタンが押されると、対応する
 * `stageId` を保持しつつ戦闘画面（`BattleScreen`）に遷移する。テスト用途
 * のため、戦闘画面右上の「マップへ戻る」ボタンで戦闘進行や勝敗に関係なく
 * 即座にマップ画面へ戻れる（戦闘ステートはマウント解除でリセットされる）。
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
  const [stageId, setStageId] = useState(stagesData.demoStageId);
  const [pendingStageId, setPendingStageId] = useState(null);

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

  const handleClearedExitToMap = useCallback((clearedStageId) => {
    useProgressStore.getState().markStageCleared(clearedStageId);
    setScreen('map');
  }, []);

  const currentScreen =
    screen === 'battle' ? (
      <BattleScreen
        stageId={stageId}
        onExitToMap={handleExitToMap}
        onClearedExitToMap={handleClearedExitToMap}
      />
    ) : (
      <MapScreen
        onStartBattle={handleStartBattle}
        onStartBattleDemo={() => handleStartBattle(stagesData.demoStageId)}
      />
    );

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
