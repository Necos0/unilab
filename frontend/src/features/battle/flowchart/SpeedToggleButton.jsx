import useBattleStore from '../../../stores/battleStore';
import styles from './SpeedToggleButton.module.css';

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
    >
      &gt;&gt;
    </button>
  );
}

export default SpeedToggleButton;