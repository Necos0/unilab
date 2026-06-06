import styles from './GalleryCharacterCard.module.css';
import { getEnemyFramePath } from '../features/battle/enemy/enemySpritePath';
import { useSpriteAnimation } from '../hooks/useSpriteAnimation';

/**
 * キャラクター一覧画面で 1 体ぶんのアニメーションを表示するカード。
 *
 * `enemies.json` の 1 エントリと表示する状態 `state`（`idle` / `dead`）を
 * 受け取り、その状態のアニメーション定義に従って `useSpriteAnimation` で
 * フレームを進め、`getEnemyFramePath` が組み立てる URL を `<img>` に流し
 * 込む。`state` が変わると `useSpriteAnimation` が設定変更を検知して先頭
 * フレームから再生し直すため、やられ（dead, loop=false）も毎回頭から再生
 * される。バトル用の `EnemySprite` と違い被弾フラッシュ・フェードなどの
 * 戦闘演出には依存せず、純粋にアニメを眺めるための表示に徹する。画像は
 * セル幅・高さに収まるよう `object-fit: contain` で縮小表示し、原寸の
 * 大きいスプライトでも一覧レイアウトを崩さない。指定状態の定義が無い敵は
 * 描画対象外として `null` を返す。本コンポーネントは開発者向けビューの
 * ため、ゲーム内テキストのふりがな規則は適用しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         enemy (object): `enemies.json` の敵エントリ（`id` / `displayName`
 *             / `animations` を含む）。
 *         state (string): 表示するアニメーション状態（`'idle'` / `'dead'`）。
 *
 * Returns:
 *     JSX.Element | null: キャラクターカード要素、または該当状態未定義時 null。
 */
function GalleryCharacterCard({ enemy, state }) {
  const animation = enemy.animations?.[state];

  const { frameIndex } = useSpriteAnimation({
    frameCount: animation?.frameCount ?? 1,
    frameDurationMs: animation?.frameDurationMs ?? 1000,
    loop: animation?.loop ?? true,
  });

  if (!animation) {
    return null;
  }

  return (
    <figure className={styles.card}>
      <div className={styles.stage}>
        <img
          className={styles.sprite}
          src={getEnemyFramePath(enemy.id, state, frameIndex)}
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
