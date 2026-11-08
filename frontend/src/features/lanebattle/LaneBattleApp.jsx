import { useCallback, useState } from 'react';
import DeckBuilder from './DeckBuilder';
import MatchView from './MatchView';
import Furigana from './Furigana';
import useProgressStore from '../../stores/progressStore';
import config from './data/lanebattle_config.json';
import { unlockedRosterIds } from './engine/unitUnlock';

const DECK_SIZE = 6;

/** 解放プールから重複なしでランダムに size 枚選ぶ（☆×1 の CPU デッキ用）． */
function pickRandomDeck(pool, size) {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, size);
}

/**
 * ミニゲームのルート。フェーズ（編成→対戦）を束ねる（要件13）。
 *
 * 本編のストアや画面遷移には一切依存しない自己完結コンポーネント。編成
 * （`DeckBuilder`）で 6 体を選んで開始すると、3 レーン版の対戦（`MatchView`）を
 * 新しい `key` でマウントする（毎回エンジン・盤面・スコアを初期化）。対戦の
 * 結果画面・自己ベスト・再戦は `MatchView` が内部で持つので、ここでは扱わない。
 * 「デッキを かえる」で編成へ戻り、「もどる」でゲートを閉じる。
 *
 * 難易度は `DeckBuilder` 下部の3ボタン（☆×1/×2/×3）で選び、押下＝対戦開始。
 * ☆×1 の CPU デッキは本編進捗（`clearedStageIds`）で解放済みのキャラから
 * ランダムに 6 枚選び、☆×2/×3 は難易度プリセットの固定デッキを使う。
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
  const [difficulty, setDifficulty] = useState(null); // 難易度プリセット
  const [cpuDeckIds, setCpuDeckIds] = useState(null); // この対戦の CPU デッキ
  const [battleKey, setBattleKey] = useState(0);

  const startBattle = useCallback((ids, difficultyKey) => {
    const preset = config.cpu.difficulty[difficultyKey];
    const cleared = useProgressStore.getState().clearedStageIds;
    // ☆×1 は解放済みキャラからランダム6枚，☆×2/×3 は固定デッキ．
    const cpuIds = preset?.random
      ? pickRandomDeck(unlockedRosterIds(cleared), DECK_SIZE)
      : (preset?.deck ?? null);
    setDeck(ids);
    setDifficulty(preset);
    setCpuDeckIds(cpuIds);
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
          <MatchView
            key={battleKey}
            deckIds={deck}
            cpuDeckIds={cpuDeckIds}
            difficulty={difficulty}
            onExit={onClose}
            onRebuild={rebuild}
          />
        )}
      </main>
    </div>
  );
}
