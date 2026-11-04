import useBattleStore from '../../../stores/battleStore';
import styles from '../player/PlayerGuardFloater.module.css';

/**
 * 敵がシールドを得たときの「+N」フロート（`PlayerGuardFloater` の敵側鏡）。
 *
 * `enemyGuardEvents`（`applyEnemyGuard` が push）を購読し、各要素を青系の浮き
 * 数字として描画する。`onAnimationEnd` で `dismissEnemyGuardEvent` を呼んで自走
 * unmount する。見た目はプレイヤー側の CSS モジュールをそのまま流用する。
 * ワールド5以降、敵が `monster_guard` を使うステージで `enemyHpBox` に重ねる。
 *
 * Returns:
 *     JSX.Element: 浮き数字レイヤー。
 */
function EnemyGuardFloater() {
  const enemyGuardEvents = useBattleStore((s) => s.enemyGuardEvents);
  const dismiss = useBattleStore((s) => s.dismissEnemyGuardEvent);

  return (
    <div className={styles.layer}>
      {enemyGuardEvents.map((e) => (
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

export default EnemyGuardFloater;
