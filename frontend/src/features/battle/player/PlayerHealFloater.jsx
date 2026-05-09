import useBattleStore from '../../../stores/battleStore';
import styles from './PlayerHealFloater.module.css';

/**
 * プレイヤー HP 回復時の数字を浮き上がらせる演出レイヤ。
 *
 * `battleStore.playerHealEvents` 配列を購読し、各要素を `<span>` として
 * マップする。各 `<span>` は CSS の `@keyframes healFloat` で上方向に
 * スライドしながらフェードアウトし、`onAnimationEnd` で
 * `dismissPlayerHealEvent(id)` を呼んで自身を配列から取り除く
 * （自走 unmount）。これにより `playerHealEvents` が累積し続けるのを
 * 防ぐ。
 *
 * 表示テキストは `+{e.amount}` 形式で、`amount` は `applyPlayerHeal` が
 * キューに積んだ **カードの `power` 値そのまま**（実際の HP 増加量ではない）。
 * これにより、HP が満タンで実 HP が動かないケースでも「heal カードを
 * 通った事実とそのカードの power 値」を視覚化できる（heal-card 要件 4-4）。
 *
 * このレイヤ自体は `position: absolute; inset: 0; pointer-events: none;`
 * でプレイヤー HP バーラッパー（`playerHpBox`）全体に重なる。
 * `pointer-events: none` により、下層の HP バー・数値ラベル・既存の
 * `PlayerDamageFloater` との干渉を起こさない。親要素となる `playerHpBox`
 * は `position: relative` を持つことを前提とし、絶対配置の基準として
 * 機能させる。
 *
 * 同時に複数の回復数字が出る場合（連続ヒール）も、各 `<span>` は
 * 独立した DOM ノード・独立したアニメーションなので互いに干渉しない
 * （heal-card 要件 4-5）。
 *
 * 被弾用の `PlayerDamageFloater` と完全対称な責務を持つが、購読する
 * store キーが `playerDamageEvents` → `playerHealEvents` に、削除アクション
 * が `dismissPlayerDamageEvent` → `dismissPlayerHealEvent` に、表示記号
 * が `-` → `+` に、文字色が赤系（`#ff5d5d`）→ 緑系（`#7dff7d`）に
 * 置き換わる。
 *
 * Returns:
 *     JSX.Element: 回復数字を内包する絶対配置の div 要素。
 */
function PlayerHealFloater() {
    const playerHealEvents = useBattleStore((s) => s.playerHealEvents);
    const dismiss = useBattleStore((s) => s.dismissPlayerHealEvent);

    return (
        <div className={styles.layer}>
            {playerHealEvents.map((e) => (
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

export default PlayerHealFloater;