import styles from './MapBackground.module.css';
import useProgressStore from '../../stores/progressStore';
import useCutsceneStore from '../../stores/cutsceneStore';

/**
 * マップ背景画像を SVG `<image>` として描画するコンポーネント。
 *
 * 親 `<svg>` の viewBox（論理座標）全面に画像を貼ることで、ウィンドウ
 * サイズが変わってもアスペクト比と相対位置が崩れない（要件 1-2, 6-3）。
 *
 * マップ定義に `clearedImage` / `clearedStageId` があり、そのステージを
 * クリア済みなら、背景を `clearedImage` に差し替える。マップ5（`map_5`）で、
 * 5-4 の勇者を倒して魔気が晴れたあとの明るい島を見せるのに使う。差し替え
 * 画像は元の絵と同じ構図なので、道・ランドマークの座標はそのまま使える。
 *
 * `clearedRevealCutsceneId` もある場合は、クリアしてすぐには差し替えず、
 * そのカットシーンの `purifyMap` step で元の絵の上に晴れた絵をゆっくり
 * 重ねて（クロスフェード）切り替える。切り替わったあとの step と、
 * カットシーンを見終えたあと（`seenIds`）は、晴れた絵をそのまま出す。
 * カットシーンを見る前（クリア直後にマップへ戻った瞬間など）は元の絵のまま。
 *
 * Args:
 *     props (object): React プロパティ。
 *         mapDef (object): `maps.json` の 1 マップ分。`image` と `viewBox`、
 *             任意で `clearedImage` / `clearedStageId` /
 *             `clearedRevealCutsceneId` を参照する。
 *
 * Returns:
 *     JSX.Element: SVG `<image>` 要素（クロスフェード中は 2 枚）。
 */
function MapBackground({ mapDef }) {
  const { image, viewBox, clearedImage, clearedStageId, clearedRevealCutsceneId } =
    mapDef;
  const isCleared = useProgressStore(
    (s) => Boolean(clearedStageId) && s.clearedStageIds.includes(clearedStageId),
  );
  const revealState = useCutsceneStore((s) => {
    if (!clearedRevealCutsceneId) return 'revealed';
    if (s.seenIds.includes(clearedRevealCutsceneId)) return 'revealed';
    if (s.activeId !== clearedRevealCutsceneId) return 'hidden';
    const purifyIndex = s.steps.findIndex((step) => step.purifyMap === true);
    if (purifyIndex < 0 || s.stepIndex > purifyIndex) return 'revealed';
    return s.stepIndex === purifyIndex ? 'fading' : 'hidden';
  });
  const hasCleared = isCleared && Boolean(clearedImage);
  const baseHref = hasCleared && revealState === 'revealed' ? clearedImage : image;
  const imageProps = {
    x: 0,
    y: 0,
    width: viewBox.width,
    height: viewBox.height,
    preserveAspectRatio: 'xMidYMid slice',
  };
  return (
    <>
      <image href={baseHref} {...imageProps} />
      {hasCleared && revealState === 'fading' && (
        <image href={clearedImage} className={styles.fadeIn} {...imageProps} />
      )}
    </>
  );
}

export default MapBackground;
