import styles from './GalleryCharacterCard.module.css';
import { getEnemyFramePath } from '../features/battle/enemy/enemySpritePath';
import { useSpriteAnimation } from '../hooks/useSpriteAnimation';

/**
 * キャラクター一覧画面で 1 体ぶんの idle アニメーションを表示するカード。
 *
 * `enemies.json` の 1 エントリを受け取り、その `idle` アニメーション定義に
 * 従って `useSpriteAnimation` でフレームを進め、`getEnemyFramePath` が組み
 * 立てる URL を `<img>` に流し込む。バトル用の `EnemySprite` と違い被弾
 * フラッシュ・フェードなどの戦闘演出には依存せず、純粋に idle を眺める
 * ための表示に徹する。画像はセル幅・高さに収まるよう `object-fit: contain`
 * で縮小表示し、原寸の大きいスプライトでも一覧レイアウトを崩さない。
 * `idle` 定義が無い敵は描画対象外として `null` を返す。本コンポーネントは
 * 開発者向けビューのため、ゲーム内テキストのふりがな規則は適用しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         enemy (object): `enemies.json` の敵エントリ（`id` / `displayName`
 *             / `animations.idle` を含む）。
 *
 * Returns:
 *     JSX.Element | null: キャラクターカード要素、または idle 未定義時 null。
 */
function GalleryCharacterCard({ enemy }) {
  const idle = enemy.animations?.idle;

  const { frameIndex } = useSpriteAnimation({
    frameCount: idle?.frameCount ?? 1,
    frameDurationMs: idle?.frameDurationMs ?? 1000,
    loop: idle?.loop ?? true,
  });

  if (!idle) {
    return null;
  }

  return (
    <figure className={styles.card}>
      <div className={styles.stage}>
        <img
          className={styles.sprite}
          src={getEnemyFramePath(enemy.id, 'idle', frameIndex)}
          alt={enemy.displayName}
          draggable={false}
        />
      </div>
      <figcaption className={styles.caption}>
        <span className={styles.name}>{enemy.displayName}</span>
        <span className={styles.id}>{enemy.id}</span>
      </figcaption>
    </figure>
  );
}

export default GalleryCharacterCard;
