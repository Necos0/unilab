import { useEffect, useRef, useState } from 'react';
import styles from './BattleTransition.module.css';
import preloadBattleAssets from './preloadBattleAssets';

const FADE_IN_MS = 350;
const FADE_OUT_MS = 350;

/**
 * マップ画面からバトル画面への遷移時に画面全体を覆うフェードオーバーレイ。
 *
 * 演出は 2 段階で進行する：
 *   1. **フェードイン**：画面を黒で塗り潰す（`FADE_IN_MS`）。同時並行で
 *      `preloadBattleAssets(targetStageId)` を起動し、敵スプライト・カード・
 *      フローチャートアイコン等のバトル画面アセットをネットワーク／デコード
 *      まで進める。
 *   2. **フェードアウト**：フェードインと「画像プリロード」の両方が完了
 *      したタイミングで `onMidpoint` を呼び親に画面切替を依頼し、入れ替わった
 *      バトル画面の上で黒オーバーレイを `FADE_OUT_MS` で透明化する。完了後に
 *      `onEnd` を呼んでオーバーレイ自体のアンマウントを促す。
 *
 * 演出の最低時間とプリロード完了の遅い方に合わせるため、`Promise.all` で
 * フェードイン用タイマー（`setTimeout`）とプリロード Promise を待つ。
 * これにより「画像読み込みが速くてもフェード演出を端折らない」「画像が遅い
 * ときはオーバーレイのまま待たせる」の両方を成立させる。
 *
 * オーバーレイは `position: fixed` で z-index を最上位に置き、`pointer-events`
 * を有効にして遷移中のクリックをブロックする。
 *
 * Args:
 *     props (object): React プロパティ。
 *         targetStageId (string): 遷移先のステージ ID。プリロード対象の解決に使う。
 *         onMidpoint (function): フェードイン＆プリロード完了時に呼ばれる。
 *             親はこのタイミングで `MapScreen` から `BattleScreen` に切り替える。
 *         onEnd (function): フェードアウト完了時に呼ばれる。親はこのタイミングで
 *             本コンポーネントをアンマウントする。
 *
 * Returns:
 *     JSX.Element: フェード用オーバーレイ要素。
 */
function BattleTransition({ targetStageId, onMidpoint, onEnd }) {
  const [phase, setPhase] = useState('fadeIn');
  const onMidpointRef = useRef(onMidpoint);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onMidpointRef.current = onMidpoint;
    onEndRef.current = onEnd;
  }, [onMidpoint, onEnd]);

  useEffect(() => {
    let cancelled = false;

    const fadeInTimer = new Promise((resolve) => {
      setTimeout(resolve, FADE_IN_MS);
    });
    const preload = preloadBattleAssets(targetStageId);

    Promise.all([fadeInTimer, preload]).then(() => {
      if (cancelled) return;
      onMidpointRef.current?.();
      setPhase('fadeOut');
      setTimeout(() => {
        if (cancelled) return;
        onEndRef.current?.();
      }, FADE_OUT_MS);
    });

    return () => {
      cancelled = true;
    };
  }, [targetStageId]);

  const className = [styles.overlay, styles[phase]].join(' ');
  return <div className={className} aria-hidden="true" />;
}

export default BattleTransition;
