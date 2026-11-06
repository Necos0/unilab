import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './IslandVoyageOverlay.module.css';
import tokenizeFurigana from './tokenizeFurigana';
import usePlayerStore from '../../stores/playerStore.js';
import NARRATION_LINES from '../../data/stage5_narration.json';

/* 呼び出し元の画面（タイトル）を黒へ暗転させる時間（ms）。CSS の `.darkening` と合わせる。 */
const DARKEN_MS = 1200;

/* 暗転しきってから最初のナレーションを出すまでの「間」（ms）。 */
const BLACKOUT_HOLD_MS = 800;

/* 読み上げ（タイプライター）で 1 トークンを表示する間隔（ms）と、行の切り替え後に読み上げを始めるまでの待ち時間（ms）。 */
const REVEAL_INTERVAL_MS = 80;
const REVEAL_DELAY_MS = 500;

/* 最後のナレーションを送ってから、文字を消して真っ黒に戻すまでの時間（ms）。CSS の `.textLeaving` と合わせる。 */
const TEXT_FADE_OUT_MS = 800;

/* マップへ切り替えたあと、真っ黒のまま保つ時間（ms）。裏でマップ画像の読み込みを進める。 */
const PRE_BRIGHTEN_HOLD_MS = 600;

/* 明転（黒 → マップ）にかける時間（ms）。CSS の `.brightening` と合わせる。 */
const BRIGHTEN_MS = 1800;

/**
 * ステージ5に初めて入るときの「島へ渡る」演出オーバーレイ。
 *
 * タイトル画面の「つづきの ぼうけんへ」から初めてステージ5へ入るとき、
 * いきなりマップを出さずに次の流れで場面転換する:
 *
 *   1. `darkening` : タイトル画面の上で黒へゆっくり暗転する。
 *   2. `blackout`  : 真っ黒のまま少し間を置く。
 *   3. `narration` : 黒い画面の中央に `data/stage5_narration.json` の
 *      ナレーションを 1 行ずつ読み上げ表示する。クリックまたは任意キーで
 *      送る（読み上げ中なら全文を即表示する早送り）。文中の
 *      `{playerName}` はプレイヤー名（未入力なら「きみ」）に置き換える。
 *   4. `textLeaving`: 最後の行を送ると文字をフェードアウトさせる。消えきった
 *      ところで `onMidpoint` を呼び、親が裏でマップへ切り替える。
 *   5. `holding`   : マップ切り替え後、真っ黒のまま少し待つ。
 *   6. `brightening`: 黒をゆっくり晴らしてマップを見せ、終わったら `onEnd`。
 *
 * オーバーレイは `position: fixed` ＋最上位 z-index で全面を覆い、演出中の
 * ポインタ操作を下の画面へ通さない。表示中は window の keydown を capture で
 * 横取りし、下の画面のキー操作を防ぐ（修飾キー併用のブラウザ標準操作は
 * 素通し）。マップ側の会話送りの遮断は `cutsceneStore.isInputLocked` が担い、
 * `App` が `onMidpoint` で立てて `onEnd` で解除する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onMidpoint (function): ナレーションを終えて画面が真っ黒になった
 *             ときに呼ぶ（引数なし）。親はここで画面をマップへ切り替える。
 *         onEnd (function): 明転が終わったときに呼ぶ（引数なし）。親は
 *             このタイミングで本コンポーネントを外す。
 *
 * Returns:
 *     JSX.Element: 暗転・ナレーション・明転を行う全面オーバーレイ要素。
 */
