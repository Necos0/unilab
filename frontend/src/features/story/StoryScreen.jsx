import { useCallback, useEffect, useMemo, useState } from 'react';
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

/**
 * ゲーム冒頭のオープニング紙芝居画面。
 *
 * タイトル画面の「スタート」ボタン押下後に表示する。背景は黒一色で、画面
 * 上部に絵、下部に文章を置いたスライド（`data/story_slides.json`）を 1 枚
 * ずつ流す。
 * スライドが切り替わるたびに絵と文章は透明からゆっくりフェードインし
 * （文章は絵よりわずかに遅らせる）、表示から `LOCK_MS`（3 秒）が経つまでは
 * クリック・キー入力を受け付けない（ただし現在は開発中の暫定として
 * `IS_LOCK_DISABLED` でロックを無効化しており、すぐ送れる）。
 * 3 秒経つと画面下に点滅する「▼ クリックで
 * つぎへ」の案内を出し、クリック／タップまたは任意のキー（修飾キーなし）で
 * 次のスライドへ進める。最後のスライドを送ると全体を黒へフェードアウトし、
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

  /*
   * スライドが進んだら「送り可否」と「画像読み込み失敗」をリセットする。
   * effect ではなくレンダー中の条件付き setState（React 公式の「prop/state
   * 変化で state を戻す」パターン）で行い、`set-state-in-effect` を避ける。
   */
  const [slideKey, setSlideKey] = useState(index);
  if (index !== slideKey) {
    setSlideKey(index);
    setCanAdvance(IS_LOCK_DISABLED);
    setImageFailed(false);
  }

  const slide = STORY_SLIDES[index];
  const tokens = useMemo(() => tokenizeFurigana(slide.text), [slide.text]);

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

  /* 最後のスライドを送ったら、フェードアウトを待って `onFinish` を呼ぶ。 */
  useEffect(() => {
    if (!isLeaving) {
      return undefined;
    }
    const timerId = setTimeout(() => onFinish(), FADE_OUT_MS);
    return () => clearTimeout(timerId);
  }, [isLeaving, onFinish]);

  /*
   * クリック／タップ／キー入力の共通ハンドラ。ロック中と退場中は無視し、
   * 途中なら次のスライドへ、最後ならフェードアウト（`isLeaving`）を始める。
   */
  const handleAdvance = useCallback(() => {
    if (!canAdvance || isLeaving) {
      return;
    }
    if (index < STORY_SLIDES.length - 1) {
      setIndex(index + 1);
    } else {
      setIsLeaving(true);
    }
  }, [canAdvance, isLeaving, index]);

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
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) {
        handleAdvance();
      }
    };
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleAdvance]);

  const textNodes = tokens.map((token, tokenIndex) =>
    token.type === 'ruby' ? (
      <ruby key={tokenIndex}>
        {token.base}
        <rt>{token.ruby}</rt>
      </ruby>
    ) : (
      <span key={tokenIndex}>{token.value}</span>
    ),
  );

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
      {canAdvance && !isLeaving && (
        <div className={styles.nextHint} aria-hidden="true">
          ▼ クリックで つぎへ
        </div>
      )}
    </section>
  );
}

export default StoryScreen;
