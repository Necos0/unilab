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
  const cost = deriveUnitDef(id).cost * config.costToEnergy;
  if (state.energy[side] < cost) return false;
  state.energy[side] -= cost;
  state.energySpent[side] += cost;
  const slotXs = side === 'you' ? config.deploy.youSlotXs : config.deploy.cpuSlotXs;
  spawnUnit(state, { side, id, lane, x: slotXs[slot] });
  return true;
}