function IslandVoyageOverlay({ onMidpoint, onEnd }) {
  const [phase, setPhase] = useState('darkening');
  const [index, setIndex] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);

  const onMidpointRef = useRef(onMidpoint);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onMidpointRef.current = onMidpoint;
    onEndRef.current = onEnd;
  }, [onMidpoint, onEnd]);

  /* ナレーションの `{playerName}` を置換してからトークン列にする。 */
  const lines = useMemo(() => {
    const playerName = usePlayerStore.getState().playerName;
    const heroName = playerName && playerName.length > 0 ? playerName : 'きみ';
    return NARRATION_LINES.map((text) =>
      tokenizeFurigana(text.replaceAll('{playerName}', heroName)),
    );
  }, []);
  const currentTokens = lines[index];
  const isRevealed = visibleCount >= currentTokens.length;

  /* 時間で進むフェーズ（暗転・間・文字消し・待機・明転）のタイマー。 */
  useEffect(() => {
    let timerId = null;
    if (phase === 'darkening') {
      timerId = setTimeout(() => setPhase('blackout'), DARKEN_MS);
    } else if (phase === 'blackout') {
      timerId = setTimeout(() => setPhase('narration'), BLACKOUT_HOLD_MS);
    } else if (phase === 'textLeaving') {
      timerId = setTimeout(() => {
        onMidpointRef.current?.();
        setPhase('holding');
      }, TEXT_FADE_OUT_MS);
    } else if (phase === 'holding') {
      timerId = setTimeout(() => setPhase('brightening'), PRE_BRIGHTEN_HOLD_MS);
    } else if (phase === 'brightening') {
      timerId = setTimeout(() => onEndRef.current?.(), BRIGHTEN_MS);
    }
    return () => clearTimeout(timerId);
  }, [phase]);

  /* 読み上げタイマー。早送り時にレンダー外から止めるため ref に持つ。 */
  const revealTimersRef = useRef({ delayId: null, intervalId: null });

  /* 行ごとに少し待ってから 1 トークンずつ出す（ナレーション中のみ）。 */
  useEffect(() => {
    if (phase !== 'narration') {
      return undefined;
    }
    const timers = revealTimersRef.current;
    timers.delayId = setTimeout(() => {
      let count = 0;
      timers.intervalId = setInterval(() => {
        count += 1;
        setVisibleCount(count);
        if (count >= currentTokens.length) {
          clearInterval(timers.intervalId);
        }
      }, REVEAL_INTERVAL_MS);
    }, REVEAL_DELAY_MS);
    return () => {
      clearTimeout(timers.delayId);
      clearInterval(timers.intervalId);
    };
  }, [phase, currentTokens]);

  /*
   * クリック／キー入力の共通ハンドラ。読み上げ中なら全文を即表示（早送り）、
   * 表示済みなら次の行へ、最後の行なら文字を消してマップへの切り替えへ進む。
   */
  const handleAdvance = useCallback(() => {
    if (phase !== 'narration') {
      return;
    }
    if (!isRevealed) {
      const timers = revealTimersRef.current;
      clearTimeout(timers.delayId);
      clearInterval(timers.intervalId);
      setVisibleCount(currentTokens.length);
      return;
    }
    if (index + 1 < lines.length) {
      setIndex(index + 1);
      setVisibleCount(0);
    } else {
      setPhase('textLeaving');
    }
  }, [phase, isRevealed, currentTokens, index, lines.length]);

  /* どのキーも「送り」として扱い、下の画面へは届けない。 */
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

  const isTextShown = phase === 'narration' || phase === 'textLeaving';
  const textNodes = currentTokens.map((token, tokenIndex) => {
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

  const overlayClassName = [
    styles.overlay,
    phase === 'darkening' && styles.darkening,
    phase === 'brightening' && styles.brightening,
  ]
    .filter(Boolean)
    .join(' ');
  const textClassName = [styles.text, phase === 'textLeaving' && styles.textLeaving]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={overlayClassName} onClick={handleAdvance} aria-live="polite">
      {isTextShown && (
        <p key={index} className={textClassName}>
          {textNodes}
        </p>
      )}
      {phase === 'narration' && isRevealed && (
        <div className={styles.nextHint} aria-hidden="true">
          ▼ クリックで つぎへ
        </div>
      )}
    </div>
  );
}

export default IslandVoyageOverlay;
