import { useEffect, useRef } from 'react';
import styles from './MapPurifyOverlay.module.css';

/*
 * マップの絵が晴れた島へ切り替わりきるまでの時間（ms）。背景のクロス
 * フェード（MapBackground.module.css の `mapPurifyFadeIn`、3000ms）に
 * 余韻 400ms を足す。CSS 側を変えたらここも合わせること。
 */
const PURIFY_MS = 3400;

/**
 * 5-4 クリア後、マップ5の魔気が晴れていく演出の前景層（カットシーン
 * `map-stage5-reunion` の `purifyMap` step）。
 *
 * 背景そのもののクロスフェード（紫の島 → 晴れた島）は `MapBackground` が
 * 受け持ち、この層はその上に「光が広がる」ような白いかがやきを重ねて、
 * 魔気が消えていく感じを足す。親（`MapScreen`）が step の間だけマウントし、
 * `PURIFY_MS` 後に `onEnd` を 1 回だけ呼ぶ。親はそれを受けてカットシーンを
 * 次の吹き出し（「魔気が なくなっていく…！」）へ進める。演出中は全面層で
 * 下のマップ操作をブロックする。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onEnd (function): 演出完了時に呼ぶ関数（引数なし）。
 *
 * Returns:
 *     JSX.Element: 親の矩形全体を覆う演出層。
 */
function MapPurifyOverlay({ onEnd }) {
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    const timerId = setTimeout(() => onEndRef.current?.(), PURIFY_MS);
    return () => clearTimeout(timerId);
  }, []);

  return (
    <div className={styles.overlay} aria-hidden="true">
      <div className={styles.glow} />
    </div>
  );
}

export default MapPurifyOverlay;
