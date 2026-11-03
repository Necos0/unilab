import { useEffect, useRef, useState } from 'react';
import styles from './TheEndOverlay.module.css';

/* 画面に出すしめくくりの文字（ひらがなのみなので、ふりがなは不要）。 */
const THE_END_TEXT = 'おしまい';
const HINT_TEXT = 'タップで タイトルへ';

/*
 * 「おしまい」が出きって、タップ／Enter でタイトルへ戻れるようになるまでの
 * 時間（ms）。TheEndOverlay.module.css の暗転（1200ms）＋文字のフェード
 * （800ms 遅れで 1200ms）が終わるころに合わせる。
 */
const READY_MS = 2200;

/**
 * ステージ5の最後（5-4 の勇者を助けたあとの再会の会話のあと）に出す
 * 「おしまい」画面。
 *
 * カットシーン `map-stage5-reunion` の最後の `theEnd` step に進んだ間だけ、
 * 親（`MapScreen`）がマップの描画矩形を覆う層としてマウントする。画面が
 * ゆっくり黒くなり、中央に「おしまい」が浮かび上がる。出きったあと
 * （`READY_MS`）に下に「タップで タイトルへ」を出し、タップか Enter で
 * `onFinish` を 1 回だけ呼ぶ。親はそれを受けてカットシーンを終わらせ、
 * タイトル画面へ戻す。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onFinish (function): タイトルへ戻るときに呼ぶ関数（引数なし）。
 *
 * Returns:
 *     JSX.Element: 親の矩形全体を覆う「おしまい」画面。
 */
function TheEndOverlay({ onFinish }) {
  const [isReady, setIsReady] = useState(false);
  const isFinishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const timerId = setTimeout(() => setIsReady(true), READY_MS);
    return () => clearTimeout(timerId);
  }, []);

  /* 出きったあとの Enter でもタイトルへ戻れるようにする。 */
  useEffect(() => {
    if (!isReady) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Enter' && !isFinishedRef.current) {
        isFinishedRef.current = true;
        onFinishRef.current?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isReady]);

  const handleClick = () => {
    if (!isReady || isFinishedRef.current) return;
    isFinishedRef.current = true;
    onFinishRef.current?.();
  };

  return (
    <div
      className={styles.overlay}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={isReady ? HINT_TEXT : THE_END_TEXT}
    >
      <p className={styles.text}>{THE_END_TEXT}</p>
      {isReady && <p className={styles.hint}>{HINT_TEXT}</p>}
    </div>
  );
}

export default TheEndOverlay;
