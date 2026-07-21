import { useEffect, useState } from 'react';
import styles from './CardMatchScreen.module.css';
import MatchCard from './MatchCard';
import shuffleArray from './shuffleArray';

/*
 * 盤面に使う敵の ID（8 種 = 8 ペア = 4×4 の 16 枚）。ワールド 1・2 に登場
 * する敵で固定し、ひろばが解放される「ステージ 2 クリア」時点でプレイヤーが
 * 見たことのある顔ぶれに揃える。
 */
const PAIR_ENEMY_IDS = [
  'slime',
  'wolf',
  'knight',
  'golem',
  'cactus',
  'scorpion',
  'cobra',
  'goldenbird',
];

/*
 * ペア不成立のとき、2 枚目を見せてから裏へ戻すまでの時間（ms）。
 * 子どもが絵柄を覚える余裕を持たせる。
 */
const MISMATCH_HIDE_DELAY_MS = 900;

/* 自己ベスト（最少めくり回数）の localStorage キー */
const BEST_MOVES_STORAGE_KEY = 'unilab.cardmatch.bestMoves';

/**
 * 自己ベスト（最少めくり回数）を localStorage から読み込む。
 *
 * 値が無い・壊れている・localStorage が使えない場合は null を返し、
 * 「記録なし」として扱う（`cutsceneStore.loadSeenIds` と同じ方針）。
 *
 * Returns:
 *     number | null: 自己ベストのめくり回数。記録が無ければ null。
 */
