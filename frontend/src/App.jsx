import { useState } from 'react';
import MapScreen from './features/map/MapScreen.jsx';
import BattleScreen from './features/battle/BattleScreen.jsx';
import stagesData from './data/stages.json';

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

  const handleStartBattle = (id) => {
    setStageId(id);
    setScreen('battle');
  };

  if (screen === 'battle') {
    return (
      <BattleScreen stageId={stageId} onExitToMap={() => setScreen('map')} />
    );
  }
  return (
    <MapScreen
      onStartBattle={handleStartBattle}
      onStartBattleDemo={() => handleStartBattle(stagesData.demoStageId)}
    />
  );
}

export default App;
