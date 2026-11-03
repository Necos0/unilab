import config from '../data/lanebattle_config.json';
import { deriveUnitDef } from './deriveUnitDef';
import { spawnUnit } from './spawnUnit';

/**
 * デプロイ（出撃）コマンドを 1 つ処理する（要件 2・3・8）。
 *
 * 「誰が・どのカードを・どのレーン・自陣のどの前後スロットに出すか」という
 * 入力コマンドを受け、コスト（`deriveUnitDef(id).cost × costToEnergy`）を
 * その陣営のエナジーと比べる。足りれば `energy` を減らし、`energySpent`
 * （スコア用の累計）に足し、`spawnUnit` で場に出す。足りなければ何もせず
 * `false` を返す（UI 側で弾く）。出撃位置 x は `config.deploy.*SlotXs[slot]`
 * から引く。これらのスロット x はすべて中央ラインより自陣側なので、敵陣には
 * 置けない（要件 2-2 がデータで担保される）。
 *
 * 群れ（`swarmSize > 1`）は 1 枚で複数体を同じレーンに湧かせる。コストは
 * 上限チェックも支払いも**1 回だけ**行い、体数ぶん `spawnUnit` を呼ぶ。各体は
 * スロット x を中心に `config.swarmSpread` 間隔で前後にずらして配置し、初期の
 * 重なりを避ける（動き出せば `stepSim` 側の追い越し禁止＝`stackGap` が間隔を
 * 保つ）。非群れは `swarmSize = 1` なのでスロット x にそのまま 1 体出る。
 *
 * プレイヤーも CPU（後続）も将来のネットワーク対戦も、出撃はすべてこの同じ
 * 関数を通す（入力駆動。要件 8）。DOM に触れない純関数。
 *
 * Args:
 *     state (object): 対戦状態。`energy` / `energySpent` / `units` を更新する。
 *     cmd (object): 出撃コマンド。
 *         side (string): `'you'` / `'cpu'`。
 *         id (string): キャラ ID。
 *         lane (number): レーン番号（0 / 1 / 2）。
 *         slot (number): 自陣内の前後スロット（0=後方 / 1=中 / 2=前方）。
 *
 * Returns:
 *     boolean: 出撃できたら true、エナジー不足なら false。
 */
export function applyDeploy(state, { side, id, lane, slot }) {
  const def = deriveUnitDef(id);
  const cost = def.cost * config.costToEnergy;
  if (state.energy[side] < cost) return false;
  state.energy[side] -= cost;
  state.energySpent[side] += cost;
  const slotXs = side === 'you' ? config.deploy.youSlotXs : config.deploy.cpuSlotXs;
  const x0 = slotXs[slot];
  const n = def.swarmSize;
  // 群れは 1 枚で n 体。コストは上で 1 回だけ払い、x を中心から等間隔にずらして
  // 湧かせる（初期の重なり回避。進み出せば moveToward の stackGap が間隔を保つ）。
  for (let i = 0; i < n; i += 1) {
    const offset = (i - (n - 1) / 2) * config.swarmSpread;
    spawnUnit(state, { side, id, lane, x: x0 + offset });
  }
  return true;
}
