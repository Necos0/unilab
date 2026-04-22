import styles from './Hand.module.css';
import Card from './Card';

/**
 * 手札のカード群を横並びで描画するコンポーネント。
 *
 * `cards` プロパティで受け取った配列を左から順に `Card` で描画する。
 * 個別カードの見た目には関与せず、並び・間隔のレイアウトのみに責務を
 * 絞ることで、将来のドラッグ&ドロップ導入やカードデザイン変更を
 * `Card` / `Hand` 単位で閉じた変更として扱えるようにする。
 * 同一 `id` のカードが複数含まれ得るため、`key` には配列インデックスを
 * 使用する（本スペックでは並び替え機能を扱わないため問題にならない）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         cards (Array<object>): 手札のカード定義配列。各要素は
 *             `id` (string) と `power` (number) を含む。
 *
 * Returns:
 *     JSX.Element: 手札全体を表す要素。
 */
function Hand({ cards }) {
  return (
    <div className={styles.root}>
      {cards.map((card, index) => (
        <Card key={index} card={card} />
      ))}
    </div>
  );
}

export default Hand;
