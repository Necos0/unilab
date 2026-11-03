import config from '../data/lanebattle_config.json';
import { deriveUnitDef } from './deriveUnitDef';

/**
 * ランタイムユニットを組み立てて `state.units` に積む（要件 1・8）。
 *
 * `deriveUnitDef(id)` の定義値を、交戦中に個体ごとに変化しうる値（`hp`・
 * `atkTimer`・鈍足で落ちる `slowMul` など）として**フラットなフィールドに
 * コピー**して持たせる。共有の `def` を壊さずに 1 体ずつ独立して状態を
 * 変えられるようにするため（既存 1 レーン版エンジンと同じ持ち方）。`def`
 * 参照も残し、後のユニットで描画のアニメ情報などに使う。DOM は生成せず
 * データだけを積む純関数（描画は分離、要件 8）。
 *
 * `x`（配置位置）は呼び出し側が渡す。自陣フリー配置では位置は必ず意図して
 * 決める値のため、本陣端などの暗黙デフォルトは設けない。今は headless
 * テストが指定し、後続の配置 UI（ユニット3）がレーン＋前後スロットから
 * 算出して渡す。
 *
 * Args:
 *     state (object): `createBattleState` が返す対戦状態。`units` に push する。
 *     spec (object): 出撃指定。
 *         side (string): `'you'` / `'cpu'`。
 *         id (string): キャラ ID（例: `'slime'`）。
 *         lane (number): レーン番号（0 / 1 / 2）。
 *         x (number): 出撃位置（仮想座標）。
 *
 * Returns:
 *     object: 積んだランタイムユニット。
 */
export function spawnUnit(state, { side, id, lane, x }) {
  const def = deriveUnitDef(id);
  const unit = {
    id,
    def,
    side,
    lane,
    x,
    hp: def.hp,
    maxHp: def.hp,
    atk: def.atk,
    spd: def.spd,
    range: def.range,
    detectRange: def.detectRange,
    laneReach: def.laneReach ?? 0,
    splash: def.splash,
    pierce: !!def.pierce,
    healOnAttack: def.healOnAttack ?? 0,
    slowOnAttack: def.slowOnAttack ?? null,
    supportAllLanes: def.supportAllLanes ?? false,
    attackAllLanes: def.attackAllLanes ?? false,
    rushBase: def.rushBase ?? false,
    deathbomb: def.deathbomb ?? 0,
    deathShield: def.deathShield ?? null,
    atkInterval: def.atkIntervalMs ?? config.attackIntervalMs,
    atkTimer: 0,
    slowT: 0,
    slowMul: 1,
    dead: false,
    deadT: 0,
  };
  state.units.push(unit);
  return unit;
}
