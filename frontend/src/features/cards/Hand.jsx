import { useLayoutEffect, useRef, useState } from 'react';
import styles from './Hand.module.css';
import DraggableCard from './DraggableCard';
import useBattleStore, { HAND } from '../../stores/battleStore';

/* カードの縦横比（幅 2 : 高さ 3）。`Card.module.css` の 120×180 と一致させる。 */
const CARD_ASPECT_WIDTH = 2;
const CARD_ASPECT_HEIGHT = 3;

/**
 * 手札のカード群を横並びで描画するコンポーネント。
 *
 * `battleStore` の `handCards` を購読し、左から順に `DraggableCard` で
 * 描画する。個別カードの見た目・ドラッグ挙動には関与せず、並び・間隔の
 * レイアウトのみに責務を絞る。同一 `id` のカードが複数含まれる場合でも、
 * 各カードは一意な `instanceId` を持つためキー衝突は発生しない。
 *
 * **カードの寸法は px で明示する**：カードは「行の高さいっぱい・2:3」で
 * 並べるが、これを CSS の `height: 100%` + `aspect-ratio` だけに任せると、
 * 古い iPad の WebKit が行（`.row`）の幅を見積もる段階で「高さ 100%」を解決
 * できず、カード幅を 0 とみなして行の幅が 0 になる。すると右寄せの行から
 * カードが右へはみ出し、`overflow: hidden` に切り取られて手札が 1 枚も
 * 見えなくなる（チュートリアルが進められなくなる不具合があった）。
 * これを避けるため、手札エリアの実寸（`root.clientHeight`）を測り、カードの
 * 高さ・幅を CSS 変数（`--hand-card-height` / `--hand-card-width`）で px 指定
 * する。行の幅がブラウザの見積もりに依存しなくなる。未計測の初回描画だけは
 * `DraggableCard.module.css` 側の既定値（`100%` + `aspect-ratio`）で描く。
 *
 * **行幅に収まらない時だけ縮小**（手札が多いステージ対策）：カードは原寸で
 * 並べ、行の自然幅（`row.offsetWidth`）が利用可能幅（`root.clientWidth`）を
 * 超えるときだけ、行全体を `transform: scale` で比率を保って縮小する
 * （`transform-origin: 右中央` で右寄せを維持）。`ResizeObserver` で親の
 * リサイズに追従し、手札枚数の変化（配置・リセット）やカード寸法の変化でも
 * 測り直す。原寸で収まる少数枚のステージでは `scale = 1` のまま一切縮まない。
 * `transform` はレイアウト幅を変えない（純視覚）ので、再測定で自然幅が
 * ブレず無限ループしない。
 *
 * Returns:
 *     JSX.Element: 手札全体を表す要素。
 */
function Hand() {
  const handCards = useBattleStore((s) => s.handCards);
  const rootRef = useRef(null);
  const rowRef = useRef(null);
  const [areaSize, setAreaSize] = useState(null);
  const [scale, setScale] = useState(1);

  /*
   * 手札エリアの実寸を測って保持する。root は `overflow: hidden` で中身に
   * 押し広げられないため、ここで測った値をカード寸法に使っても循環しない。
   */
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const measure = () => {
      const width = root.clientWidth;
      const height = root.clientHeight;
      setAreaSize((prev) =>
        prev && prev.width === width && prev.height === height
          ? prev
          : { width, height },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const areaWidth = areaSize?.width ?? 0;
  const cardHeight = areaSize?.height ?? 0;
  const cardWidth = (cardHeight * CARD_ASPECT_WIDTH) / CARD_ASPECT_HEIGHT;

  /*
   * カード寸法が確定した描画のあとで行の自然幅を測り、入りきらない時だけ
   * 縮小率を決める。
   */
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const natural = row.offsetWidth;
    setScale(natural > areaWidth && natural > 0 ? areaWidth / natural : 1);
  }, [handCards.length, areaWidth, cardHeight]);

  const rowStyle = {};
  if (cardHeight > 0) {
    rowStyle['--hand-card-height'] = `${cardHeight}px`;
    rowStyle['--hand-card-width'] = `${cardWidth}px`;
  }
  if (scale < 1) {
    rowStyle.transform = `scale(${scale})`;
    rowStyle.transformOrigin = 'right center';
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <div className={styles.row} ref={rowRef} style={rowStyle}>
        {handCards.map((card) => (
          <DraggableCard key={card.instanceId} card={card} source={HAND} />
        ))}
      </div>
    </div>
  );
}

export default Hand;
