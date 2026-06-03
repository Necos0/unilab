import { motion, AnimatePresence } from 'framer-motion';
import styles from './MultiplierIndicator.module.css';

/**
 * 倍率スロット（`multiplier-slot` / `loop-counter` 仕様）の右上に表示する
 * 倍率インジケータ。
 *
 * `value` props を受け取り、「x2」「x3」形式の白色テキストを描画する。`SlotNode`
 * 側で `displayMultiplier !== undefined` のスロットにのみ条件付きでレンダリング
 * されるため、本コンポーネントでは値のガードを行わない。`displayMultiplier` は
 * 数値リテラル multiplier（既存）またはカウンタ連動の `counterValues[counterRef]`
 * （loop-counter 新規）を解決した結果で、`0` も正当な値として受け取り得る。
 *
 * **値変化時のスケールアニメ**（`loop-counter` 仕様、要件 8-2）：framer-motion の
 * `motion.div` + `AnimatePresence` を用い、`key={value}` 駆動で **値が変わるたびに
 * 再マウント** することでアニメを発火する。`initial={{ scale: 1.6, opacity: 0.5 }}`
 * から `animate={{ scale: 1.0, opacity: 1 }}` へ 180ms で遷移し、「ぽんっ」と
 * ポップアップする視覚効果になる。`AnimatePresence mode="popLayout"` により、
 * 退場要素を即座に DOM から取り除き次の要素の配置が遅延しない。`SlotNode` 側で
 * zustand から `counterValues[counterRef]` を購読しているため、counter ノード
 * 通過時の `incrementCounter` action 経由でカウンタ値が +1 されると、本コンポーネント
 * の `value` prop が更新されてアニメが発火する。これと `SlotNode` の `counterFlash`
 * クラス（金色フラッシュ）が同タイミングで走るため、ペアの counter slot と
 * multiplier slot が **完全に同期して光る + 数字が +1 される** 演出が成立する
 * （要件 7-2 / 8-1）。
 *
 * 数値リテラル multiplier（例: 4-4 の `multiplier: 5`）でも初回マウント時に 1 回
 * だけアニメが走る。初回登場時の弾みは「multiplier がそこにある」情報伝達として
 * 有効と判断し、抑制しない（必要なら `initial={{ scale: 1 }}` に変えて静止可能）。
 *
 * 配置は `.indicator` CSS の `position: absolute; top: 2px; right: 2px;` で
 * スロット内側右上。`acceptOnly` アイコン（`RestrictedSlotIcon`、左上に移設）と
 * 左右で分離して衝突を避ける（multiplier-slot 要件 4-4）。`z-index: 2` で配置済み
 * カード（`DraggableCard`）より前面に描画され、カードが置かれた状態でも倍率が
 * 視認できる（multiplier-slot 要件 3-3）。`text-shadow` で明るいカード画像の上でも
 * 白文字が埋もれないようにし、`pointer-events: none` でドラッグ操作を奪わない。
 *
 * フォントは HP/Guard バーの数値表示と同じ `Press Start 2P` で、戦闘画面全体の
 * ピクセルアート意匠と統一する（multiplier-slot 要件 3-6）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         value (number): 倍率値。2 以上の整数（数値リテラル経路）または
 *             0 以上の整数（カウンタ連動経路）。`x<value>` の形で表示する。
 *
 * Returns:
 *     JSX.Element: `AnimatePresence` でラップされた `motion.div` 要素。
 *         `value` が変わるたびに再マウントしてスケールアニメを発火する。
 */
function MultiplierIndicator({ value }) {
  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={value}
        className={styles.indicator}
        initial={{ scale: 1.6, opacity: 0.5 }}
        animate={{ scale: 1.0, opacity: 1 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        x{value}
      </motion.div>
    </AnimatePresence>
  );
}

export default MultiplierIndicator;