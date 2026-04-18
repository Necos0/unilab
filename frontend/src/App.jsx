import BattleScreen from './features/battle/BattleScreen.jsx';

/**
 * アプリケーションのルートコンポーネント。
 *
 * 起動直後に戦闘画面 (BattleScreen) を表示する。今後はステージ選択・
 * タイトル画面などを追加する際にここで画面遷移を制御する。
 *
 * Returns:
 *     JSX.Element: アプリ全体のレイアウト。
 */
function App() {
  return <BattleScreen />;
}

export default App;
