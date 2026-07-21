import styles from './EncounterBanner.module.css';

/**
 * バトル入場演出で敵の出現を知らせるバナー。
 *
 * 敵スプライトのスライドイン完了後、`BattleScreen` の入場フェーズ
 * （`introPhase === 'banner'`）の間だけ敵エリアの下端に絶対配置で
 * マウントされる。縦位置はこのフェーズ中まだ透明な敵 HP バーのあたり
 * ＝スプライトの真下で、敵スプライト本体と被らないようにする。
 * 「〇〇が あらわれた!」の 1 行テキストを、横帯の上でポップイン →
 * 静止 → フェードアウトの CSS アニメーションで表示する（タイミングは
 * `EncounterBanner.module.css` 側のアニメーション定義と、`BattleScreen`
 * 側のフェーズ時間で同期させる）。
 *
 * 敵名は `enemies.json` の `displayName` をそのまま使う。現状すべて
 * カタカナ表記のため、ふりがな（ルビ）は不要（漢字入りの敵名を追加する
 * 場合は `tokenizeFurigana` の導入を検討すること）。
 *
 * ボスステージ（`isBoss`）では文言が「ボスの 〇〇が あらわれた!!」に
 * 変わり、赤基調・大きめの文字・赤いグロー明滅つきのボス版スタイル
 * （`.bannerBoss`）で、通常より長い時間（2400ms）表示される。
 *
 * Args:
 *     props (object): React プロパティ。
 *         enemyName (string): 表示する敵の名前（例: "スライム"）。
 *         isBoss (boolean): ボスステージなら true。既定は false。
 *
 * Returns:
 *     JSX.Element: 敵エリアに絶対配置されるバナー要素。
 */
function EncounterBanner({ enemyName, isBoss = false }) {
  const className = isBoss
    ? `${styles.banner} ${styles.bannerBoss}`
    : styles.banner;
  const message = isBoss
    ? `ボスの ${enemyName}が あらわれた!!`
    : `${enemyName}が あらわれた!`;
  return (
    <div className={className} role="status">
      <span className={styles.text}>{message}</span>
    </div>
  );
}

export default EncounterBanner;
