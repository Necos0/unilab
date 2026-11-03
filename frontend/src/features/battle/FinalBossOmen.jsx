import styles from './FinalBossOmen.module.css';
import { getEnemyFramePath } from './enemy/enemySpritePath';

/*
 * 画面の外から中央へ走る「黒いフローチャート」の線。viewBox 0 0 1000 600 の
 * 座標で、直角に曲がる折れ線（フローチャートの矢印）として中央（500, 300）
 * 付近へ集まる。`delay` は線ごとに描き始めをずらす時間（ms）。
 */
const CONVERGING_LINES = [
  { d: 'M -20 80 H 220 V 200 H 430 V 285', delay: 0 },
  { d: 'M 1020 60 H 760 V 180 H 570 V 285', delay: 120 },
  { d: 'M -20 520 H 180 V 400 H 420 V 315', delay: 240 },
  { d: 'M 1020 540 H 820 V 420 H 580 V 315', delay: 60 },
  { d: 'M 300 -20 V 120 H 470 V 270', delay: 300 },
  { d: 'M 700 -20 V 100 H 530 V 270', delay: 180 },
  { d: 'M 260 620 V 470 H 480 V 330', delay: 360 },
  { d: 'M 740 620 V 490 H 520 V 330', delay: 420 },
];

/**
 * 最終ボス（5-4、黒いフローチャートに操られた勇者）の入場前に流す
 * シネマ演出。`BattleScreen` の入場フェーズ `finalOmen` の間だけ、
 * バトル画面全体を覆う層としてマウントされる。
 *
 * 進行（合計約 4200ms、`FinalBossOmen.module.css` のアニメーションで制御）:
 *   1. 黒い画面に上下の黒帯（シネマスコープ）がすべりこむ
 *   2. 紫に光るフローチャートの線（`CONVERGING_LINES`）が四方から中央へ
 *      描かれ、先端の矢印が中央に集まる（勇者に書きこまれた呪いの表現）
 *   3. 中央に紫の光の輪が脈打ち、勇者の黒いシルエット（待機アニメの
 *      1 コマ目を真っ黒にしたもの）が浮かび上がって大きくなる
 *   4. 紫白の閃光で画面がはじけ、層全体が消えて通常のボス入場
 *      （敵のスライドイン → 最終ボス版バナー）へつながる
 *
 * 時間で親のフェーズが進むので、この層自身は完了を通知しない。演出中の
 * タップスキップは親の `.introSkipLayer`（この層より上）が受け持つ。
 *
 * Args:
 *     props (object): React プロパティ。
 *         enemyId (string): シルエットに使う敵 ID（`enemies.json` の id）。
 *
 * Returns:
 *     JSX.Element: バトル画面全体を覆う演出層。
 */
function FinalBossOmen({ enemyId }) {
  return (
    <div className={styles.overlay} aria-hidden="true">
      <svg
        className={styles.lines}
        viewBox="0 0 1000 600"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <marker
            id="finalOmenArrow"
            viewBox="0 0 10 10"
            refX="5"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" className={styles.arrowHead} />
          </marker>
        </defs>
        {CONVERGING_LINES.map((line) => (
          <path
            key={line.d}
            d={line.d}
            pathLength="1"
            className={styles.line}
            style={{ animationDelay: `${400 + line.delay}ms` }}
            markerEnd="url(#finalOmenArrow)"
          />
        ))}
      </svg>
      <div className={styles.ring} />
      <img
        className={styles.silhouette}
        src={getEnemyFramePath(enemyId, 'idle', 0)}
        alt=""
        draggable={false}
      />
      <div className={styles.barTop} />
      <div className={styles.barBottom} />
      <div className={styles.flash} />
    </div>
  );
}

export default FinalBossOmen;
