import cutscenes from '../../data/cutscenes.json';
import stagesData from '../../data/stagesLoader.js';
import parseStageId from '../map/parseStageId.js';

/**
 * ステージ内で順に発生する「カットシーンの差し込み口」の定義。
 *
 * `cutscenes.json` の `trigger.type` と 1 対 1 で対応し、配列の並びが
 * そのままステージ内の時系列（到着 → バトル開始 → 敗北 → 撃破 → 退出）に
 * なる。`CutsceneFlowScreen` はこの並びを縦に描いて、どのタイミングに
 * カットシーンが付いているかを見せる。開発用ビューのため、ラベルには
 * ふりがなを振らない（プレイヤー向けテキストではない）。
 *
 * Exports:
 *     STAGE_TIMINGS (Array<{type, label, desc}>): ステージ内タイミング定義。
 */
export const STAGE_TIMINGS = [
  { type: 'arriveLandmark', label: 'ステージ到着', desc: 'マップでステージのランドマークに着いたとき' },
  { type: 'enterBattle', label: 'バトル開始', desc: 'バトル画面に入った直後' },
  { type: 'battleLost', label: 'バトル敗北', desc: 'バトルに負けたとき' },
  { type: 'defeatEnemy', label: '敵を倒す', desc: '勝利演出（撃破）のとき' },
  { type: 'exitStage', label: 'ステージ退出', desc: 'クリアしてマップへ戻るとき（解放アニメ後）' },
];

/**
 * 各ワールドの先頭で 1 回だけ発生する「マップ入場」タイミングの定義。
 *
 * `enterMapArea` トリガーはそのワールドのマップに初めて入ったときに発火し、
 * `cutscenes.json` 上は番号 1 のステージ（`X-1`）の `stageId` に紐づく。
 * ステージ単位ではなくワールド単位の出来事なので `STAGE_TIMINGS` とは
 * 分けて持つ。
 *
 * Exports:
 *     MAP_ENTER_TIMING ({type, label, desc}): マップ入場タイミング定義。
 */
export const MAP_ENTER_TIMING = {
  type: 'enterMapArea',
  label: 'マップ入場',
  desc: 'そのワールドのマップに初めて入ったとき',
};

/**
 * `cutscenes.json` を `${type}|${stageId}` をキーにした索引へ変換する。
 *
 * `trigger.stageId` を持たないカットシーン（将来の画面単位トリガー等）は
 * 空文字をキー後半に使う。各値には元の定義一式に加えて検索元の `id` を
 * `id` フィールドとして持たせる。
 *
 * Returns:
 *     Map<string, object>: `${type}|${stageId}` → カットシーン定義（`id` 付き）。
 */
function indexCutscenesByTrigger() {
  const index = new Map();
  for (const [id, def] of Object.entries(cutscenes)) {
    const { type, stageId } = def.trigger ?? {};
    index.set(`${type}|${stageId ?? ''}`, { id, ...def });
  }
  return index;
}

/**
 * カットシーンのステップ列に「ワールド解放アニメ」が含まれるかを判定する。
 *
 * `exitStage`（X-4）のカットシーンは `playAnimation: 'unlockStage'` を持ち、
 * 次ワールドの解放演出を担当する。ビュー側でバッジ表示するための判定。
 *
 * Args:
 *     def (object): カットシーン定義（`steps` を持つ）。
 *
 * Returns:
 *     boolean: 解放アニメを含むなら `true`。
 */
function hasWorldUnlock(def) {
  return (def?.steps ?? []).some((step) => step.playAnimation === 'unlockStage');
}

/**
 * `cutscenes.json` と `stages.json` を突き合わせ、ワールド → ステージ →
 * タイミングの時系列ツリーを組み立てる純関数。
 *
 * ステージは `world`（数値順）→ `number`（昇順）でソートし、同じワールドの
 * ステージをまとめる。各ワールドの先頭には `enterMapArea`（マップ入場）の
 * 差し込み口を、各ステージには `STAGE_TIMINGS` 5 種の差し込み口を並べ、
 * それぞれに該当するカットシーン（無ければ `null`）を割り当てる。これにより
 * 「1-1 入り口 → 1-1 → 1-2 …」という時系列フローを上から下へ描ける。
 *
 * Returns:
 *     Array<{
 *       world: string,
 *       mapEnter: ?object,
 *       stages: Array<{
 *         stageId: string,
 *         enemyId: ?string,
 *         timings: Array<{timing: object, cutscene: ?object}>,
 *       }>,
 *     }>: ワールド単位の時系列フロー。`cutscene` には `id` と
 *         `isWorldUnlock`（解放アニメ有無）を含む。
 */
function buildCutsceneFlow() {
  const index = indexCutscenesByTrigger();

  const stageIds = Object.keys(stagesData.stages).sort((a, b) => {
    const pa = parseStageId(a);
    const pb = parseStageId(b);
    if (!pa || !pb) return 0;
    const worldDiff = Number(pa.world) - Number(pb.world);
    return worldDiff !== 0 ? worldDiff : pa.number - pb.number;
  });

  const withMeta = (cutscene) =>
    cutscene ? { ...cutscene, isWorldUnlock: hasWorldUnlock(cutscene) } : null;

  const worlds = [];
  let current = null;
  for (const stageId of stageIds) {
    const parsed = parseStageId(stageId);
    if (!parsed) continue;
    const { world, number } = parsed;

    if (!current || current.world !== world) {
      current = { world, mapEnter: null, stages: [] };
      worlds.push(current);
    }

    if (number === 1) {
      current.mapEnter = withMeta(index.get(`${MAP_ENTER_TIMING.type}|${stageId}`) ?? null);
    }

    const timings = STAGE_TIMINGS.map((timing) => ({
      timing,
      cutscene: withMeta(index.get(`${timing.type}|${stageId}`) ?? null),
    }));

    current.stages.push({
      stageId,
      enemyId: stagesData.stages[stageId]?.enemyId ?? null,
      timings,
    });
  }

  return worlds;
}

export default buildCutsceneFlow;
