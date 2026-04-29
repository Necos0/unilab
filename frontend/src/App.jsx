import { useState } from 'react';
import MapScreen from './features/map/MapScreen.jsx';
import BattleScreen from './features/battle/BattleScreen.jsx';

/**
 * アプリケーションのルートコンポーネント。
 *
 * `screen` 状態（`'map' | 'battle'`）を `useState` で管理し、画面切替の
 * 起点として機能する。起動直後はマップ画面（`MapScreen`）を表示し、
 * マップ右上のデバッグ用「バトルデモ」ボタンが押されると戦闘画面
 * （`BattleScreen`）に遷移する。本実装はデバッグ／デモ用途のため、
 * 戦闘画面からマップへ戻る経路は設けていない（一方通行）。リロードで
 * 初期状態（マップ画面）に戻る。
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

  if (screen === 'battle') {
    return <BattleScreen />;
  }
  return <MapScreen onStartBattleDemo={() => setScreen('battle')} />;
}

export default App;
