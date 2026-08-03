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

/*
 * 冒頭の暗転時間（ms）。エンディングゲームの「つぎへ すすむ」から
 * ビットのモノローグへ移るあいだ、真っ黒な画面だけを見せて場面転換の
 * 間を作る。
 */
const BLACKOUT_MS = 1000;

/**
 * エンディングロール後のエピローグ会話画面。
 *
 * エンディングゲームのリザルトで「つぎへ すすむ」を押すと表示される、
 * 次のアップデート（続編）を匂わせる短い会話シーン。まず `BLACKOUT_MS`
 * のあいだ真っ黒な画面だけを見せて場面転換の間を作り（この間は送り操作も
 * 効かない）、暗転が明けると黒背景の中央に
 * 相棒のビット（`/sprites/robo/robo.png`）がふわふわ浮かび、
 * `data/ending_epilogue.json` のセリフを 1 つずつ読み上げ表示する。
 * セリフ中の `{playerName}` はプレイヤー名（未入力なら「きみ」）に
 * 置き換える。
 *
 * 操作はクリックまたは任意のキーでの「送り」だが、紙芝居と違い
 * **読み上げ中の早送りはできない**（大事なモノローグなので、セリフは
 * 必ず最後まで読み上げてから送れるようになる）。
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
  /* 冒頭の暗転が明けてモノローグを始めたか。 */
  const [hasStarted, setHasStarted] = useState(false);

  /* マウント直後は真っ黒のまま待ち、`BLACKOUT_MS` 後に会話を始める。 */
  useEffect(() => {
    const timerId = setTimeout(() => setHasStarted(true), BLACKOUT_MS);
    return () => clearTimeout(timerId);
  }, []);

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

  /* 読み上げアニメーション。セリフごとに少し待ってから 1 トークンずつ出す
   * （冒頭の暗転が明けるまでは始めない）。 */
  useEffect(() => {
    if (!hasStarted || isContinueStep || !currentLine) {
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
  }, [hasStarted, index, isContinueStep, currentLine]);

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
    if (!hasStarted || isLeaving) {
      return;
    }
    /*
     * 読み上げの途中は送り操作を受け付けない（早送りなし）。大事な
     * モノローグなので、セリフは最後まで読み上げさせてから次へ進める。
     */
    if (!isContinueStep && visibleCount < currentLine.tokens.length) {
      return;
    }
    if (!isContinueStep) {
      setIndex(index + 1);
    } else {
      setIsLeaving(true);
    }
  }, [hasStarted, isLeaving, isContinueStep, visibleCount, currentLine, index]);

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

  /* セリフ中の `\n` は改行として描画する（トークンなので場所は常に確保）。 */
  const textNodes = currentLine?.tokens.map((token, tokenIndex) => {
    const className = tokenIndex >= visibleCount ? styles.hidden : undefined;
    if (token.type === 'char' && token.value === '\n') {
      return <br key={tokenIndex} />;
    }
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
      {!hasStarted ? null : isContinueStep ? (
        <p className={styles.toBeContinued}>つづく…</p>
      ) : (
        /*
         * `key` を付けずセリフ間で再マウントしない。ビットと名前は出しっ
         * ぱなしのまま、本文だけがタイプライターで入れ替わる（切り替えの
         * たびにビットが消えて出直すのを防ぐ。フェードインは初回マウントの
         * 一度だけ）。
         */
        <div className={styles.dialogue}>
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
