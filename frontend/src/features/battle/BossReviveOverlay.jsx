import styles from './BossReviveOverlay.module.css';

/**
 * ボス復活（第二形態突入）演出の全画面オーバーレイ。
 *
 * `battleStore.revivePhase` が非 null の間、親（`BattleScreen`）が条件付きで
 * マウントする。`phase` に応じて 3 つの見た目を切り替える：
 *   - `'dying'` : 完全に透明な入力ブロッカー。敵の dead アニメ再生中に
 *     プレイヤーがリセット・実行・カード操作をできないよう塞ぐだけ
 *   - `'flash'` : 白い層が REVIVE_FLASH_IN_MS（battleStore 側の定数）かけて
 *     フェードインし、画面全体を真っ白に覆う。真っ白の裏で第二形態への
 *     盤面差し替え（`initializeBattle`）が行われる
 *   - `'risen'` : 白い層が REVIVE_FADE_OUT_MS かけてフェードアウトし、
 *     差し替え済みの新しい盤面（HP9999・無限ループのフローチャート・
 *     ひっさつカード）が現れる
 *
 * アニメーション時間は `BossReviveOverlay.module.css` の `@keyframes` に
 * 持たせており、`battleStore` の REVIVE_* 定数と同期させる必要がある
 * （CSS 側を変えたら store 側も合わせること）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         phase (string): `battleStore.revivePhase` の現在値
 *             （`'dying' | 'flash' | 'risen'`）。
 *
 * Returns:
 *     JSX.Element: 画面全体を覆う復活演出オーバーレイ要素。
 */
function BossReviveOverlay({ phase }) {
  const phaseClass =
    phase === 'flash' ? styles.flash : phase === 'risen' ? styles.risen : styles.dying;
  return <div className={`${styles.overlay} ${phaseClass}`} aria-hidden="true" />;
}

export default BossReviveOverlay;
