import styles from './BattleScreen.module.css';
import FlowchartArea from '../flowchart/FlowchartArea';
import stagesData from '../../data/stages.json';

const stage = stagesData.stages[0];

/**
 * 戦闘画面のルートコンポーネント。
 *
 * Undertale 風の3段レイアウトで画面を構成する。
 *   - 上段: 敵の表示領域
 *   - 中段: フローチャート領域（React Flow）
 *   - 下段: HP と手札カード領域
 * 中段は `stages.json` の先頭ステージを読み込んで `FlowchartArea` に
 * 渡し、空きスロットとエッジを描画する。上段・下段は現時点では
 * プレースホルダ表示で、後続の実装で実際の敵スプライト・カード UI を
 * 埋め込む。スタイルは同ディレクトリの CSS Modules に切り出し、
 * クラス名衝突を防ぐ。
 *
 * Returns:
 *     JSX.Element: 戦闘画面全体を表す section 要素。
 */
function BattleScreen() {
  return (
    <section className={styles.root}>
      <div className={styles.enemyArea}>[敵エリア] テストエネミー</div>
      <div className={styles.flowchartArea}>
        <FlowchartArea stage={stage} />
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
