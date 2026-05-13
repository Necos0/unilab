import useBattleStore from '../../../stores/battleStore';
import styles from './ReflectDamageFloater.module.css';

/**
 * 反射ダメージ数字を浮き上がらせる演出レイヤ。
 *
 * `battleStore.enemyReflectEvents` 配列を購読し、各要素を `<span>` として
 * マップする。各 `<span>` は CSS の `@keyframes reflectFloat` で上方向にスライド
 * しながらフェードアウトし、`onAnimationEnd` で `dismissEnemyReflectEvent(id)`
 * を呼んで自身を配列から取り除く（自走 unmount）。
 *
 * 既存の `DamageFloater`（通常攻撃ダメージ・赤系）と完全に独立した系統として
 * 動作する。両者は別キュー（`enemyDamageEvents` vs `enemyReflectEvents`）を
 * 購読し、別アニメーション（`damageFloat` vs `reflectFloat`）で描画される。
 * 反射成立時は `applyEnemyDamage` を経由せず `applyReflectDamage` 経由で
 * 敵 HP を減らすため、両系統が同時に発火することはない。フロートの色（赤
 * vs オレンジ）でプレイヤーは「通常攻撃」と「反射」を一目で区別できる
 * （`reflect-card-effect` 要件 7-1〜7-4）。
 *
 * このレイヤ自体は `position: absolute; inset: 0; pointer-events: none;` で
 * 敵エリア全体に重なる。`pointer-events: none` により、下層の `EnemySprite`
 * や `HpBar` のクリック・ホバー判定を奪わない。
 *
 * Returns:
 *     JSX.Element: 反射ダメージ数字を内包する絶対配置の div 要素。
 */
function ReflectDamageFloater() {
    const events = useBattleStore((s) => s.enemyReflectEvents);
    const dismiss = useBattleStore((s) => s.dismissEnemyReflectEvent);

    return (
        <div className={styles.layer}>
            {events.map((e) => (
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

export default ReflectDamageFloater;