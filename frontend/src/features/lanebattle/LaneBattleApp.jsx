import { useCallback, useState } from 'react';
import DeckBuilder from './DeckBuilder';
import BattleView from './BattleView';
import ResultOverlay from './ResultOverlay';
import Furigana from './Furigana';
import useLaneBattleBest from './hooks/useLaneBattleBest';

/**
 * ミニゲームのルート。フェーズ（編成→対戦→結果）を束ねる（要件13）。
 *
 * 本編のストアや画面遷移には一切依存しない自己完結コンポーネント。再戦は
 * `BattleView` の key を変えて再マウントし、エンジンを作り直すことで実現
 * する（城 HP・エネルギー・スコアの初期化）。自己ベストは
 * `useLaneBattleBest` 経由で localStorage に保存する。
 *
 * Args:
 *     props (object):
 *         onClose (function): ミニゲームを閉じて起動前の画面へ戻す。
 *
 * Returns:
 *     JSX.Element: ミニゲーム全体。
 */
export default function LaneBattleApp({ onClose }) {
  const [phase, setPhase] = useState('deckbuild'); // 'deckbuild' | 'battle' | 'result'
  const [deck, setDeck] = useState([]);
  const [battleKey, setBattleKey] = useState(0);
  const [result, setResult] = useState(null);
  const { best, submit } = useLaneBattleBest();

  const startBattle = useCallback((ids) => {
    setDeck(ids);
    setResult(null);
    setBattleKey((k) => k + 1);
    setPhase('battle');
  }, []);

  const handleEnd = useCallback(
    (r) => {
      const isNewBest = submit(r.score);
      setResult({ ...r, isNewBest });
      setPhase('result');
    },
    [submit],
  );

  const rematch = useCallback(() => {
    setResult(null);
    setBattleKey((k) => k + 1);
    setPhase('battle');
  }, []);

  const rebuild = useCallback(() => {
    setResult(null);
    setPhase('deckbuild');
  }, []);

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
        {(phase === 'battle' || phase === 'result') && (
          <BattleView key={battleKey} deckIds={deck} onEnd={handleEnd} />
        )}
        {phase === 'result' && result && (
          <ResultOverlay
            result={result}
            best={best}
            onRematch={rematch}
            onRebuild={rebuild}
            onExit={onClose}
          />
        )}
      </main>
    </div>
  );
}
