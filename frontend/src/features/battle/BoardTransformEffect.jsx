import styles from './BoardTransformEffect.module.css';

/**
 * フローチャート・手札エリアの「変身」エフェクト（最終ボス第二形態）。
 *
 * カットシーン `stage4-4-revive` の `boardTransform` step に進んだ間だけ、
 * 親（`BattleScreen`）が `.roboPanel`（フローチャート＋手札を包むパネル）の
 * 内側に条件付きでマウントする。金色の光がパネル全体に満ち、光が最も強い
 * 瞬間（`BattleScreen` の BOARD_TRANSFORM_SWAP_MS）に裏で盤面が第二形態へ
 * 差し替わり、光が引くと新しいフローチャートとひっさつカードが現れている、
 * という見せ方をする。
 *
 * アニメーション時間・光のピーク位置は `BoardTransformEffect.module.css` の
 * `@keyframes` に持たせており、`BattleScreen` の BOARD_TRANSFORM_*_MS 定数と
 * 同期させる必要がある（CSS 側を変えたら定数も合わせること）。
 *
 * エフェクト中は `pointer-events: auto` の全面層としてパネル内の操作
 * （実行・リセット・カードのドラッグ）をブロックし、差し替えの瞬間の
 * 誤操作を防ぐ。
 *
 * Returns:
 *     JSX.Element: `.roboPanel` 内側全体を覆うエフェクト層。
 */
function BoardTransformEffect() {
  return (
    <div className={styles.effect} aria-hidden="true">
      <div className={styles.glow} />
    </div>
  );
}

export default BoardTransformEffect;
