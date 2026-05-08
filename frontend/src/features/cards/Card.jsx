import styles from './Card.module.css';

/**
 * 個別のカードを描画するコンポーネント。
 *
 * 通常カード（`attack` / `guard` / `heal` 等）は `card.id` から
 * `/cards/<id>.png` を解決してカード枠の画像を表示する。下段パネル領域に
 * `card.power` を数値としてオーバーレイ合成することで、同じ画像を異なる
 * 威力値で使い回せるようにする（`power` はステージ依存のパラメータとして
 * `stages.json` 側で定義される）。
 *
 * モンスターカード（`card.id === 'monster'`）の場合のみ、`<img>` 参照では
 * なく赤系グラデーション ＋ "MONSTER" ラベルの仮ビジュアル `<div>` を
 * 描画する。これはデザイン班から `monster.png` を受領するまでの一時的な
 * 措置で、本デザイン受領後はこの分岐ブロックを削除して通常の `<img>`
 * フローへ合流させる前提の作りになっている（`Card.module.css` の
 * `.monsterPlaceholder` / `.placeholderInner` / `.placeholderLabel`
 * もあわせて削除する）。`power` のオーバーレイは分岐の外にあり、両ケース
 * で共通で適用される。
 *
 * Args:
 *     props (object): React プロパティ。
 *         card (object): カード定義。`id` (string) と `power` (number)
 *             を含む。
 *
 * Returns:
 *     JSX.Element: カードを表す要素。
 */
function Card({ card }) {
  const src = `/cards/${card.id}.png`;
  const isMonsterPlaceholder = card.id === 'monster';

  return (
    <div className={`${styles.root} ${isMonsterPlaceholder ? styles.monsterPlaceholder : ''}`}>
      {isMonsterPlaceholder ? (
        <div className={styles.placeholderInner}>
          <span className={styles.placeholderLabel}>MONSTER</span>
        </div>
      ) : (
        <img
          className={styles.image}
          src={src}
          alt={card.id}
          draggable={false}
        />
      )}
      <span className={styles.power}>{card.power}</span>
    </div>
  );
}

export default Card;
