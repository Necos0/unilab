import useBattleStore from '../../../stores/battleStore';
import styles from './PlayerGuardFloater.module.css';

/**
 * 防御シールド付与時の数字を浮き上がらせる演出レイヤ。
 *
 * `battleStore.playerGuardEvents` 配列を購読し、各要素を `<span>` として
 * マップする。各 `<span>` は CSS の `@keyframes guardFloat` で上方向に
 * スライドしながらフェードアウトし、`onAnimationEnd` で
 * `dismissPlayerGuardEvent(id)` を呼んで自身を配列から取り除く
 * （自走 unmount）。これにより `playerGuardEvents` が累積し続けるのを
 * 防ぐ。
 *
 * 表示テキストは `+{e.amount}` 形式で、`amount` は `applyGuard` が
 * キューに積んだ **カードの `power`（× 倍率）値そのまま**（実際の
 * `guardShield` 増分ではない）。`applyGuard` は上書き式でシールドを
 * セットするため実増分は直感に合わず、「防御カードを通った事実とその
 * power 値」を出す方が一貫する（`PlayerHealFloater` と同じ思想）。
 *
 * このレイヤ自体は `position: absolute; inset: 0; pointer-events: none;`
 * でプレイヤー HP バーラッパー（`playerHpBox`）全体に重なる。
 * `pointer-events: none` により、下層の HP バー・GuardBar・数値ラベルや
 * 既存の `PlayerDamageFloater` / `PlayerHealFloater` との干渉を起こさない。
 * 親要素となる `playerHpBox` は `position: relative` を持つことを前提とし、
 * 絶対配置の基準として機能させる。
 *
 * 被弾用 `PlayerDamageFloater`・回復用 `PlayerHealFloater` と完全対称な
 * 責務を持つが、購読する store キーが `playerGuardEvents` に、削除アクション
 * が `dismissPlayerGuardEvent` に、文字色がガード青（`#4a8ef0`、`GuardBar`
 * のフィルや HP 数値のシールド色と同一）に置き換わる。
 *
 * Returns:
 *     JSX.Element: ガード数字を内包する絶対配置の div 要素。
 */
function PlayerGuardFloater() {
  const playerGuardEvents = useBattleStore((s) => s.playerGuardEvents);
  const dismiss = useBattleStore((s) => s.dismissPlayerGuardEvent);

  return (
    <div className={styles.layer}>
      {playerGuardEvents.map((e) => (
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

export default PlayerGuardFloater;