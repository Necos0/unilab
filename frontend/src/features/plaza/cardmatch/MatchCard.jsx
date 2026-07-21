import styles from './MatchCard.module.css';
import { getEnemyFramePath } from '../../battle/enemy/enemySpritePath';

/**
 * カードあわせ（神経衰弱）の、めくれるカード 1 枚。
 *
 * 表面には敵スプライトの idle 1 フレーム目（`getEnemyFramePath` で URL を
 * 解決）、裏面には「？」マークを描画し、`isFaceUp` / `isMatched` に応じて
 * CSS の 3D 回転（`rotateY`）で表裏をひっくり返す。そろったカード
 * （`isMatched`）は表向きのまま金色に光り、小さく弾むアニメーションで
 * 「そろった!」の手応えを出す。
 *
 * クリック判定は親（`CardMatchScreen`）が一元管理するため、本コンポーネント
 * は「押されたら `onClick` を呼ぶだけ」のプレゼンテーション担当に徹する。
 * 表向き・そろった後のカードは `disabled` にして押せないようにする。
 *
 * Args:
 *     props (object): React プロパティ。
 *         enemyId (string): 表面に描く敵の ID（`enemies.json` のキー）。
 *         isFaceUp (boolean): 表向きなら true（めくられている最中も含む）。
 *         isMatched (boolean): ペアがそろったカードなら true。
 *         onClick (function): カード押下時に呼ぶハンドラ。引数なし。
 *
 * Returns:
 *     JSX.Element: カード 1 枚分のボタン要素。
 */
function MatchCard({ enemyId, isFaceUp, isMatched, onClick }) {
  const showFace = isFaceUp || isMatched;
  const innerClassName = [
    styles.inner,
    showFace && styles.flipped,
    isMatched && styles.matched,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={styles.card}
      onClick={onClick}
      disabled={showFace}
      aria-label={showFace ? enemyId : 'うらむきのカード'}
    >
      <div className={innerClassName}>
        <div className={styles.back}>
          <span className={styles.backMark}>?</span>
        </div>
        <div className={styles.front}>
          <img
            className={styles.faceImage}
            src={getEnemyFramePath(enemyId, 'idle', 0)}
            alt=""
            draggable={false}
          />
        </div>
      </div>
    </button>
  );
}

export default MatchCard;
