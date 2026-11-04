import { useLayoutEffect, useRef, useState } from 'react';
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
 * **行幅に収まらない時だけ縮小**（手札が多いステージ対策）：カードは原寸
 * （行の高さ基準・2:3）で並べ、行の自然幅（`row.offsetWidth`）が利用可能幅
 * （`root.clientWidth`）を超えるときだけ、行全体を `transform: scale` で
 * 比率を保って縮小する（`transform-origin: 右中央` で右寄せを維持）。
 * `ResizeObserver` で親のリサイズに追従し、手札枚数の変化（配置・リセット）
 * では `handCards.length` 依存で測り直す。原寸で収まる少数枚のステージでは
 * `scale = 1` のまま一切縮まない。`transform` はレイアウト幅を変えない（純
 * 視覚）ので、再測定で自然幅がブレず無限ループしない。
 *
 * Returns:
 *     JSX.Element: 手札全体を表す要素。
 */
function Hand() {
  const handCards = useBattleStore((s) => s.handCards);
  const rootRef = useRef(null);
  const rowRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const row = rowRef.current;
    if (!root || !row) return undefined;
    const measure = () => {
      const avail = root.clientWidth;
      const natural = row.offsetWidth;
      setScale(natural > avail && natural > 0 ? avail / natural : 1);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [handCards.length]);

  return (
    <div className={styles.root} ref={rootRef}>
      <div
        className={styles.row}
        ref={rowRef}
        style={
          scale < 1
            ? { transform: `scale(${scale})`, transformOrigin: 'right center' }
            : undefined
        }
      >
        {handCards.map((card) => (
          <DraggableCard key={card.instanceId} card={card} source={HAND} />
        ))}
      </div>
    </div>
  );
}

export default Hand;
