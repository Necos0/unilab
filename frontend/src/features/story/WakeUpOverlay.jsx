import { useEffect, useRef, useState } from 'react';
import styles from './WakeUpOverlay.module.css';

/*
 * 画面を真っ黒のまま保つ時間（ms）。紙芝居の最後のフェードアウトから
 * 連続した「気絶している」間として見せる。
 */
const HOLD_MS = 2000;

/*
 * 目覚めのフェード（黒 → 平原）にかける時間（ms）。CSS 側の
 * `wakeUpBlink` の長さと合わせる。
 */
const FADE_MS = 5000;

/**
 * 紙芝居後の「目覚め」演出オーバーレイ。
 *
 * オープニング紙芝居（`StoryScreen`）を見終えてマップ画面（平原）へ移った
 * 直後に、画面全体を覆う黒いオーバーレイとして重ねる。気絶した相棒が
 * ゆっくり目を覚ます演出として、次の 2 段階で動く:
 *
 *   1. `HOLD_MS`（2 秒）の間、真っ黒のまま保つ（気絶中。裏では平原の
 *      マップが描画済みで、画像の読み込みも進む）。
 *   2. `wakeUpBlink` アニメーションで黒をゆっくり晴らす。途中で一度
 *      まぶたを閉じかけるように暗さが戻り（まばたき）、最後に完全に
 *      開いて平原が現れる。完了したら `onEnd` を呼ぶ。
 *
 * オーバーレイは `MapSwitchTransition` と同じく `position: fixed` ＋
 * 最上位 z-index で全面を覆い、演出中のポインタ操作をブロックする。演出は
 * スキップ不可で、クリックしても何も起きない。キー入力（Enter による会話
 * 送り）の遮断は `cutsceneStore.isInputLocked` が担い、`App` が演出の
 * 開始で立てて `onEnd` で解除する（`RoboBubble` 側が参照して無視する）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onEnd (function): 演出が終わったときに呼ぶ関数（引数なし）。
 *             親（`App`）はこのタイミングで本コンポーネントを外す。
 *
 * Returns:
 *     JSX.Element: 目覚め演出用の黒オーバーレイ要素。
 */
function WakeUpOverlay({ onEnd }) {
  const [isFading, setIsFading] = useState(false);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    const holdTimer = setTimeout(() => setIsFading(true), HOLD_MS);
    const endTimer = setTimeout(() => onEndRef.current?.(), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(holdTimer);
      clearTimeout(endTimer);
    };
  }, []);

  const className = [styles.overlay, isFading && styles.fading]
    .filter(Boolean)
    .join(' ');
  return <div className={className} aria-hidden="true" />;
}

export default WakeUpOverlay;
