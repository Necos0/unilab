import useBattleStore from '../../../stores/battleStore';
import styles from './SpeedToggleButton.module.css';

/**
 * 実行中のバトル演出を 2 倍速に切り替えるトグルボタン。
 *
 * `battleStore` の `speedMultiplier` を購読し、2 倍速中は `.active` を
 * 付与してボタンを点灯表示にし、さらにボタン直下に「×2」バッジ（`.badge`、
 * 明滅）を出す。これにより、実行アニメのハイライトを追わなくても「今 ×2 で
 * 動いている」ことがひと目で分かる。クリックで `toggleSpeedMultiplier()` を
 * 呼び、実行中（`isExecuting`）以外は `disabled` にして押せなくする。
 *
 * ボタンとバッジは位置基準の `.wrap`（relative）で包む。バッジは絶対配置
 * なのでレイアウトを押し広げない。`data-cutscene-point="speedButton"` は
 * 従来どおりボタン側に付け、カットシーンの指差し誘導（`CutscenePointer`）の
 * 対象にする。2-1 入場時の倍速モードチュートリアル（cutscenes.json の
 * `stage2-1-enter`）が参照する。
 *
 * Returns:
 *     JSX.Element: トグルボタン要素。
 */
function SpeedToggleButton() {
  const isExecuting = useBattleStore((s) => s.isExecuting);
  const speedMultiplier = useBattleStore((s) => s.speedMultiplier);
  const toggleSpeedMultiplier = useBattleStore((s) => s.toggleSpeedMultiplier);

  const isFast = speedMultiplier !== 1;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={isFast ? `${styles.button} ${styles.active}` : styles.button}
        onClick={toggleSpeedMultiplier}
        disabled={!isExecuting}
        aria-label="2倍速切替"
        aria-pressed={isFast}
        data-cutscene-point="speedButton"
      >
        &gt;&gt;
      </button>
      {/* 倍速中は「今 ×2 で動いている」ことがひと目で分かるよう、ボタンの
          すぐ下にバッジを出す（実行アニメのハイライトを追わなくても分かる）。 */}
      {isFast && (
        <span className={styles.badge} aria-hidden="true">
          ×2
        </span>
      )}
    </div>
  );
}

export default SpeedToggleButton;