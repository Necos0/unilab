import styles from './SlotHelpVisual.module.css';

/**
 * マス説明ヘルプ（`HelpWindow` のマスカテゴリ）に表示するミニ図解。
 *
 * カード説明側の「カード画像」に相当する視覚要素として、各特殊マスの
 * 見た目を戦闘画面のフローチャートに寄せた静的な CSS / SVG ドローイングで
 * 再現する。実物のノード（`SlotNode` / `ConditionNode` 等）は React Flow の
 * コンテキスト（Handle・zustand 購読）に依存していてモーダル内では使えない
 * ため、寸法・色・意匠だけを移植したモック描画にする：
 *   - `condition`  : ひし形（`ConditionNode` の clip-path 意匠）＋〇/×の出口
 *   - `loop`       : 点線の繰り返し枠＋カウント数字＋戻り矢印（↻）
 *   - `multiplier` : 点線スロット（`SlotNode` 80×120）＋右上の「x2」
 *     （`MultiplierIndicator` と同じ Press Start 2P の白文字）
 *   - `acceptOnly` : 赤枠スロット（`.acceptAttack`）＋右上の剣アイコン
 *     （`RestrictedSlotIcon` の attack と同形・同色）
 *   - `counter`    : 金色アウトラインのスロット（`.counterPaired`）＋
 *     「x0→x1→x2」の増加表示
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
 * 条件マスの図解。ひし形＋右へ「〇」・下へ「×」の 2 つの出口を描く。
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
      <span className={`${styles.exitMark} ${styles.exitTrue}`}>→〇</span>
      <span className={`${styles.exitMark} ${styles.exitFalse}`}>↓×</span>
    </div>
  );
}

/**
 * カウントマス（for）の図解。点線の繰り返し枠にカウント数字と戻り矢印を描く。
 *
 * Returns:
 *     JSX.Element: カウントマスの図解要素。
 */
function LoopVisual() {
  return (
    <div className={styles.loopFrame}>
      <span className={styles.loopCount}>3</span>
      <div className={styles.slotMini} />
      <span className={styles.loopArrow}>↻</span>
    </div>
  );
}

/**
 * 倍率マスの図解。空スロットの右上に「x2」を重ねる。
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
 * 種類指定マスの図解。赤枠スロットの右上に剣アイコン（attack 指定の例）を
 * 重ねる。アイコンの形・色は `RestrictedSlotIcon` の attack と同一。
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
 * パワーアップマスの図解。金色アウトラインのスロットに、通るたびに倍率が
 * 上がる様子（x0→x1→x2）を重ねる。
 *
 * Returns:
 *     JSX.Element: パワーアップマスの図解要素。
 */
function CounterVisual() {
  return (
    <div className={`${styles.slot} ${styles.slotCounter}`}>
      <span className={styles.counterSteps}>
        x0
        <br />↓<br />
        x1
        <br />↓<br />
        x2
      </span>
    </div>
  );
}

export default SlotHelpVisual;
