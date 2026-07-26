import useBattleStore from '../../../stores/battleStore';
import styles from './SpeedToggleButton.module.css';

/**
 * 実行中のバトル演出を 2 倍速に切り替えるトグルボタン。
 *
 * `battleStore` の `speedMultiplier` を購読し、2 倍速中は `.active` を
 * 付与して点灯表示にする。クリックで `toggleSpeedMultiplier()` を呼び、
 * 実行中（`isExecuting`）以外は `disabled` にして押せなくする。
 *
 * ルート要素の `data-cutscene-point="speedButton"` はカットシーンの指差し
 * 誘導（`CutscenePointer`）の対象にするためのアンカー。2-1 入場時の
 * 倍速モードチュートリアル（cutscenes.json の `stage2-1-enter`）が参照する。
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
  );
}

export default SpeedToggleButton;