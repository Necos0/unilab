import { useEffect, useRef, useState } from 'react';
import styles from './CoordinateHuntScreen.module.css';
import HuntGrid, { GRID_COLS, GRID_ROWS } from './HuntGrid';
import pickRandomCell from './pickRandomCell';

/* 1 プレイの制限時間(秒) */
const GAME_TIME_SECONDS = 60;

/* 正解 1 回の基本点。連続正解数(コンボ)を掛けてスコアに加算する */
const SCORE_PER_COMBO = 100;

/* 正誤マーカーを表示してから消すまでの時間(ms) */
const FEEDBACK_CLEAR_DELAY_MS = 900;

/* のこり時間の警告表示(赤)に切り替えるしきい値(秒) */
const TIME_WARNING_SECONDS = 10;

/* 自己ベスト(最高スコア)の localStorage キー */
const BEST_SCORE_STORAGE_KEY = 'unilab.coordinatehunt.bestScore';

/* 出題役のロボ(ビット)のアイコン画像。RoboBubble と同じアセットを使う */
const ROBO_ICON_SRC = '/sprites/robo/robo.png';

/**
 * 自己ベスト(最高スコア)を localStorage から読み込む。
 *
 * 値が無い・壊れている・localStorage が使えない場合は null を返し、
 * 「記録なし」として扱う(`CardMatchScreen.loadBestMoves` と同じ方針)。
 *
 * Returns:
 *     number | null: 自己ベストのスコア。記録が無ければ null。
 */
