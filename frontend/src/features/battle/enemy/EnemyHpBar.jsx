import styles from './EnemyHpBar.module.css';
import enemiesData from '../../../data/enemies.json';

/**
 * 敵の HP バーをピクセルアート調で描画するコンポーネント。
 *
 * `enemies.json` から `enemyId` に対応する `maxHp` を解決し、残量を
 * 黄色の塗りで、減った分を暗色の背景で表示する。`currentHp` が
 * 未指定の場合は満タン（`maxHp`）として描画する。枠は角丸を用いず
 * カクカクとした 2D 風の見た目にする。敵 ID が未定義または `maxHp`
 * が未設定の場合は `null` を返してレイアウトを崩さない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         enemyId (string): 敵識別子。
 *         currentHp (number): 現在 HP。省略時は `maxHp` と同値。
 *
 * Returns:
 *     JSX.Element | null: HP バー要素、または未定義時 null。
 */
function EnemyHpBar({ enemyId, currentHp }) {
  const enemy = enemiesData.enemies.find((e) => e.id === enemyId);
  const maxHp = enemy?.maxHp;

  if (maxHp == null) {
    return null;
  }

  const hp = currentHp ?? maxHp;
  const clampedHp = Math.max(0, Math.min(maxHp, hp));
  const ratio = maxHp > 0 ? clampedHp / maxHp : 0;

  return (
    <div className={styles.frame}>
      <div
        className={styles.fill}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}

export default EnemyHpBar;
