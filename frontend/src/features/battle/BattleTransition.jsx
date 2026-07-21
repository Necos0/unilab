import { useEffect, useRef, useState } from 'react';
import styles from './BattleTransition.module.css';
import preloadBattleAssets from './preloadBattleAssets';
import isBossStage from './isBossStage';

const FLASH_MS = 360;
const IRIS_MS = 450;
/*
 * ボス戦（*-4）用のタイミング。赤いフラッシュを 3 回（160ms × 3）に増やし、
 * アイリスもゆっくり閉じて「ただごとではない」重さを出す。CSS 側の
 * `.flashLayerBoss` / `.irisHoleBoss` のアニメーション時間と合わせる。
 */
const BOSS_FLASH_MS = 480;
const BOSS_IRIS_MS = 650;
const FADE_OUT_MS = 350;

/**
 * マップ画面からバトル画面への遷移時に画面全体を覆うエンカウント演出オーバーレイ。
 *
 * ポケモン等のエンカウント演出を参考に、3 段階で進行する：
 *   1. **フラッシュ**：マップ画面の上で白い全画面フラッシュを 2 回明滅させ、
 *      「敵に遭遇した」ことを知らせる（`FLASH_MS`）。開始と同時に
 *      `preloadBattleAssets(targetStageId)` を起動し、敵スプライト・カード・
 *      フローチャートアイコン等のバトル画面アセットをネットワーク／デコード
 *      まで進める。
 *   2. **アイリスイン**：画面中央に向かって円形の視界が閉じていき、黒に
 *      塗り潰される（`IRIS_MS`）。中央へ吸い込まれるような暗転で「戦闘に
 *      引き込まれる」感覚を作る。実装は中央配置した円形要素（`.irisHole`）の
 *      幅・高さを 240vmax → 0 へアニメーションさせ、巨大な `box-shadow` の
 *      広がりで円の外側を黒く塗る方式（`clip-path` の反転円は CSS で表現
 *      できないため）。
 *   3. **フェードアウト**：フラッシュ＋アイリスの演出時間と「画像プリロード」の
 *      両方が完了したタイミングで `onMidpoint` を呼び親に画面切替を依頼し、
 *      入れ替わったバトル画面の上で黒オーバーレイを `FADE_OUT_MS` で透明化
 *      する。完了後に `onEnd` を呼んでオーバーレイ自体のアンマウントを促す。
 *
 * ボスステージ（`isBossStage`、各ワールドの *-4）への遷移では、フラッシュが
 * 白 2 回 → 赤 3 回（`BOSS_FLASH_MS`）になり、アイリスも遅く
 * （`BOSS_IRIS_MS`）閉じるボス専用の重い演出に切り替わる。
 *
 * 演出の最低時間とプリロード完了の遅い方に合わせるため、`Promise.all` で
 * 演出用タイマー（フラッシュ→アイリスの `setTimeout` 連鎖）とプリロード
 * Promise を待つ。これにより「画像読み込みが速くても演出を端折らない」
 * 「画像が遅いときは黒画面のまま待たせる」の両方を成立させる。プリロードが
 * 演出より遅い場合、アイリスは `forwards` で全閉（全黒）のまま静止する。
 *
 * オーバーレイは `position: fixed` で z-index を最上位に置き、`pointer-events`
 * を有効にして遷移中のクリックをブロックする。
 *
 * Args:
 *     props (object): React プロパティ。
 *         targetStageId (string): 遷移先のステージ ID。プリロード対象の解決に使う。
 *         onMidpoint (function): 演出＆プリロード完了時に呼ばれる。
 *             親はこのタイミングで `MapScreen` から `BattleScreen` に切り替える。
 *         onEnd (function): フェードアウト完了時に呼ばれる。親はこのタイミングで
 *             本コンポーネントをアンマウントする。
 *
 * Returns:
 *     JSX.Element: エンカウント演出用オーバーレイ要素。
 */
function BattleTransition({ targetStageId, onMidpoint, onEnd }) {
  const [phase, setPhase] = useState('flash');
  const onMidpointRef = useRef(onMidpoint);
  const onEndRef = useRef(onEnd);

  useEffect(() => {
    onMidpointRef.current = onMidpoint;
    onEndRef.current = onEnd;
  }, [onMidpoint, onEnd]);

  useEffect(() => {
    let cancelled = false;

    const isBoss = isBossStage(targetStageId);
    const flashMs = isBoss ? BOSS_FLASH_MS : FLASH_MS;
    const irisMs = isBoss ? BOSS_IRIS_MS : IRIS_MS;

    /* フラッシュ → アイリスの 2 段演出を setTimeout 連鎖で進め、
       アイリス全閉（画面が完全に黒になる）まで待つタイマー Promise */
    const encounterTimer = new Promise((resolve) => {
      setTimeout(() => {
        if (cancelled) return;
        setPhase('iris');
        setTimeout(resolve, irisMs);
      }, flashMs);
    });
    const preload = preloadBattleAssets(targetStageId);

    Promise.all([encounterTimer, preload]).then(() => {
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

  const isBoss = isBossStage(targetStageId);
  const className = [styles.overlay, styles[phase]].join(' ');
  return (
    <div className={className} aria-hidden="true">
      {phase === 'flash' && (
        <div
          className={
            isBoss
              ? `${styles.flashLayer} ${styles.flashLayerBoss}`
              : styles.flashLayer
          }
        />
      )}
      {phase === 'iris' && (
        <div
          className={
            isBoss ? `${styles.irisHole} ${styles.irisHoleBoss}` : styles.irisHole
          }
        />
      )}
    </div>
  );
}

export default BattleTransition;
