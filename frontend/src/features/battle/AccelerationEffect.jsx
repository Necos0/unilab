import styles from './AccelerationEffect.module.css';
import useBattleStore from '../../stores/battleStore';

/**
 * 無限ループ実行の加速に連動してフローチャート領域を光らせるエフェクト。
 *
 * 最終ボス第二形態（`battleStore.isSecondPhase`）の実行中、親
 * （`BattleScreen`）が `.flowchartArea` の内側にマウントする。
 * `battleStore.accelIntensity`（easeIn 済みの加速進行度 0〜1。フェーズ
 * 消化のたびに更新される）を購読し、次の 3 層を強度に応じて激しくする：
 *   - 縁の発光（vignette）: 内側に金〜赤の光。強度が上がるほど太く濃くなり、
 *     点滅（pulse）も速くなる
 *   - 光の帯（sweep）: 斜めの光がチャートの上を走り抜ける。強度が上がる
 *     ほど走る間隔が短くなる
 *   - 全体の色付け（tint）: 強度が上がるほどチャート全体がうっすら熱を
 *     帯びたように色付く
 * 実行中でない・強度 0（加速が始まっていない）・第二形態でないときは
 * 何も描画しない。強度・点滅間隔は CSS カスタムプロパティ
 * （`--accel-intensity` / `--accel-pulse-ms` / `--accel-sweep-ms`）でCSS へ
 * 渡し、見た目の調整は `AccelerationEffect.module.css` 側で完結させる。
 *
 * `pointer-events: none` の飾りレイヤーなので、実行中の他 UI（拡大トグル
 * など）の操作は妨げない。
 *
 * Returns:
 *     JSX.Element | null: 加速中はエフェクト層、それ以外は null。
 */
function AccelerationEffect() {
  const isExecuting = useBattleStore((s) => s.isExecuting);
  const isSecondPhase = useBattleStore((s) => s.isSecondPhase);
  const intensity = useBattleStore((s) => s.accelIntensity);

  if (!isExecuting || !isSecondPhase || intensity <= 0) {
    return null;
  }

  /* 強度が上がるほど点滅・光の帯を速くする（下限でクランプ） */
  const pulseMs = Math.max(140, Math.round(900 - 720 * intensity));
  const sweepMs = Math.max(260, Math.round(2000 - 1700 * intensity));
  const style = {
    '--accel-intensity': intensity,
    '--accel-pulse-ms': `${pulseMs}ms`,
    '--accel-sweep-ms': `${sweepMs}ms`,
  };

  return (
    <div className={styles.effect} style={style} aria-hidden="true">
      <div className={styles.tint} />
      <div className={styles.sweep} />
      <div className={styles.vignette} />
    </div>
  );
}

export default AccelerationEffect;
