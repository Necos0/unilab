import useBattleStore from '../../../stores/battleStore';
import styles from '../player/PlayerHealFloater.module.css';

/**
 * 敵が回復したときの「+N」フロート（`PlayerHealFloater` の敵側鏡）。
 *
 * `enemyHealEvents`（`applyEnemyHeal` が push）を購読し、各要素を緑系の浮き
 * 数字として描画する。`onAnimationEnd` で `dismissEnemyHealEvent` を呼んで自走
 * unmount する。見た目はプレイヤー側の CSS モジュールをそのまま流用する。
 * ワールド5以降、敵が `monster_heal` を使うステージで `enemyHpBox` に重ねる。
 *
 * Returns:
 *     JSX.Element: 浮き数字レイヤー。
 */
function EnemyHealFloater() {
  const enemyHealEvents = useBattleStore((s) => s.enemyHealEvents);
  const dismiss = useBattleStore((s) => s.dismissEnemyHealEvent);

  return (
    <div className={styles.layer}>
      {enemyHealEvents.map((e) => (
        <span
          key={e.id}
          className={styles.number}
          onAnimationEnd={() => dismiss(e.id)}
        >
          +{e.amount}
        </span>
      ))}
    </div>
  );
}

export default EnemyHealFloater;
