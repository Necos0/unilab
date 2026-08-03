import enemiesData from '../../../data/enemies.json';
import config from '../data/lanebattle_config.json';
import unitsData from '../data/lanebattle_units.json';

/*
 * 上書き定義（`lanebattle_units.json` の overrides）を id で引ける map。
 * 本編の enemies.json は読み取り専用で参照するだけで、書き換えない。
 */
const OVERRIDES = Object.fromEntries(unitsData.overrides.map((o) => [o.id, o]));

/**
 * 編成に出せるキャラ ID の一覧（許可リスト）を返す。
 *
 * `lanebattle_units.json` の `roster` をそのまま返す。`dragon_final`
 * （隠しボス）は含めない運用。
 *
 * Returns:
 *     string[]: ロスターのキャラ ID 配列。
 */
export function rosterIds() {
  return unitsData.roster;
}

/**
 * キャラ 1 体分のミニゲーム用ユニット定義を組み立てる。
 *
 * 既定ステータス（コスト・攻撃・速さ・間合い等）を本編 `enemies.json`
 * の `maxHp` / `sizeRatio` から算出し、`lanebattle_units.json` の上書きが
 * あればそれで置き換える（要件7・14）。小型ほど安く速く、大型ほど高く
 * 硬い。スプライト描画に必要なアニメ情報（フレーム数・1 コマ時間）も
 * enemies.json から取り込む。
 *
 * Args:
 *     enemyId (string): キャラ ID。例: `"slime"`。
 *
 * Returns:
 *     object: ユニット定義。id / name / hp / cost / atk / spd / range /
 *         splash / deathbomb / ability / desc / sizeRatio と、
 *         idleFrames / idleMs / deadFrames / deadMs を持つ。
 */
export function deriveUnitDef(enemyId) {
  const e = enemiesData.enemies.find((x) => x.id === enemyId);
  const hp = e?.maxHp ?? 20;
  const size = e?.sizeRatio ?? 0.7;
  const d = config.derive;

  const base = {
    id: enemyId,
    name: e?.displayName ?? enemyId,
    hp,
    cost: Math.max(1, Math.round(hp / d.costDiv)),
    atk: Math.max(d.atkMin, Math.round(hp / d.atkDiv)),
    spd: Math.round(d.spdBase + (1 - size) * d.spdSizeMul),
    range: config.contactRangeDefault,
    splash: 0,
    deathbomb: 0,
    pierce: false,
    healOnAttack: 0,
    slowOnAttack: null,
    deathShield: null,
    atkIntervalMs: null,
    legend: false,
    ability: '近接',
    desc: 'ふつうの近接攻撃。',
    sizeRatio: size,
    idleFrames: e?.animations?.idle?.frameCount ?? 1,
    idleMs: e?.animations?.idle?.frameDurationMs ?? 220,
    deadFrames: e?.animations?.dead?.frameCount ?? 1,
    deadMs: e?.animations?.dead?.frameDurationMs ?? 170,
  };

  return { ...base, ...(OVERRIDES[enemyId] ?? {}) };
}

/**
 * ロスター全体のユニット定義を、HP 昇順で返す（一覧表示用）。
 *
 * Returns:
 *     object[]: `deriveUnitDef` の結果を HP 昇順に並べた配列。
 */
export function rosterDefs() {
  return rosterIds()
    .map((id) => deriveUnitDef(id))
    .sort((a, b) => a.hp - b.hp);
}
