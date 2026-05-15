import { useEffect, useRef, useState } from 'react';
import styles from './MapSwitchTransition.module.css';

const FADE_IN_MS = 300;
const FADE_OUT_MS = 300;

/**
 * マップ切替時に画面全体を黒で覆うフェードオーバーレイ。
 *
 * `BattleTransition` と同じ 2 段階構成。フェードインで画面を黒く塗り潰し、
 * 完了時に `onMidpoint` を呼んで親に `switchMap` を依頼する。新マップが
 * 描画された後でフェードアウトし、完了時に `onEnd` を呼ぶ。バトル遷移と
 * 違って事前ロードする画像が無い（マップ画像は `<img>` が即時要求し、
 * 1920x1080 1 枚なのでブラウザキャッシュで十分）ため、待つのはタイマー
 * のみでよい。
 *
 * オーバーレイは `position: fixed` で z-index を最上位に置き、
 * `pointer-events` を有効にして遷移中のクリックをブロックする。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onMidpoint (function): フェードイン完了時に呼ばれる。親はこの
 *             タイミングで `switchMap` を実行して新マップへ切り替える。
 *         onEnd (function): フェードアウト完了時に呼ばれる。親はこの
 *             タイミングで本コンポーネントをアンマウントする。
 *
 * Returns:
 *     JSX.Element: フェード用オーバーレイ要素。
 */
function MapSwitchTransition({ onMidpoint, onEnd }) {
  const [phase, setPhase] = useState('fadeIn');
  const onMidpointRef = useRef(onMidpoint);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onMidpointRef.current = onMidpoint;
    onEndRef.current = onEnd;
  }, [onMidpoint, onEnd]);

  useEffect(() => {
    let cancelled = false;

    const fadeInTimer = setTimeout(() => {
      if (cancelled) return;
      onMidpointRef.current?.();
      setPhase('fadeOut');
      const fadeOutTimer = setTimeout(() => {
        if (cancelled) return;
        onEndRef.current?.();
      }, FADE_OUT_MS);
      return () => clearTimeout(fadeOutTimer);
    }, FADE_IN_MS);

    return () => {
      cancelled = true;
      clearTimeout(fadeInTimer);
    };
  }, []);

  const className = [styles.overlay, styles[phase]].join(' ');
  return <div className={className} aria-hidden="true" />;
}

export default MapSwitchTransition;
