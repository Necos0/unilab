import { useCallback, useState } from 'react';
import DeckBuilder from './DeckBuilder';
import MatchView from './MatchView';
import Furigana from './Furigana';

/**
 * ミニゲームのルート。フェーズ（編成→対戦）を束ねる（要件13）。
 *
 * 本編のストアや画面遷移には一切依存しない自己完結コンポーネント。編成
 * （`DeckBuilder`）で 6 体を選んで開始すると、3 レーン版の対戦（`MatchView`）を
 * 新しい `key` でマウントする（毎回エンジン・盤面・スコアを初期化）。対戦の
 * 結果画面・自己ベスト・再戦は `MatchView` が内部で持つので、ここでは扱わない。
 * 「デッキを かえる」で編成へ戻り、「もどる」でゲートを閉じる。
 *
 * Args:
 *     props (object):
 *         onClose (function): ミニゲームを閉じて起動前の画面へ戻す。
 *
 * Returns:
 *     JSX.Element: ミニゲーム全体。
 */
export default function LaneBattleApp({ onClose }) {
  const [phase, setPhase] = useState('deckbuild'); // 'deckbuild' | 'battle'
  const [deck, setDeck] = useState([]);
  const [battleKey, setBattleKey] = useState(0);

  const startBattle = useCallback((ids) => {
    setDeck(ids);
    setBattleKey((k) => k + 1);
    setPhase('battle');
  }, []);

  const rebuild = useCallback(() => setPhase('deckbuild'), []);

  return (
    <div className="lb-app">
      <header className="lb-header">
        <span className="lb-title">
          ⚔️ <Furigana text="陣取《じんと》り合戦《がっせん》" />
        </span>
        <button type="button" className="lb-close" onClick={onClose}>
          もどる ✕
        </button>
      </header>

      <main className="lb-main">
        {phase === 'deckbuild' && <DeckBuilder onStart={startBattle} />}
        {phase === 'battle' && (
          <MatchView key={battleKey} deckIds={deck} onExit={onClose} onRebuild={rebuild} />
        )}
      </main>
    </div>
  );
}
