import { useEffect, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import styles from './MultiplierIndicator.module.css';

/**
 * 倍率スロット（`multiplier-slot` / `loop-counter` 仕様）の右上に表示する
 * 倍率インジケータ。
 *
 * `value` props を受け取り、「x2」「x3」形式の白色テキストを描画する。`SlotNode`
 * 側で `displayMultiplier !== undefined` のスロットにのみ条件付きでレンダリング
 * されるため、本コンポーネントでは値のガードを行わない。`displayMultiplier` は
 * 数値リテラル multiplier（既存）またはカウンタ連動の `counterValues[counterRef]`
 * （loop-counter 新規、offset 込み）を解決した結果で、`0` も正当な値として受け取り得る。
 *
 * **値変化時のスケールアニメ**（`loop-counter` 仕様、要件 8-2）：framer-motion の
 * `motion.div` + `AnimatePresence` を用い、`key={value}` 駆動で **値が変わるたびに
 * 再マウント** することでアニメを発火する。`initial={{ scale: 1.6, opacity: 0.5 }}`
 * から `animate={{ scale: 1.0, opacity: 1 }}` へ 180ms で遷移し、「ぽんっ」と
 * ポップアップする視覚効果になる。`SlotNode` 側で zustand から
 * `counterValues[counterRef]` を購読しているため、counter ノード通過時の
 * `incrementCounter` action 経由でカウンタ値が +1 されると、本コンポーネントの
 * `value` prop が更新されてアニメが発火する。これと `SlotNode` の `counterFlash`
 * クラス（枠の点滅）が同タイミングで走るため、ペアの counter slot と multiplier
 * slot が **完全に同期して光る + 数字が +1 される** 演出が成立する（要件 7-2 / 8-1）。
 *
 * **浮遊フローター**（`floating` が true のときだけ）：カウンタ連動の倍率スロット
 * （パワーアップマス）では、カウントマス通過で倍率が増えた瞬間に、倍率テキストの
 * 残像を右上へ「ふわっ」と浮かせ、広がりながら消す。これにより「このカウントで
 * 何倍になったか」が、実行ハイライトを追わなくても直感的に分かる。数値リテラルの
 * 固定倍率スロット（×2 など、`floating=false`）では出さない。初回マウント（入場時
 * の初期倍率）では出さず、`value` が **実際に増減した** 2 回目以降の変化でのみ
 * フローターを発火する（`prevValueRef` で前回値を保持して判定）。フローターは
 * `floatSeq`（変化ごとに +1）を key にして、変化のたびに新しい `motion.div` を
 * 再マウントしアニメを再生する。
 *
 * 数値リテラル multiplier（例: 4-4 の `multiplier: 5`）でも初回マウント時に 1 回
 * だけスケールアニメが走る。初回登場時の弾みは「multiplier がそこにある」情報伝達
 * として有効と判断し、抑制しない。
 *
 * 配置は `.indicator` CSS の `position: absolute; top: 2px; right: 2px;` で
 * スロット内側右上。`acceptOnly` アイコン（`RestrictedSlotIcon`、左上に移設）と
 * 左右で分離して衝突を避ける（multiplier-slot 要件 4-4）。`z-index: 2` で配置済み
 * カード（`DraggableCard`）より前面に描画され、カードが置かれた状態でも倍率が
 * 視認できる（multiplier-slot 要件 3-3）。フローターは `z-index: 3` でさらに前面。
 *
 * Args:
 *     props (object): React プロパティ。
 *         value (number): 倍率値。2 以上の整数（数値リテラル経路）または
 *             0 以上の整数（カウンタ連動経路）。`x<value>` の形で表示する。
 *         floating (boolean, optional): カウンタ連動スロットのとき true。値が
 *             増減した瞬間に浮遊フローターを出す。既定 false。
 *
 * Returns:
 *     JSX.Element: 静止インジケータ（＋ floating 時はフローター）を含む要素。
 */
function MultiplierIndicator({ value, floating = false }) {
  const prevValueRef = useRef(value);
  const [floatSeq, setFloatSeq] = useState(0);
  const [floatValue, setFloatValue] = useState(value);

  useEffect(() => {
    if (!floating) return;
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      setFloatValue(value);
      setFloatSeq((seq) => seq + 1);
    }
  }, [value, floating]);

  return (
    <>
      <AnimatePresence mode="popLayout">
        <Motion.div
          key={value}
          className={styles.indicator}
          initial={{ scale: 1.6, opacity: 0.5 }}
          animate={{ scale: 1.0, opacity: 1 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          x{value}
        </Motion.div>
      </AnimatePresence>
      {floating && floatSeq > 0 && (
        <Motion.div
          key={floatSeq}
          className={styles.floater}
          initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
          animate={{
            x: [0, 24, 48],
            y: [0, -10, -22],
            scale: [1, 1.5, 1.9],
            opacity: [1, 1, 0],
          }}
          transition={{ duration: 1.4, ease: 'easeOut', times: [0, 0.55, 1] }}
          aria-hidden="true"
        >
          x{floatValue}
        </Motion.div>
      )}
    </>
  );
}

export default MultiplierIndicator;