function loadBestMoves() {
  try {
    const raw = localStorage.getItem(BEST_MOVES_STORAGE_KEY);
    const parsed = Number(raw);
    return raw !== null && Number.isInteger(parsed) && parsed > 0
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * 自己ベスト（最少めくり回数）を localStorage へ保存する。
 *
 * localStorage が使えない環境では黙って無視する（永続化できなくても
 * セッション中の表示は state 側で機能するため）。
 *
 * Args:
 *     moves (number): 保存するめくり回数。
 */
function saveBestMoves(moves) {
  try {
    localStorage.setItem(BEST_MOVES_STORAGE_KEY, String(moves));
  } catch {
    /* 永続化不可でも致命的ではないので無視する */
  }
}

/**
 * シャッフル済みの盤面（カード 16 枚の配列）を作る。
 *
 * `PAIR_ENEMY_IDS` の各敵を 2 枚ずつに複製し、`shuffleArray` でランダムな
 * 並びにする。`key` は「敵 ID + a/b」で全 16 枚が一意になる。
 *
 * Returns:
 *     Array<{key: string, enemyId: string}>: 並び順どおりのカード定義配列。
 */
function buildShuffledCards() {
  const doubled = PAIR_ENEMY_IDS.flatMap((enemyId) => [
    { key: `${enemyId}-a`, enemyId },
    { key: `${enemyId}-b`, enemyId },
  ]);
  return shuffleArray(doubled);
}

/**
 * ミニゲーム「カードあわせ」（神経衰弱）の画面。
 *
 * 4×4 に並んだ裏向きのカードを 2 枚ずつめくり、同じ敵の絵をそろえる。
 * 全 8 ペアをそろえるとクリアで、「めくったかいすう」（2 枚めくって 1 回）が
 * 少ないほど良い記録になる。自己ベストは localStorage に永続化し、更新時は
 * 「しんきろく!」と表示する。
 *
 * 進行ルール:
 *   - 1 枚目: そのまま表向きになる
 *   - 2 枚目: 回数が 1 増える。ペアなら 2 枚とも表のまま固定（`matchedEnemyIds`）、
 *     はずれなら `MISMATCH_HIDE_DELAY_MS` 後に 2 枚とも裏へ戻る（戻るまでは
 *     ほかのカードを押せない）
 *   - 全ペアがそろうとクリアオーバーレイ（回数・自己ベスト・もういちど／
 *     もどるボタン）を出す
 *
 * はずれ 2 枚の自動裏返しは `faceUpKeys` を監視する useEffect + setTimeout で
 * 行い、クリーンアップでタイマーを破棄する。自己ベストの判定・保存は
 * 最後のペアがそろった瞬間のクリックハンドラ内（同期処理）で済ませる。
 *
 * ゲーム内テキストは低学年でも読めるよう、すべてひらがな・カタカナで書く
 * （漢字を使わないことでふりがな規則を満たす）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExit (function): 「ひろばへもどる」押下時に呼ぶハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: カードあわせ画面全体を表す section 要素。
 */
function CardMatchScreen({ onExit }) {
  const [cards, setCards] = useState(buildShuffledCards);
  /* いま表向きの（まだそろっていない）カードの key。最大 2 枚 */
  const [faceUpKeys, setFaceUpKeys] = useState([]);
  /* そろったペアの敵 ID */
  const [matchedEnemyIds, setMatchedEnemyIds] = useState([]);
  const [moveCount, setMoveCount] = useState(0);
  const [bestMoves, setBestMoves] = useState(loadBestMoves);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const isCleared = matchedEnemyIds.length === PAIR_ENEMY_IDS.length;

  /*
   * はずれ 2 枚の自動裏返し。ペア成立時はクリック時点で `faceUpKeys` が
   * 空に戻るため、ここへ来るのは「2 枚表向きのまま = はずれ」のときだけ。
   */
  useEffect(() => {
    if (faceUpKeys.length !== 2) {
      return undefined;
    }
    const timer = setTimeout(() => setFaceUpKeys([]), MISMATCH_HIDE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [faceUpKeys]);

  const handleCardClick = (key) => {
    /* はずれ 2 枚の裏返し待ちの間は押せない */
    if (faceUpKeys.length >= 2) {
      return;
    }
    if (faceUpKeys.includes(key)) {
      return;
    }
    const card = cards.find((c) => c.key === key);
    if (!card || matchedEnemyIds.includes(card.enemyId)) {
      return;
    }
    if (faceUpKeys.length === 0) {
      setFaceUpKeys([key]);
      return;
    }
    /* 2 枚目。めくった回数を数え、ペア判定する */
    const first = cards.find((c) => c.key === faceUpKeys[0]);
    const nextMoveCount = moveCount + 1;
    setMoveCount(nextMoveCount);
    if (first.enemyId !== card.enemyId) {
      setFaceUpKeys([faceUpKeys[0], key]);
      return;
    }
    const nextMatched = [...matchedEnemyIds, card.enemyId];
    setMatchedEnemyIds(nextMatched);
    setFaceUpKeys([]);
    /* 最後のペアがそろった瞬間に自己ベストを判定・保存する */
    if (nextMatched.length === PAIR_ENEMY_IDS.length) {
      if (bestMoves === null || nextMoveCount < bestMoves) {
        saveBestMoves(nextMoveCount);
        setBestMoves(nextMoveCount);
        setIsNewRecord(true);
      }
    }
  };

  const handleRestart = () => {
    setCards(buildShuffledCards());
    setFaceUpKeys([]);
    setMatchedEnemyIds([]);
    setMoveCount(0);
    setIsNewRecord(false);
  };

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <button type="button" className={styles.exitButton} onClick={onExit}>
          ← ひろばへもどる
        </button>
        <h1 className={styles.title}>カードあわせ</h1>
        <div className={styles.moveCounter}>
          めくったかいすう: <span className={styles.moveCount}>{moveCount}</span>
        </div>
      </header>
      <p className={styles.hint}>おなじ えを 2まい みつけよう!</p>
      <div className={styles.board}>
        {cards.map((card) => (
          <MatchCard
            key={card.key}
            enemyId={card.enemyId}
            isFaceUp={faceUpKeys.includes(card.key)}
            isMatched={matchedEnemyIds.includes(card.enemyId)}
            onClick={() => handleCardClick(card.key)}
          />
        ))}
      </div>
      {isCleared && (
        <div className={styles.clearOverlay}>
          <div className={styles.clearPanel}>
            <p className={styles.clearText}>クリア!</p>
            <p className={styles.clearStats}>
              めくったかいすう: {moveCount}かい
            </p>
            {isNewRecord ? (
              <p className={styles.newRecord}>しんきろく!</p>
            ) : (
              bestMoves !== null && (
                <p className={styles.clearStats}>じこベスト: {bestMoves}かい</p>
              )
            )}
            <div className={styles.clearButtons}>
              <button
                type="button"
                className={styles.clearButton}
                onClick={handleRestart}
              >
                もういちど
              </button>
              <button
                type="button"
                className={styles.clearButton}
                onClick={onExit}
              >
                ひろばへもどる
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default CardMatchScreen;
