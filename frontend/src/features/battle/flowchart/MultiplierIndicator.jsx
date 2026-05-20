import styles from './MultiplierIndicator.module.css';

/**
 * 倍率スロット（`multiplier-slot` 仕様）の右上に表示する倍率インジケータ。
 *
 * `value` props（2 以上の整数を想定）を受け取り、「x2」「x3」形式の白色テキスト
 * を描画する。`SlotNode` 側で `data.multiplier` がセットされているスロット
 * （`multiplier >= 2`）にのみ条件付きでレンダリングされるため、本コンポーネント
 * では値のガードを行わない（呼び出し側で `{multiplier && ...}` の真偽判定済み）。
 *
 * 配置は `.indicator` CSS の `position: absolute; top: 2px; right: 2px;` で
 * スロット内側右上。`acceptOnly` アイコン（`RestrictedSlotIcon`、左上に移設）と
 * 左右で分離して衝突を避ける（要件 4-4）。`z-index: 2` で配置済みカード
 * （`DraggableCard`）より前面に描画され、カードが置かれた状態でも倍率が
 * 視認できる（要件 3-3）。`text-shadow` で明るいカード画像の上でも白文字が
 * 埋もれないようにし、`pointer-events: none` でドラッグ操作を奪わない。
 *
 * フォントは HP/Guard バーの数値表示と同じ `Press Start 2P` で、戦闘画面全体の
 * ピクセルアート意匠と統一する（要件 3-6）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         value (number): 倍率値。2 以上の整数を想定。`x<value>` の形で表示する。
 *
 * Returns:
 *     JSX.Element: 倍率テキストを表す div 要素。
 */
function MultiplierIndicator({ value }) {
  return <div className={styles.indicator}>x{value}</div>;
}

export default MultiplierIndicator;