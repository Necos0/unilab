import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './StoryScreen.module.css';
import tokenizeFurigana from '../cutscene/tokenizeFurigana';
import STORY_SLIDES from '../../data/story_slides.json';

/*
 * スライド表示からクリック／キー入力での送りを受け付けるまでの待ち時間（ms）。
 * この間はスキップできず、経過すると「つぎへ」の案内を表示する。
 */
const LOCK_MS = 3000;

/*
 * 3 秒ロックを外し、最初からクリック／キーで送れるようにするか。
 * 開発中の暫定として本番ビルドでも true にしている。リリース時に false へ
 * 戻すと `LOCK_MS` のロックが復活する。
 */
const IS_LOCK_DISABLED = true;

/*
 * 最後のスライドを送ったあと、黒へフェードアウトしてから `onFinish` を呼ぶ
 * までの時間（ms）。CSS 側の `storyFadeOut` の長さと合わせる。
 */
const FADE_OUT_MS = 700;

/*
 * 読み上げ（タイプライター）で 1 トークン（1 文字 or ルビ 1 組）を表示する
 * 間隔（ms）。紙芝居は物語をじっくり読ませたい場面なので、会話吹き出し
 * （`RoboBubble` の 45ms）よりゆっくりにしている。
 */
const REVEAL_INTERVAL_MS = 90;

/*
 * スライドが切り替わってから文章の読み上げを始めるまでの待ち時間（ms）。
 * 先に絵のフェードインを見せてから文字を流し始める。
 */
const REVEAL_DELAY_MS = 600;

/**
 * ゲーム冒頭のオープニング紙芝居画面。
 *
 * タイトル画面の「スタート」ボタン押下後に表示する。背景は黒一色で、画面
 * 上部に絵、下部に文章を置いたスライド（`data/story_slides.json`）を 1 枚
 * ずつ流す。
 * スライドが切り替わるたびに絵は透明からゆっくりフェードインし、文章は
 * 絵より少し遅れて（`REVEAL_DELAY_MS`）読み上げ（タイプライター）
 * アニメーションで 1 トークンずつゆっくり流す（`REVEAL_INTERVAL_MS` 間隔）。
 * 読み上げの途中でクリック／キー入力すると全文を即座に表示（早送り）し、
 * 読み上げが終わると画面下に点滅する「▼ クリックで つぎへ」の案内を出して、
 * クリック／タップまたは任意のキー（修飾キーなし）で次のスライドへ進める。
 * 表示から `LOCK_MS`（3 秒）が経つまでは送り操作を受け付けないロックも
 * あるが、現在は開発中の暫定として `IS_LOCK_DISABLED` で無効化している
 * （無効中も早送り→送りの二段階は生きている）。
 * 最後のスライドを送ると全体を黒へフェードアウトし、
 * `onFinish` を呼んで親（`App`）がマップ画面へ遷移する。
 *
 * 表示中は window の keydown を capture フェーズで横取りし、App の開発用
 * ショートカット（R/T/C）が誤発火しないようにする（どのキーも「送り」として
 * 扱う。Ctrl/Cmd/Alt 併用のブラウザ標準操作は素通し）。
 *
 * 文章の `漢字《ふりがな》` 記法は `tokenizeFurigana` でルビ付き表示に変換
 * する。スライド画像がまだ置かれていない（読み込みに失敗した）場合は、
 * 置くべきファイル名を示すプレースホルダー枠を代わりに表示する。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onFinish (function): 紙芝居を最後まで見終えたときに呼ぶ関数（引数なし）。
 *
 * Returns:
 *     JSX.Element: 紙芝居画面全体を表す `<section>` 要素。
 */
