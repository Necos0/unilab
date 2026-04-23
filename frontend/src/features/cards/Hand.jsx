import styles from './Hand.module.css';
import DraggableCard from './DraggableCard';
import useBattleStore, { HAND } from '../../stores/battleStore';

/**
 * 手札のカード群を横並びで描画するコンポーネント。
 *
 * `battleStore` の `handCards` を購読し、左から順に `DraggableCard` で
 * 描画する。個別カードの見た目・ドラッグ挙動には関与せず、並び・間隔の
 * レイアウトのみに責務を絞る。同一 `id` のカードが複数含まれる場合でも、
 * 各カードは一意な `instanceId` を持つためキー衝突は発生しない。
 *
 * Returns:
 *     JSX.Element: 手札全体を表す要素。
 */
function Hand() {
  const handCards = useBattleStore((s) => s.handCards);

  return (
    <div className={styles.root}>
      {handCards.map((card) => (
        <DraggableCard key={card.instanceId} card={card} source={HAND} />
      ))}
    </div>
  );
}

export default Hand;
