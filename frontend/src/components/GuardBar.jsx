import styles from './GuardBar.module.css';

/**
 * 汎用のガードバーコンポーネント。
 *
 * `HpBar` と縦に並べる前提の独立した水平バー。ピクセルアート調の白枠と
 * 暗色背景で「器」を、青色のフィルで「ガード残量」を表示する。`current` は
 * 0 〜 `max` にクランプされ、`clampedCurrent / max` の比率で `.fill` の幅が
 * 決まる。`max` が未指定または 0 以下の場合は `null` を返してレイアウトを
 * 崩さない（`HpBar` と同じガード規約）。
 *
 * 外側を `.row`（flex）でラップし、左に盾の SVG アイコン（青色、`<rect>`
 * 5 段の heater shield 形状、`shape-rendering: crispEdges`）、右に `.frame`
 * を並べる。アイコンは props ではなく内部固定で、`GuardBar` を呼ぶ側からは
 * 「これはガードを示すバーだ」という意味付けがアイコン込みで完結する。
 *
 * `current === 0` のときも `.frame` を必ず描画する（`guard-bar-redesign`
 * 要件 1-5）。`.fill` の `width: 0%` で塗りなしになるだけで、外枠と左の盾
 * アイコンは戦闘開始直後（ガード未獲得）から常時表示される。Fortnite の
 * シールドバーが「空の状態でも常に見える」UX に倣う設計。
 *
 * `.fill` の `box-shadow: 0 0 6px rgba(120, 180, 255, 0.5)` は旧 `HpBar.shield`
 * のグロー演出をそのまま流用したもの。`HpBar` 側の緑 `.fill` にはグローが
 * 付かないため、視覚的に「ガード = 光るシールド」「HP = フラットな生命」の
 * 違いが伝わる。
 *
 * `.frame` の寸法・色・トランジションは `HpBar.module.css` と完全に揃える。
 * 共通化せず独立 CSS にしている理由は `design.md` の「決定 1」参照。両者を
 * 縦に並べたとき幅・高さ・透過挙動が揃うよう、値の同期は実装レビューで担保。
 *
 * `transition: width 0.25s ease-out` は `HpBar` の `.fill` と同じ持続時間。
 * `battleStore.consumeShieldOnDamage` の `GUARD_TO_HP_DELAY_MS = 250` と
 * 揃えることで、「青バーが完全に縮みきってから緑バーが動き出す」段階
 * アニメーションが成立する（要件 4-5/4-6）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         current (number): 現在ガード残量。0 以上を想定。内部で
 *             `Math.max(0, Math.min(max, ...))` でクランプする。
 *         max (number): ガードの最大値。`maxPlayerHp` を渡す想定（要件 2）。
 *             0 以下や未指定なら `null` を返す。
 *
 * Returns:
 *     JSX.Element | null: ガードバー要素、または無効な入力時 null。
 */
function GuardBar({ current, max }) {
  if (max == null || max <= 0) {
    return null;
  }

  const clampedCurrent = Math.max(0, Math.min(max, current));
  const ratio = clampedCurrent / max;

  return (
    <div className={styles.row}>
      <svg
        viewBox="0 0 14 14"
        className={styles.icon}
        shapeRendering="crispEdges"
      >
        <rect x="3" y="2" width="8" height="2" fill="#4a8ef0" />
        <rect x="2" y="4" width="10" height="6" fill="#4a8ef0" />
        <rect x="3" y="10" width="8" height="1" fill="#4a8ef0" />
        <rect x="4" y="11" width="6" height="1" fill="#4a8ef0" />
        <rect x="5" y="12" width="4" height="1" fill="#4a8ef0" />
      </svg>
      <div className={styles.frame}>
        <div
          className={styles.fill}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export default GuardBar;
