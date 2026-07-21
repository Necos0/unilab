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
 * Args:
 *     props (object): React プロパティ。
 *         enemyName (string): 表示する敵の名前（例: "スライム"）。
 *
 * Returns:
 *     JSX.Element: 敵エリアに絶対配置されるバナー要素。
 */
function EncounterBanner({ enemyName }) {
  return (
    <div className={styles.banner} role="status">
      <span className={styles.text}>{enemyName}が あらわれた!</span>
    </div>
  );
}

export default EncounterBanner;