function StoryScreen({ onFinish }) {
  const [index, setIndex] = useState(0);
  const [canAdvance, setCanAdvance] = useState(IS_LOCK_DISABLED);
  const [isLeaving, setIsLeaving] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [visibleCount, setVisibleCount] = useState(0);

  /*
   * スライドが進んだら「送り可否」「画像読み込み失敗」「読み上げ位置」を
   * リセットする。
   * effect ではなくレンダー中の条件付き setState（React 公式の「prop/state
   * 変化で state を戻す」パターン）で行い、`set-state-in-effect` を避ける。
   */
  const [slideKey, setSlideKey] = useState(index);
  if (index !== slideKey) {
    setSlideKey(index);
    setCanAdvance(IS_LOCK_DISABLED);
    setImageFailed(false);
    setVisibleCount(0);
  }

  const slide = STORY_SLIDES[index];
  const tokens = useMemo(() => tokenizeFurigana(slide.text), [slide.text]);
  /* 読み上げが末尾まで終わったか。「つぎへ」案内はこの後にだけ出す。 */
  const isRevealed = visibleCount >= tokens.length;

  /*
   * 読み上げの開始待ち・進行中のタイマー ID。早送り時にレンダー外から
   * 止めるため ref に持つ。
   */
  const revealTimersRef = useRef({ delayId: null, intervalId: null });

  /* 全スライドの画像を最初にまとめて先読みし、切り替え時のちらつきを防ぐ。 */
  useEffect(() => {
    STORY_SLIDES.forEach(({ image }) => {
      const img = new Image();
      img.src = image;
    });
  }, []);

  /* スライドごとに `LOCK_MS` 経過してから送り操作を解禁する（ロック無効時は
   * 最初から解禁済みなのでタイマー不要）。 */
  useEffect(() => {
    if (IS_LOCK_DISABLED) {
      return undefined;
    }
    const timerId = setTimeout(() => setCanAdvance(true), LOCK_MS);
    return () => clearTimeout(timerId);
  }, [index]);

  /*
   * 読み上げアニメーション本体。スライドごとに `REVEAL_DELAY_MS` 待ってから
   * （絵のフェードインを先に見せる）、`REVEAL_INTERVAL_MS` 間隔で表示トークン
   * 数を 1 ずつ増やす。setState は setTimeout / setInterval コールバック内
   * （非同期）でのみ行うため、`set-state-in-effect` ルールには抵触しない。
   */
  useEffect(() => {
    if (tokens.length === 0) {
      return undefined;
    }
    const timers = revealTimersRef.current;
    timers.delayId = setTimeout(() => {
      let count = 0;
      timers.intervalId = setInterval(() => {
        count += 1;
        setVisibleCount(count);
        if (count >= tokens.length) {
          clearInterval(timers.intervalId);
        }
      }, REVEAL_INTERVAL_MS);
    }, REVEAL_DELAY_MS);
    return () => {
      clearTimeout(timers.delayId);
      clearInterval(timers.intervalId);
    };
  }, [index, tokens]);

  /* 最後のスライドを送ったら、フェードアウトを待って `onFinish` を呼ぶ。 */
  useEffect(() => {
    if (!isLeaving) {
      return undefined;
    }
    const timerId = setTimeout(() => onFinish(), FADE_OUT_MS);
    return () => clearTimeout(timerId);
  }, [isLeaving, onFinish]);

  /*
   * クリック／タップ／キー入力の共通ハンドラ。ロック中と退場中は無視する。
   * 読み上げの途中なら止めて全文を即表示（早送り）し、表示が完了していれば
   * 次のスライドへ、最後ならフェードアウト（`isLeaving`）を始める。
   */
  const handleAdvance = useCallback(() => {
    if (!canAdvance || isLeaving) {
      return;
    }
    if (visibleCount < tokens.length) {
      const timers = revealTimersRef.current;
      clearTimeout(timers.delayId);
      clearInterval(timers.intervalId);
      setVisibleCount(tokens.length);
      return;
    }
    if (index < STORY_SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      setIsLeaving(true);
    }
  }, [canAdvance, isLeaving, visibleCount, tokens.length, index]);

  /*
   * 紙芝居中はどのキーも「送り」として扱う。capture フェーズで横取りして
   * App の R/T/C ショートカット等に届く前に遮断する（`RoboBubble` と同じ
   * 方針）。修飾キー併用のブラウザ標準操作（リロード等）は妨げない。
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      /*
       * R（開発用の全リセット）は遮断せず App のハンドラへ通す。紙芝居の
       * 途中でも 1 枚目からやり直せるようにする（送りには使わない）。
       */
      if (event.code === 'KeyR') {
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

  /*
   * 全トークンを常に描画し、未表示分（tokenIndex >= visibleCount）は
   * `.hidden` で透明にする。場所を最初から確保するため、読み上げ中も
   * 文章の折り返し位置やレイアウトが変わらない（`RoboBubble` と同じ方針）。
   */
  const textNodes = tokens.map((token, tokenIndex) => {
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

  const slideClassName = [styles.slide, isLeaving && styles.leaving]
    .filter(Boolean)
    .join(' ');
  const imageFileName = slide.image.split('/').pop();

  return (
    <section
      className={styles.root}
      onClick={handleAdvance}
      role="button"
      tabIndex={0}
      aria-label="つぎへ"
    >
      <div key={index} className={slideClassName}>
        <div className={styles.imageArea}>
          {imageFailed ? (
            <div className={styles.placeholder}>{imageFileName}</div>
          ) : (
            <img
              className={styles.image}
              src={slide.image}
              alt=""
              draggable={false}
              onError={() => setImageFailed(true)}
            />
          )}
        </div>
        <p className={styles.text}>{textNodes}</p>
      </div>
      {canAdvance && isRevealed && !isLeaving && (
        <div className={styles.nextHint} aria-hidden="true">
          ▼ クリックで つぎへ
        </div>
      )}
    </section>
  );
}

export default StoryScreen;
