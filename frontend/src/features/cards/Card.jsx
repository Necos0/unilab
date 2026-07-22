import styles from './Card.module.css';

/**
 * 個別のカードを描画するコンポーネント。
 *
 * `card.id` から `/cards/<id>.<ext>` を解決してカード枠の画像を表示し、
 * 下段パネル領域に `card.power` を数値としてオーバーレイ合成する。これに
 * より、同じ画像を異なる威力値で使い回せる（`power` はステージ依存の
 * パラメータとして `stages.json` 側で定義される）。`monster` を含む全
 * カード ID で同じ描画フローを共有する。
 *
 * `card.power` は省略可能。`reflect` / `counter` のように威力値の概念を
 * 持たないカードでは `stages.json` 側で `power` を定義せず、
 * `<span>{undefined}</span>` を React が描画しない挙動を利用して、自然に
 * 数値が表示されない状態を実現する。`.power` は absolute 配置なので、
 * `<span>` の中身が空でも他のレイアウトには影響しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         card (object): カード定義。`id` (string) と、オプションで
 *             `power` (number) を含む。`power` が未定義のカードは
 *             数値表示なしで描画される。
 *
 * Returns:
 *     JSX.Element: カードを表す要素。
 */
function Card({ card }) {
  const src = `/cards/${card.id}.png`;

  return (
    <div className={styles.root}>
      <img
        className={styles.image}
        src={src}
        alt={card.id}
        draggable={false}
      />
      <span className={styles.power}>{card.power}</span>
    </div>
  );
}

export default Card;
