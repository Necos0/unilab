import { useEffect, useRef, useState } from 'react';
import styles from './ScreenFadeTransition.module.css';

/* 今の画面を黒へ暗転させる時間（ms）。CSS の `.darken` と合わせる。 */
const DARKEN_MS = 500;

/* 画面を切り替えたあと、黒のまま保つ時間（ms）。切替先の画像の読み込みを待つ間。 */
const HOLD_MS = 200;

/* 切替先の画面を黒から明転させる時間（ms）。CSS の `.lighten` と合わせる。 */
const LIGHTEN_MS = 600;

/**
 * 画面どうしの切り替え（タイトル ⇄ マップ）に挟む黒フェード遷移オーバーレイ。
 *
 * `MapReturnTransition` と同じく 2 段階で進む:
 *   1. **暗転**：今の画面の上で黒オーバーレイを `DARKEN_MS` かけて不透明に
 *      する。真っ黒になった時点で `onMidpoint` を呼び、親に画面切替を依頼する。
 *   2. **明転**：`HOLD_MS` だけ黒のまま待ってから、切り替わった画面の上で
 *      `LIGHTEN_MS` かけて透明にし、完了後に `onEnd` を呼ぶ。
 *
 * オーバーレイは `position: fixed` の最上位 z-index で、遷移中のクリック
 * （ボタンの連打など）をブロックする。コールバックは ref に逃がして
 * effect の再実行なしに常に最新を呼ぶ。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onMidpoint (function): 暗転完了（画面が完全に黒）時に呼ばれる。
 *             親はこのタイミングで画面を切り替える。
 *         onEnd (function): 明転完了時に呼ばれる。親はこのタイミングで
 *             本コンポーネントをアンマウントする。
 *
 * Returns:
 *     JSX.Element: 画面切替用の黒フェードオーバーレイ要素。
 */
function ScreenFadeTransition({ onMidpoint, onEnd }) {
  const [phase, setPhase] = useState('darken');
  const onMidpointRef = useRef(onMidpoint);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onMidpointRef.current = onMidpoint;
    onEndRef.current = onEnd;
  }, [onMidpoint, onEnd]);

  useEffect(() => {
    let timerId = null;
    if (phase === 'darken') {
      timerId = setTimeout(() => {
        onMidpointRef.current?.();
        setPhase('hold');
      }, DARKEN_MS);
    } else if (phase === 'hold') {
      timerId = setTimeout(() => setPhase('lighten'), HOLD_MS);
    } else if (phase === 'lighten') {
      timerId = setTimeout(() => onEndRef.current?.(), LIGHTEN_MS);
    }
    return () => clearTimeout(timerId);
  }, [phase]);

  return (
    <div className={`${styles.overlay} ${styles[phase]}`} aria-hidden="true" />
  );
}

export default ScreenFadeTransition;
