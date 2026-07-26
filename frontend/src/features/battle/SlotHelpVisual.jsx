import styles from './SlotHelpVisual.module.css';

/**
 * マス説明ヘルプ（`HelpWindow` のマスカテゴリ）に表示するミニ図解。
 *
 * カード説明側の「カード画像」に相当する視覚要素として、各特殊マスの
 * 見た目を戦闘画面のフローチャートに寄せた静的な CSS / SVG ドローイングで
 * 再現する。実物のノード（`SlotNode` / `ConditionNode` 等）は React Flow の
 * コンテキスト（Handle・zustand 購読）に依存していてモーダル内では使えない
 * ため、寸法・色・意匠だけを移植したモック描画にする：
 *   - `condition`  : ひし形（`ConditionNode` の clip-path 意匠）＋
 *     「はい」「いいえ」の出口ラベル（`AnimatedProgressEdge` の
 *     `.handleLabel` と同じ白文字）
 *   - `loop`       : for-start / for-end のペア（`ForStartNode` /
 *     `ForEndNode` の金色角カット枠 + カウント数字）＋間のスロット＋
 *     戻りの弧
 *   - `multiplier` : 点線スロット（`SlotNode` 80×120）＋右上の「x2」
 *     （`MultiplierIndicator` と同じ Press Start 2P 11px 白文字）
 *   - `acceptOnly` : 赤枠スロット（`.acceptAttack`）＋左上の剣アイコン
 *     （`RestrictedSlotIcon` の attack と同形・同色・同配置）
 *   - `counter`    : カウンタカード入りスロットと、ペアの倍率マス
 *     （どちらも `.counterPaired` と同じ金色アウトライン）の 2 マス構成
 *
 * Args:
 *     props (object): React プロパティ。
 *         typeId (string): 図解するマス種別 ID。`slot_help.json` の `id`
 *             （`condition` / `loop` / `multiplier` / `acceptOnly` /
 *             `counter`）。未知の ID は空のスロット枠を描く。
 *
 * Returns:
 *     JSX.Element: 額縁（`HelpWindow` の `.cardFrame`）に収まる図解要素。
 */
function SlotHelpVisual({ typeId }) {
  return (
    <div className={styles.root}>
      {typeId === 'condition' ? (
        <ConditionVisual />
      ) : typeId === 'loop' ? (
        <LoopVisual />
      ) : typeId === 'multiplier' ? (
        <MultiplierVisual />
      ) : typeId === 'acceptOnly' ? (
        <AcceptOnlyVisual />
      ) : typeId === 'counter' ? (
        <CounterVisual />
      ) : (
        <div className={styles.slot} />
      )}
    </div>
  );
}

/**
 * 条件マスの図解。ひし形＋右へ「はい」・下へ「いいえ」の 2 つの出口を描く。
 * 出口ラベルは実戦のエッジラベル（`AnimatedProgressEdge` の はい/いいえ）と
 * 同じ白文字にする。
 *
 * Returns:
 *     JSX.Element: 条件マスの図解要素。
 */
function ConditionVisual() {
  return (
    <div className={styles.conditionWrap}>
      <div className={styles.diamond}>
        <span className={styles.diamondText}>？</span>
      </div>
      <span className={`${styles.exitMark} ${styles.exitTrue}`}>→はい</span>
      <span className={`${styles.exitMark} ${styles.exitFalse}`}>↓いいえ</span>
    </div>
  );
}

/**
 * カウントマス（for）の図解。実物の `ForStartNode` / `ForEndNode` と同じ
 * 金色の角カット枠（左角カット＝開始、右角カット＝終了）を縮小して並べ、
 * 間に繰り返す中身のスロット、上に戻りの弧を描く。開始側にはカウント数字
 * （実物と同じ Press Start 2P の金文字）を表示する。
 *
 * Returns:
 *     JSX.Element: カウントマスの図解要素。
 */
function LoopVisual() {
  return (
    <div className={styles.loopWrap}>
      <div className={styles.loopBackArc} />
      <div className={styles.loopRow}>
        <div className={`${styles.forNode} ${styles.forStart}`}>
          <span className={styles.forCount}>3</span>
        </div>
        <div className={styles.slotMini} />
        <div className={`${styles.forNode} ${styles.forEnd}`} />
      </div>
    </div>
  );
}

/**
 * 倍率マスの図解。空スロットの右上に「x2」（`MultiplierIndicator` と同じ
 * 意匠）を重ねる。
 *
 * Returns:
 *     JSX.Element: 倍率マスの図解要素。
 */
function MultiplierVisual() {
  return (
    <div className={styles.slot}>
      <span className={styles.multiplierBadge}>x2</span>
    </div>
  );
}

/**
 * 種類指定マスの図解。赤枠スロットの左上に剣アイコン（attack 指定の例）を
 * 重ねる。アイコンの形・色・配置は `RestrictedSlotIcon` の attack と同一。
 *
 * Returns:
 *     JSX.Element: 種類指定マスの図解要素。
 */
function AcceptOnlyVisual() {
  return (
    <div className={`${styles.slot} ${styles.slotAcceptAttack}`}>
      <svg
        viewBox="0 0 14 14"
        className={styles.acceptIcon}
        shapeRendering="crispEdges"
      >
        <rect x="6" y="1" width="2" height="7" fill="#ff4d4d" />
        <rect x="3" y="7" width="8" height="2" fill="#ff4d4d" />
        <rect x="6" y="9" width="2" height="4" fill="#8a2a2a" />
      </svg>
    </div>
  );
}

/**
 * パワーアップマスの図解。実戦（4-3）と同じ「カウンタカード入りスロット＋
 * ペアの倍率マス」の 2 マス構成を縮小して並べる。どちらも `SlotNode` の
 * `.counterPaired` と同じ金色アウトラインで、ペアであることを示す。
 *
 * Returns:
 *     JSX.Element: パワーアップマスの図解要素。
 */
function CounterVisual() {
  return (
    <div className={styles.counterRow}>
      <div className={`${styles.slotSmall} ${styles.slotCounter} ${styles.slotFilled}`}>
        <img
          className={styles.counterCard}
          src="/cards/counter.png"
          alt=""
          draggable={false}
        />
      </div>
      <div className={`${styles.slotSmall} ${styles.slotCounter}`}>
        <span className={styles.multiplierBadge}>x2</span>
      </div>
    </div>
  );
}

export default SlotHelpVisual;
