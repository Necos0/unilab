import MapScreen from './features/map/MapScreen.jsx';

/**
 * アプリケーションのルートコンポーネント。
 *
 * 起動直後にフィールドマップ画面 (MapScreen) を表示する。今後は
 * ステージ選択・タイトル画面・戦闘画面（BattleScreen）への遷移を
 * ここで制御する。
 *
 * Returns:
 *     JSX.Element: アプリ全体のレイアウト。
 */
function App() {
  return <MapScreen />;
}

export default App;
