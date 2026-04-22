import styles from './BattleScreen.module.css';
import FlowchartArea from './flowchart/FlowchartArea';
import EnemySprite from './enemy/EnemySprite';
import Hand from '../cards/Hand';
import HpBar from '../../components/HpBar';
import stagesData from '../../data/stages.json';
import enemiesData from '../../data/enemies.json';
import playerData from '../../data/player.json';

const stage = stagesData.stages[0];

/**
 * 戦闘画面のルートコンポーネント。
 *
 * Undertale 風の3段レイアウトで画面を構成する。
 *   - 上段: 敵スプライトと敵 HP バー（`EnemySprite` + 汎用 `HpBar`）
 *   - 中段: フローチャート領域（React Flow）
 *   - 下段: プレイヤー HP バー + 数値と手札カード領域
 * 現在ステージの `enemyId` から `enemies.json` で敵データを解決し、
 * `EnemySprite` には `enemyId` をそのまま渡して idle アニメーションを
 * 表示、`HpBar` には敵の `maxHp` を渡して HP バーを描画する。中段は
 * `stages.json` の先頭ステージを `FlowchartArea` に渡して空きスロットと
 * エッジを描画する。下段はプレイヤーの HP バー（`HpBar`）と
 * `currentHp / maxHp` 表記、および現在ステージの `cards` 定義を
 * そのまま `Hand` に渡して手札を描画する。プレイヤーの最大 HP は
 * `player.json` から取得し、HP の状態管理が未実装な現段階では敵・
 * プレイヤー共に満タン固定で表示する。スタイルは同ディレクトリの
 * CSS Modules に切り出し、クラス名衝突を防ぐ。
 *
 * Returns:
 *     JSX.Element: 戦闘画面全体を表す section 要素。
 */
function BattleScreen() {
  const enemy = enemiesData.enemies.find((e) => e.id === stage.enemyId);
  const enemyMaxHp = enemy?.maxHp;
  const playerMaxHp = playerData.maxHp;

  return (
    <section className={styles.root}>
      <div className={styles.enemyArea}>
        <EnemySprite enemyId={stage.enemyId} state="idle" />
        <HpBar currentHp={enemyMaxHp} maxHp={enemyMaxHp} />
      </div>
      <div className={styles.flowchartArea}>
        <FlowchartArea stage={stage} />
      </div>
      <div className={styles.playerArea}>
        <div className={styles.hpBox}>
          <HpBar currentHp={playerMaxHp} maxHp={playerMaxHp} />
          <span className={styles.hpText}>
            {playerMaxHp}/{playerMaxHp}
          </span>
        </div>
        <Hand cards={stage.cards} />
      </div>
    </section>
  );
}

export default BattleScreen;
