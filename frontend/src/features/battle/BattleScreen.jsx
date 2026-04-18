import styles from './BattleScreen.module.css';

/**
 * 戦闘画面のルートコンポーネント。
 *
 * Undertale 風の3段レイアウトで画面を構成する。
 *   - 上段: 敵の表示領域
 *   - 中段: フローチャート領域
 *   - 下段: HP と手札カード領域
 * 現時点では各領域にプレースホルダのテストテキストのみを表示し、
 * 後続の実装で実際の敵スプライト・React Flow・カード UI を埋め込む。
 * スタイルは同ディレクトリの CSS Modules (BattleScreen.module.css) に
 * 切り出し、クラス名衝突を防ぐ。
 *
 * Returns:
 *     JSX.Element: 戦闘画面全体を表す section 要素。
 */
function BattleScreen() {
  return (
    <section className={styles.root}>
      <div className={styles.enemyArea}>[敵エリア] テストエネミー</div>
      <div className={styles.flowchartArea}>
        [フローチャートエリア] ここにノードを配置
      </div>
      <div className={styles.bottomArea}>
        <div className={styles.hpBox}>HP: 100 / 100</div>
        <div className={styles.hand}>
          <div className={styles.card}>カードA</div>
          <div className={styles.card}>カードB</div>
          <div className={styles.card}>カードC</div>
        </div>
      </div>
    </section>
  );
}

export default BattleScreen;
