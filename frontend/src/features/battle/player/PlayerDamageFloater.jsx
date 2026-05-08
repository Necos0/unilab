import useBattleStore from '../../../stores/battleStore';
import styles from './PlayerDamageFloater.module.css';

/**
 * プレイヤー被弾時のダメージ数字を浮き上がらせる演出レイヤ。
 *
 * `battleStore.playerDamageEvents` 配列を購読し、各要素を `<span>` として
 * マップする。各 `<span>` は CSS の `@keyframes damageFloat` で上方向に
 * スライドしながらフェードアウトし、`onAnimationEnd` で
 * `dismissPlayerDamageEvent(id)` を呼んで自身を配列から取り除く
 * （自走 unmount）。これにより `playerDamageEvents` が累積し続けるのを
 * 防ぐ。
 *
 * このレイヤ自体は `position: absolute; inset: 0; pointer-events: none;`
 * でプレイヤー HP バーラッパー（`playerHpBox`）全体に重なる。
 * `pointer-events: none` により、下層の HP バー・数値ラベルのクリック・
 * ホバー判定を奪わない。親要素となる `playerHpBox` は `position: relative`
 * を持つことを前提とし、絶対配置の基準として機能させる。
 *
 * 同時に複数のダメージ数字が出る場合（連続ヒット）も、各 `<span>` は
 * 独立した DOM ノード・独立したアニメーションなので互いに干渉しない
 * （monster-attack 要件 7-4）。
 *
 * 敵側 `DamageFloater` と完全対称な責務を持つが、購読する store キーが
 * `enemyDamageEvents` → `playerDamageEvents` に、削除アクションが
 * `dismissEnemyDamageEvent` → `dismissPlayerDamageEvent` に置き換わる。
 *
 * Returns:
 *     JSX.Element: ダメージ数字を内包する絶対配置の div 要素。
 */
function PlayerDamageFloater() {
    const playerDamageEvents = useBattleStore((s) => s.playerDamageEvents);
    const dismiss = useBattleStore((s) => s.dismissPlayerDamageEvent);

    return (
        <div className={styles.layer}>
            {playerDamageEvents.map((e) => (
                <span
                    key={e.id}
                    className={styles.number}
                    onAnimationEnd={() => dismiss(e.id)}
                >
                    -{e.amount}
                </span>
            ))}
        </div>
    );
}

export default PlayerDamageFloater;