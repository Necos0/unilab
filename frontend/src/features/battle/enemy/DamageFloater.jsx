import useBattleStore from '../../../stores/battleStore';
import styles from './DamageFloater.module.css';

/**             
 * 攻撃ヒット時のダメージ数字を浮き上がらせる演出レイヤ。
 *                                                                            
 * `battleStore.damageEvents` 配列を購読し、各要素を `<span>` として
 * マップする。各 `<span>` は CSS の `@keyframes damageFloat` で              
 * 上方向にスライドしながらフェードアウトし、`onAnimationEnd` で              
 * `dismissDamageEvent(id)` を呼んで自身を配列から取り除く（自走 unmount）。  
 *                                                                            
 * このレイヤ自体は `position: absolute; inset: 0; pointer-events: none;`     
 * で敵エリア全体に重なる。`pointer-events: none` により、下層の              
 * EnemySprite や HpBar のクリック・ホバー判定を奪わない。                    
 *                                                                            
 * 同時に複数のダメージ数字が出る場合（連続ヒット）も、各 `<span>` は         
 * 独立した DOM ノード・独立したアニメーションなので互いに干渉しない。        
 *                                                                            
 * Returns:                                                                   
 *     JSX.Element: ダメージ数字を内包する絶対配置の div 要素。               
 */
function DamageFloater() {
    const damageEvents = useBattleStore((s) => s.damageEvents);
    const dismiss = useBattleStore((s) => s.dismissDamageEvent);

    return (
        <div className={styles.layer}>
            {damageEvents.map((e) => (
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

export default DamageFloater;