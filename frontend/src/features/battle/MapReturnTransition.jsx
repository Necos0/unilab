import { useEffect, useRef, useState } from 'react';
import styles from './MapReturnTransition.module.css';

const DARKEN_MS = 300;
const LIGHTEN_MS = 350;

/**
 * バトル画面からマップ画面へ戻るときの黒フェード遷移オーバーレイ。
 *
 * エンカウント演出（`BattleTransition`）の逆方向にあたる演出で、2 段階で
 * 進行する：
 *   1. **暗転**：バトル画面の上で黒オーバーレイを `DARKEN_MS` かけて
 *      不透明にする。真っ黒になった時点で `onMidpoint` を呼び、親に
 *      画面切替（バトル → マップ）とクリア記録などの退出処理を依頼する
 *   2. **明転**：入れ替わったマップ画面の上で黒オーバーレイを
 *      `LIGHTEN_MS` かけて透明化し、完了後に `onEnd` を呼んで
 *      オーバーレイ自体のアンマウントを促す
 *
 * エンカウント側と違いプリロード待ちが無いため、タイマーだけの単純な
 * setTimeout 連鎖で進める。オーバーレイは `position: fixed` の最上位
 * z-index で、遷移中のクリックをブロックする。コールバックは ref に
 * 逃がして effect の再実行なしに常に最新を呼ぶ（`BattleTransition` と
 * 同じパターン）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onMidpoint (function): 暗転完了（画面が完全に黒）時に呼ばれる。
 *             親はこのタイミングで `BattleScreen` から `MapScreen` に
 *             切り替え、クリア記録などの退出処理を実行する。
 *         onEnd (function): 明転完了時に呼ばれる。親はこのタイミングで
 *             本コンポーネントをアンマウントする。
 *
 * Returns:
 *     JSX.Element: マップ帰還演出用オーバーレイ要素。
 */
function MapReturnTransition({ onMidpoint, onEnd }) {
  const [phase, setPhase] = useState('darken');
  const onMidpointRef = useRef(onMidpoint);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onMidpointRef.current = onMidpoint;
    onEndRef.current = onEnd;
  }, [onMidpoint, onEnd]);

  useEffect(() => {
    let cancelled = false;
    const darkenTimer = setTimeout(() => {
      if (cancelled) return;
      onMidpointRef.current?.();
      setPhase('lighten');
      setTimeout(() => {
        if (cancelled) return;
        onEndRef.current?.();
      }, LIGHTEN_MS);
    }, DARKEN_MS);
    return () => {
      cancelled = true;
      clearTimeout(darkenTimer);
    };
  }, []);

  return (
    <div className={`${styles.overlay} ${styles[phase]}`} aria-hidden="true" />
  );
}

export default MapReturnTransition;
