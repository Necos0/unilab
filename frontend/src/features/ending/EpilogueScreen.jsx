import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './EpilogueScreen.module.css';
import tokenizeFurigana from '../cutscene/tokenizeFurigana';
import usePlayerStore from '../../stores/playerStore.js';
import EPILOGUE_LINES from '../../data/ending_epilogue.json';

/*
 * 読み上げ（タイプライター）で 1 トークンを表示する間隔（ms）と、
 * セリフが切り替わってから読み上げを始めるまでの待ち時間（ms）。
 * 余韻を大事にする場面なので紙芝居（`StoryScreen`）と同じゆっくりめ。
 */
const REVEAL_INTERVAL_MS = 90;
const REVEAL_DELAY_MS = 400;

/* 「つづく…」を送ったあと、黒へフェードアウトしてから `onFinish` を呼ぶまでの時間（ms）。 */
const FADE_OUT_MS = 700;

/**
 * エンディングロール後のエピローグ会話画面。
 *
 * エンディングゲームのリザルトで「つぎへ すすむ」を押すと表示される、
 * 次のアップデート（続編）を匂わせる短い会話シーン。黒背景の中央に
 * 相棒のビット（`/sprites/robo/robo.png`）がふわふわ浮かび、
 * `data/ending_epilogue.json` のセリフを 1 つずつ読み上げ表示する。
 * セリフ中の `{playerName}` はプレイヤー名（未入力なら「きみ」）に
 * 置き換える。
 *
 * 操作は紙芝居（`StoryScreen`）と同じ：クリックまたは任意のキーで、
 * 読み上げ中なら全文を即表示（早送り）、表示済みなら次のセリフへ進む。
 * 最後のセリフのあとは中央に「つづく…」を出し、もう一度送ると黒へ
 * フェードアウトして `onFinish` を呼ぶ（親がタイトルへ戻す）。
 * 表示中は window の keydown を capture で横取りし、他画面のキー操作や
 * 誤送りを防ぐ（修飾キー併用のブラウザ標準操作は素通し）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onFinish (function): 「つづく…」まで見終えたときに呼ぶ（引数なし）。
 *
 * Returns:
 *     JSX.Element: エピローグ会話画面全体の要素。
 */
function EpilogueScreen({ onFinish }) {
  /* `EPILOGUE_LINES.length` 番目は「つづく…」の表示ステップ。 */
  const [index, setIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);
  const [isLeaving, setIsLeaving] = useState(false);

  const isContinueStep = index >= EPILOGUE_LINES.length;

  /* セリフの `{playerName}` を置換してからトークン列にする。 */
  const lines = useMemo(() => {
    const playerName = usePlayerStore.getState().playerName;
    const heroName = playerName && playerName.length > 0 ? playerName : 'きみ';
    return EPILOGUE_LINES.map((line) => ({
      speaker: line.speaker,
      tokens: tokenizeFurigana(line.text.replaceAll('{playerName}', heroName)),
    }));
  }, []);
  const currentLine = isContinueStep ? null : lines[index];
  const isRevealed =
    isContinueStep || visibleCount >= (currentLine?.tokens.length ?? 0);

  /* 読み上げタイマー。早送り時にレンダー外から止めるため ref に持つ。 */
  const revealTimersRef = useRef({ delayId: null, intervalId: null });

  /* セリフが進んだら読み上げ位置をリセットする（レンダー中の条件付き setState）。 */
  const [lineKey, setLineKey] = useState(index);
  if (index !== lineKey) {
    setLineKey(index);
    setVisibleCount(0);
  }

  /* 読み上げアニメーション。セリフごとに少し待ってから 1 トークンずつ出す。 */
  useEffect(() => {
    if (isContinueStep || !currentLine) {
      return undefined;
    }
    const timers = revealTimersRef.current;
    timers.delayId = setTimeout(() => {
      let count = 0;
      timers.intervalId = setInterval(() => {
        count += 1;
        setVisibleCount(count);
        if (count >= currentLine.tokens.length) {
          clearInterval(timers.intervalId);
        }
      }, REVEAL_INTERVAL_MS);
    }, REVEAL_DELAY_MS);
    return () => {
      clearTimeout(timers.delayId);
      clearInterval(timers.intervalId);
    };
  }, [index, isContinueStep, currentLine]);

  /* 「つづく…」を送ったら、フェードアウトを待って `onFinish` を呼ぶ。 */
  useEffect(() => {
    if (!isLeaving) {
      return undefined;
    }
    const timerId = setTimeout(() => onFinish(), FADE_OUT_MS);
    return () => clearTimeout(timerId);
  }, [isLeaving, onFinish]);

  /*
   * クリック／キー入力の共通ハンドラ。読み上げ中なら全文を即表示（早送り）、
   * 表示済みなら次のセリフ →「つづく…」→ フェードアウトへ進める。
   */
  const handleAdvance = useCallback(() => {
    if (isLeaving) {
      return;
    }
    if (!isContinueStep && visibleCount < currentLine.tokens.length) {
      const timers = revealTimersRef.current;
      clearTimeout(timers.delayId);
      clearInterval(timers.intervalId);
      setVisibleCount(currentLine.tokens.length);
      return;
    }
    if (!isContinueStep) {
      setIndex(index + 1);
    } else {
      setIsLeaving(true);
    }
  }, [isLeaving, isContinueStep, visibleCount, currentLine, index]);

  /* どのキーも「送り」として扱う（`StoryScreen` と同じ方針）。 */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) {
        handleAdvance();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleAdvance]);

  const textNodes = currentLine?.tokens.map((token, tokenIndex) => {
    const className = tokenIndex >= visibleCount ? styles.hidden : undefined;
    return token.type === 'ruby' ? (
      <ruby key={tokenIndex} className={className}>
        {token.base}
        <rt>{token.ruby}</rt>
      </ruby>
    ) : (
      <span key={tokenIndex} className={className}>
        {token.value}
      </span>
    );
  });

  const rootClassName = [styles.root, isLeaving && styles.leaving]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={rootClassName}
      onClick={handleAdvance}
      role="button"
      tabIndex={0}
      aria-label="つぎへ"
    >
      {isContinueStep ? (
        <p className={styles.toBeContinued}>つづく…</p>
      ) : (
        <div key={index} className={styles.dialogue}>
          <img
            className={styles.robo}
            src="/sprites/robo/robo.png"
            alt="ビット"
            draggable={false}
          />
          <p className={styles.speaker}>{currentLine.speaker}</p>
          <p className={styles.text}>{textNodes}</p>
        </div>
      )}
      {isRevealed && !isLeaving && (
        <div className={styles.nextHint} aria-hidden="true">
          ▼ クリックで つぎへ
        </div>
      )}
    </section>
  );
}

export default EpilogueScreen;
