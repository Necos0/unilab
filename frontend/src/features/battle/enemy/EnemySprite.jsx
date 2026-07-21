import { useEffect, useState } from 'react';
import styles from './EnemySprite.module.css';
import enemiesData from '../../../data/enemies.json';
import { getEnemyFramePath } from './enemySpritePath';
import { useSpriteAnimation } from '../../../hooks/useSpriteAnimation';
import { useResponsiveSpriteZoom } from '../../../hooks/useResponsiveSpriteZoom';
import useBattleStore from '../../../stores/battleStore';

/**
 * 敵をスプライトアニメーションで描画する汎用コンポーネント。
 *
 * `enemies.json` から `enemyId` と `state` に対応するアニメーション
 * 定義を解決し、`useSpriteAnimation` で進行する現在フレームを
 * `getEnemyFramePath` で URL に変換して `<img>` で描画する。
 * 対象状態のフレーム群はマウント時に `new Image()` で事前読み込み
 * することで、フレーム切り替え時のチラつきを防ぐ。
 * `enemyId` または `state` が定義に存在しない場合は `null` を返し、
 * 親レイアウトを崩さない。スプライトは `<img>` を内包する表示枠
 * （`.root`）に収め、`useResponsiveSpriteZoom` が表示枠の実寸と画像の
 * 原寸から「枠に収まる最大倍率」を計算して `<img>` の `zoom` に適用する。
 * これにより敵ごとの固定スケール値を持たなくても、どの画面サイズでも
 * スプライトが表示枠いっぱいの最大サイズで、かつ常に枠内に収まる。
 * `enemies.json` の任意プロパティ `sizeRatio`（0〜1）を渡すと、その最大
 * サイズからの比率でキャラごとに表示を縮小できる（未指定時は 1＝枠いっぱい）。
 * `zoom` を使うのは、`transform: scale()` だとレイアウト上の占有サイズが
 * 原寸のまま残り、`overflow: hidden` の敵エリアで HP バーが押し出されて
 * しまうため。`zoom` は占有ボックスごと拡縮するので、HP バーが常に
 * 正しく収まる。
 *
 * **表示枠 `.root` には `align-self: stretch` が必須**（`EnemySprite.module.css`
 * を参照）。これを外すと、フローチャート拡大→縮小の遷移中に zoom と表示枠幅の
 * 負のフィードバックループが起動し、スプライトが極小（数 px）まで縮んで戻らなく
 * なる。詳しい連鎖メカニズムは `useResponsiveSpriteZoom` の docstring と README
 * の「開発者向けノート」を参照。
 *
 * 攻撃ヒット演出として `battleStore.enemyDamageEvents` 末尾の id を購読し、
 * 新しいダメージイベントが入ったタイミングで `<img>` に `.flashing`
 * クラスを 1 ショット付与する。CSS の `@keyframes enemyFlash` が
 * `filter: brightness/saturate` でスプライトを白く明滅させ、
 * `onAnimationEnd` でクラスを外す。位置・サイズ・idle のフレーム
 * 切り替えには影響しない（演出は重ね描き）。
 *
 * 勝利演出への連動として `battleStore.victoryPhase` を購読し、
 * `'fading'` または `'cleared'` のとき `<img>` に `.fading` クラスを
 * 付与して `opacity: 0` へ 0.5 秒のトランジションをかける。
 * `'fading'` 中はフェードが進行し、`'cleared'` では透明のまま固定される
 * （`victory-clear` 要件 3）。dead 状態への切替（`state="dead"`）の
 * 判断は親（`BattleScreen`）側で行い、本コンポーネントは渡された
 * `state` プロップに従って描画する責務に限定する。`.flashing` は
 * `filter`、`.fading` は `opacity` で別プロパティのため、両方が同時に
 * 当たっても干渉しない。
 *
 * 失敗演出への連動として `battleStore.failPhase` を購読し、`'shown'` の
 * とき `<img>` に `.dimmed` クラスを付与して `opacity: 0.4` へ 0.3 秒の
 * トランジションをかける（`battle-fail-retry` 要件 3-5）。CLEAR! 時の
 * 完全透明（`.fading`）と区別できる「敵がまだ残っているが弱まって見える」
 * 半透過状態を表現する。`failPhase` と `victoryPhase` は相互排他なので
 * `.fading` と `.dimmed` が同時に当たることは無いが、CSS は独立クラスに
 * しておくことで責務の分離を明確化している（勝利＝完全消失、失敗＝薄く
 * 残る）。`.dimmed` も `opacity` プロパティで描かれるため、`.flashing`
 * の `filter` 系演出（実行中の被弾フラッシュなど）とは干渉しない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         enemyId (string): 敵識別子。
 *         state (string): アニメーション状態名。既定値 `"idle"`。
 *         className (string, optional): 表示枠 `.root` に追加するクラス名。
 *             バトル入場演出（スライドイン）など、親側の一時的な演出クラスを
 *             載せるための口。`transform` 系のアニメーションはレイアウト寸法に
 *             影響しないため、`useResponsiveSpriteZoom` の枠計測とは干渉しない。
 *
 * Returns:
 *     JSX.Element | null: スプライト画像を内包する要素、または未定義時 null。
 */
function EnemySprite({ enemyId, state = 'idle', className }) {
  const enemy = enemiesData.enemies.find((e) => e.id === enemyId);
  const animation = enemy?.animations?.[state];

  const { frameIndex } = useSpriteAnimation({
    frameCount: animation?.frameCount ?? 1,
    frameDurationMs: animation?.frameDurationMs ?? 1000,
    loop: animation?.loop ?? false,
  });

  const lastDamageId = useBattleStore(
    (s) => s.enemyDamageEvents[s.enemyDamageEvents.length -1]?.id ?? null,
  );
  const [consumedDamageId, setConsumedDamageId] = useState(null);
  const isFlashing = lastDamageId !== null && lastDamageId !== consumedDamageId;
  const victoryPhase = useBattleStore((s) => s.victoryPhase);
  const isFading = victoryPhase === 'fading' || victoryPhase === 'cleared';
  const failPhase = useBattleStore((s) => s.failPhase);
  const isDimmed = failPhase === 'shown';
  const { containerRef, onImageLoad, zoom } = useResponsiveSpriteZoom(
    enemy?.sizeRatio ?? 1,
  );

  useEffect(() => {
    if (!animation) return;
    for (let i = 0; i < animation.frameCount; i += 1) {
      const img = new Image();
      img.src = getEnemyFramePath(enemyId, state, i);
    }
  }, [enemyId, state, animation]);

  if (!animation) {
    return null;
  }

  const src = getEnemyFramePath(enemyId, state, frameIndex);

  return (
    <div
      ref={containerRef}
      className={[styles.root, className].filter(Boolean).join(' ')}
    >
      <img
        className={`${styles.sprite} ${isFlashing ? styles.flashing : ''} ${isFading ? styles.fading : ''} ${isDimmed ? styles.dimmed : ''}`}
        style={zoom !== 1 ? { zoom } : undefined}
        onAnimationEnd={() => setConsumedDamageId(lastDamageId)}
        onLoad={onImageLoad}
        src={src}
        alt={enemy.displayName}
        draggable={false}
      />
    </div>
  );
}

export default EnemySprite;
