import useBattleStore from '../../../stores/battleStore';
import styles from './ResetButton.module.css';

/**
 * フローチャート上のカード配置をリセットするボタン。
 *
 * クリックするとストアの `initializeBattle(stage)` を再実行し、手札を
 * `stages.json` の初期順序に戻しつつ全スロットを空にする。スロットが
 * 既に全て空であっても冪等な no-op として成立する（要件7-4）。
 *
 * 配置は `BattleScreen` 側で `flowchartArea` を `position: relative` に
 * したうえで、本ボタンを絶対位置で右上に固定する（要件7-5）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         stage (object): `stages.json` の 1 ステージ分。`cards` と `slots` を
 *             持ち、`initializeBattle` の再実行に必要。
 *
 * Returns:
 *     JSX.Element: ボタン要素。
 */
function ResetButton({ stage }) {
  const initializeBattle = useBattleStore((s) => s.initializeBattle);

  const handleClick = () => {
    initializeBattle(stage);
  };

  return (
    <button type="button" className={styles.button} onClick={handleClick}>
      リセット
    </button>
  );
}

export default ResetButton;