function loadBestScore() {
  try {
    const raw = localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    const parsed = Number(raw);
    return raw !== null && Number.isInteger(parsed) && parsed > 0
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * 自己ベスト(最高スコア)を localStorage へ保存する。
 *
 * localStorage が使えない環境では黙って無視する(永続化できなくても
 * セッション中の表示は state 側で機能するため)。
 *
 * Args:
 *     score (number): 保存するスコア。
 */
function saveBestScore(score) {
  try {
    localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(score));
  } catch {
    /* 永続化不可でも致命的ではないので無視する */
  }
}

/**
 * ミニゲーム「ざひょうたからさがし」の画面。
 *
 * マップに 16×9 の格子を重ね、ロボが言う (よこ, たて) 座標のマスを制限時間内に
 * タップし続けてスコアを競う。座標は算数の座標平面と同じ向き(よこは右へ、
 * たては上へ増える)で、左下のマスが (0, 0)。正解すると連続正解数(コンボ)
 * ×100 点が入り、はずすとコンボが 0 に戻る。はずしたマスには「ここは (x, y)」と
 * 実際の座標が表示され(HuntGrid 側の演出)、読み間違いに気づけるようにする。
 *
 * 進行はローカル state `phase`('ready' | 'playing')と残り時間から決まる:
 *   - 'ready'                    : ルール説明とスタートボタンのオーバーレイ
 *   - 'playing' かつ残り時間 > 0 : 出題・タップ判定・1 秒刻みのカウントダウン
 *   - 'playing' かつ残り時間 = 0 : 結果(スコア・自己ベスト)のオーバーレイ
 *     (「終了」を独立した state にせず導出にすることで、effect 内での
 *     同期的な setState を避ける)
 *
 * タイマーは 1 秒ごとの setTimeout の連鎖で減らす。自己ベストは正解した
 * クリックハンドラ内でその都度判定して localStorage へ保存し、「しんきろく!」
 * 表示はプレイ開始時点のベスト(`runStartBest`)との比較から導出する。
 * 正誤マーカーは通し番号 `id` を付けて `feedback` に入れ、一定時間後に
 * 自動で消す。
 *
 * ゲーム内テキストは低学年でも読めるよう、すべてひらがな・カタカナで書く
 * (漢字を使わないことでふりがな規則を満たす)。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExit (function): 「ひろばへもどる」押下時に呼ぶハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: ざひょうたからさがし画面全体を表す section 要素。
 */
function CoordinateHuntScreen({ onExit }) {
  const [phase, setPhase] = useState('ready');
  const [target, setTarget] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [foundCount, setFoundCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_TIME_SECONDS);
  const [feedback, setFeedback] = useState(null);
  const [bestScore, setBestScore] = useState(loadBestScore);
  /* プレイ開始時点の自己ベスト。「しんきろく!」判定の比較対象 */
  const [runStartBest, setRunStartBest] = useState(null);
  /* 正誤マーカーの通し番号。同じマスの連続でも演出を再生し直すための key */
  const nextFeedbackId = useRef(0);

  const isFinished = phase === 'playing' && timeLeft === 0;
  const isNewRecord =
    isFinished && score > 0 && (runStartBest === null || score > runStartBest);

  /* 1 秒刻みのカウントダウン。1 秒ごとの setTimeout の連鎖で 0 まで減らす */
  useEffect(() => {
    if (phase !== 'playing' || timeLeft === 0) {
      return undefined;
    }
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, timeLeft]);

  /* 正誤マーカーの自動消去。新しいマーカーが来たら古いタイマーは破棄する */
  useEffect(() => {
    if (!feedback) {
      return undefined;
    }
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_CLEAR_DELAY_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const handleStart = () => {
    setScore(0);
    setCombo(0);
    setFoundCount(0);
    setTimeLeft(GAME_TIME_SECONDS);
    setFeedback(null);
    setRunStartBest(bestScore);
    setTarget(pickRandomCell(GRID_COLS, GRID_ROWS, null));
    setPhase('playing');
  };

  const handleCellClick = (cell) => {
    if (phase !== 'playing' || isFinished || !target) {
      return;
    }
    nextFeedbackId.current += 1;
    if (cell.x === target.x && cell.y === target.y) {
      const nextCombo = combo + 1;
      const points = SCORE_PER_COMBO * nextCombo;
      const nextScore = score + points;
      setCombo(nextCombo);
      setScore(nextScore);
      setFoundCount(foundCount + 1);
      setFeedback({ id: nextFeedbackId.current, type: 'hit', cell, points });
      setTarget(pickRandomCell(GRID_COLS, GRID_ROWS, cell));
      /* 自己ベストはこの場で更新・保存する(時間切れを待つと effect 内の
         同期 setState が必要になるため。しんきろく表示は runStartBest 比較) */
      if (bestScore === null || nextScore > bestScore) {
        saveBestScore(nextScore);
        setBestScore(nextScore);
      }
    } else {
      setCombo(0);
      setFeedback({ id: nextFeedbackId.current, type: 'miss', cell });
    }
  };

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <button type="button" className={styles.exitButton} onClick={onExit}>
          ← ひろばへもどる
        </button>
        <h1 className={styles.title}>ざひょうたからさがし</h1>
        <div className={styles.statusRow}>
          <span className={styles.stat}>
            スコア <span className={styles.statValue}>{score}</span>
          </span>
          <span className={styles.stat}>
            コンボ{' '}
            <span className={styles.statValue}>
              {combo > 0 ? `×${combo}` : '-'}
            </span>
          </span>
          <span
            className={`${styles.stat} ${
              phase === 'playing' && timeLeft <= TIME_WARNING_SECONDS
                ? styles.timeWarning
                : ''
            }`}
          >
            のこり <span className={styles.statValue}>{timeLeft}</span> びょう
          </span>
        </div>
      </header>
      <div className={styles.targetRow}>
        <img
          className={styles.roboIcon}
          src={ROBO_ICON_SRC}
          alt="ビット"
          draggable={false}
        />
        <div className={styles.bubble}>
          {phase === 'playing' && !isFinished && target ? (
            <>
              <span className={styles.targetCoords}>
                ({target.x}, {target.y})
              </span>
              <span className={styles.targetHint}>
                よこ {target.x} ・ たて {target.y} に たからが あるよ!
              </span>
            </>
          ) : (
            <span className={styles.targetHint}>
              スタートを おすと たからさがしが はじまるよ!
            </span>
          )}
        </div>
      </div>
      <div className={styles.gridWrap}>
        <HuntGrid onCellClick={handleCellClick} feedback={feedback} />
      </div>
      {phase === 'ready' && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <p className={styles.panelTitle}>ざひょうたからさがし</p>
            <ul className={styles.ruleList}>
              <li>ロボの いう (よこ, たて) の マスを タップ!</li>
              <li>よこは →に すすむほど おおきく なるよ</li>
              <li>たては ↑に あがるほど おおきく なるよ</li>
              <li>いちばん ひだりしたの マスが (0, 0)</li>
              <li>れんぞくで あてると コンボで スコアアップ!</li>
              <li>じかんは {GAME_TIME_SECONDS}びょう!</li>
            </ul>
            <button
              type="button"
              className={styles.panelButton}
              onClick={handleStart}
            >
              スタート!
            </button>
          </div>
        </div>
      )}
      {isFinished && (
        <div className={styles.overlay}>
          <div className={styles.panel}>
            <p className={styles.panelTitle}>タイムアップ!</p>
            <p className={styles.resultScore}>スコア: {score}</p>
            <p className={styles.resultStats}>
              みつけた たから: {foundCount}こ
            </p>
            {isNewRecord ? (
              <p className={styles.newRecord}>しんきろく!</p>
            ) : (
              bestScore !== null && (
                <p className={styles.resultStats}>じこベスト: {bestScore}</p>
              )
            )}
            <div className={styles.panelButtons}>
              <button
                type="button"
                className={styles.panelButton}
                onClick={handleStart}
              >
                もういちど
              </button>
              <button
                type="button"
                className={styles.panelButton}
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

export default CoordinateHuntScreen;
