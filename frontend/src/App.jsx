import FullscreenButton from './components/FullscreenButton.jsx';

/**
 * アプリケーションのルートコンポーネント。
 *
 * 現状はタイトル表示と全画面切り替えボタンのみを提供する。
 * 今後はここを入口に戦闘画面・ステージ選択などの画面遷移を配置する。
 *
 * Returns:
 *     JSX.Element: アプリ全体のレイアウトを表す main 要素。
 */
function App() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>フローチャート型パズルRPG</h1>
      <p>開発環境セットアップ完了</p>
      <FullscreenButton />
    </main>
  );
}

export default App;
