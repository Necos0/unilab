import config from '../data/lanebattle_config.json';
import { deriveUnitDef } from './deriveUnitDef';

/**
 * 各レーンのプレイヤー脅威量を返す（要件4-1）。
 *
 * 生存しているプレイヤーユニットの `atk`（火力）をレーンごとに合計する。
 * 脅威を火力で測るので、攻撃力のほぼ無い壁（ゴーレム等）は脅威が低く扱われ、
 * CPU が孤立した壁に過剰反応しない。DOM に触れない純関数。
 *
 * Args:
 *     state (object): 対戦状態。`units` を走査する。
 *
 * Returns:
 *     number[]: レーン 0/1/2 の脅威量（`atk` 合計）。
 */
export function evaluateLanes(state) {
  const threat = [0, 0, 0];
  for (const u of state.units) {
    if (u.dead || u.side !== 'you') continue;
    threat[u.lane] += u.atk;
  }
  return threat;
}

/**
 * あるレーンの脅威の主属性を 1 つ返す（要件4-1/2）。
 *
 * 渡されたユニット群（あるレーンのプレイヤーユニットを想定）から、カウンター
 * 表 `config.cpu.counter` を引くための単一キーを、優先順
 * 「`swarm` > `ranged` > `dps` > `other`」で決める。群れは `swarm` フラグ、
 * または頭数が `config.cpu.attr.swarmCount` 以上のとき。遠距離は `def.ranged`、
 * 高火力単体は `atk >= config.cpu.attr.dpsAtk`。該当が無ければ `other`。
 * ユニットが 1 体もいなければ null。DOM に触れない純関数。
 *
 * Args:
 *     units (object[]): 判定対象のユニット配列（そのレーンのプレイヤー側）。
 *
 * Returns:
 *     string|null: `'swarm'` / `'ranged'` / `'dps'` / `'other'`、または null。
 */
export function classifyThreat(units) {
  const live = units.filter((u) => !u.dead);
  if (live.length === 0) return null;
  const { attr } = config.cpu;
  if (live.length >= attr.swarmCount || live.some((u) => u.def.swarm)) return 'swarm';
  if (live.some((u) => u.def.ranged)) return 'ranged';
  if (live.some((u) => u.atk >= attr.dpsAtk)) return 'dps';
  return 'other';
}

/*
 * 「返す属性」→ その候補カードが該当するかの判定。4-1 の導出属性（aoe/ranged）
 * と config.cpu.attr の閾値（fastSpd/tankyHp/dpsAtk）で見る。
 */
const MATCHERS = {
  aoe: (d) => d.aoe,
  fastMelee: (d) => !d.ranged && d.spd >= config.cpu.attr.fastSpd,
  tanky: (d) => d.hp >= config.cpu.attr.tankyHp,
  dps: (d) => d.atk >= config.cpu.attr.dpsAtk,
};

/**
 * 「返す属性」に合う、いま出せる最安カードの手札 index を返す（要件4-2）。
 *
 * 手札のうち「返す属性（`counter[主属性]` が示すもの）に該当し、かつ現在の
 * エナジーで買えるカード」を集め、その中で最安の手札 index を返す。該当かつ
 * 買えるカードが無ければ **-1**（＝良い手なし）を返し、安カードのジャンク
 * 出撃はしない。「実際に出すか・貯めるか・切迫時に妥協するか」の判断は
 * `decideCpu`（後続）に委ねる。最安を選ぶのはエナジー効率のため。純関数。
 *
 * Args:
 *     answerAttr (string): 返す属性（`'aoe'`/`'fastMelee'`/`'tanky'`/`'dps'`）。
 *     hand (string[]): CPU の手札（カード ID の配列）。
 *     energy (number): CPU の現在エナジー。
 *
 * Returns:
 *     number: 出せる該当カードの手札 index。無ければ -1。
 */
export function pickAnswer(answerAttr, hand, energy) {
  const match = MATCHERS[answerAttr];
  if (!match) return -1;
  const opts = hand
    .map((id, i) => ({ i, d: deriveUnitDef(id) }))
    .filter((o) => match(o.d) && o.d.cost * config.costToEnergy <= energy);
  if (opts.length === 0) return -1;
  return opts.reduce((a, b) => (b.d.cost < a.d.cost ? b : a)).i;
}

/**
 * 出すカードの前後スロットを決める（要件4-3）。
 *
 * 遠距離（`ranged`）は後方(0)＝自陣の深い所からカイトして一方的に削る。近接/範囲は
 * 「侵攻してきた敵の本陣側」で迎え撃つ：そのレーンで最も本陣に近い敵 `frontX` より
 * 本陣側（x 大）にあるスロットのうち、最も前寄り（x 小）を選ぶ。これで浅い敵は前線
 * で、深く入った敵はその直前（自陣側）で正面から受けられ、後ろに湧いて追いかける形
 * にならない。該当スロットが無ければ最後方(0)で受ける（本陣防衛と協調）。純関数。
 *
 * Args:
 *     state (object): 対戦状態。
 *     lane (number): 出すレーン。
 *     cardDef (object): 出すカードの `deriveUnitDef` 結果。
 *
 * Returns:
 *     number: 前後スロット（0=後方 / 1=中 / 2=前線）。
 */
export function choosePlacement(state, lane, cardDef) {
  if (cardDef.ranged) return 0;
  const slots = config.deploy.cpuSlotXs;
  let frontX = -Infinity;
  for (const u of state.units) {
    if (!u.dead && u.side === 'you' && u.lane === lane && u.x > frontX) frontX = u.x;
  }
  let best = 0;
  let bestX = Infinity;
  for (let i = 0; i < slots.length; i += 1) {
    if (slots[i] > frontX && slots[i] < bestX) {
      bestX = slots[i];
      best = i;
    }
  }
  return best;
}

/**
 * そのレーンで敵が自陣本陣に迫っているか（＝妥協して受けるべきか）を返す（要件4-4）。
 *
 * プレイヤーユニットは左から右（CPU 本陣 `cpuBaseX`）へ進む。本陣とユニットの
 * 距離 `cpuBaseX - u.x` が `config.cpu.urgentDist` 以下なら「切迫」とみなす。
 * `decideCpu` はこれが真のとき、良い手が無くても手持ちで妥協して受ける。純関数。
 *
 * Args:
 *     state (object): 対戦状態。
 *     lane (number): 判定するレーン。
 *
 * Returns:
 *     boolean: 切迫していれば true。
 */
export function isUrgent(state, lane) {
  const baseX = config.field.cpuBaseX;
  return state.units.some(
    (u) => !u.dead && u.side === 'you' && u.lane === lane && baseX - u.x <= config.cpu.urgentDist,
  );
}

/**
 * 買える手札からランダムに 1 枚選び、手札 index を返す（要件4-4）。
 *
 * 「良い手（該当カウンター）は無いが切迫していて出さざるを得ない」ときの妥協や、
 * 脅威ゼロ＋エナジー潤沢のカウンター攻めで使う。通常の反応は `pickAnswer`
 * （該当のみ）を使い、こちらは限定的に使う。買えるカードが無ければ -1。純関数。
 *
 * Args:
 *     hand (string[]): CPU の手札（カード ID）。
 *     energy (number): CPU の現在エナジー。
 *     rng (function): 0〜1 の乱数を返す関数。
 *
 * Returns:
 *     number: 選んだ手札 index。無ければ -1。
 */
export function pickAnyAffordable(hand, energy, rng) {
  const opts = hand
    .map((id, i) => ({ i, cost: deriveUnitDef(id).cost * config.costToEnergy }))
    .filter((o) => o.cost <= energy);
  if (opts.length === 0) return -1;
  return opts[Math.floor(rng() * opts.length)].i;
}

/**
 * CPU の 1 回分の意思決定（要件4・5）。
 *
 * 反応間隔（`brain.reactT`）でゲートし、`missChance` で時々わざと見送る（弱く
 * する）。`evaluateLanes` で最大脅威のレーンを選び、脅威があれば `classifyThreat`
 * → `counter` で返す属性を決め（`accuracy` で最適 or 雑に `dps`）、`pickAnswer`
 * で出せる該当カードを探す。良い手が無ければ、切迫（`isUrgent`）していなければ
 * 出さずに貯め、切迫していれば手持ちで妥協する（`pickAnyAffordable`）。脅威が
 * 無くエナジーが潤沢なら簡易のカウンター攻めをする。配置は `choosePlacement`。
 * 返り値の出撃コマンドは駆動側が `applyDeploy(側=cpu)` に流す。乱数は引数の
 * `rng` に集約（純関数）。
 *
 * Args:
 *     brain (object): CPU の思考状態。`reactT`（次の判断までの残り時間）を持つ。
 *     state (object): 対戦状態。
 *     cpuHand (string[]): CPU の手札（カード ID）。
 *     dt (number): 経過ミリ秒。
 *     diff (object): 難易度プリセット（reactionMs/accuracy/missChance）。
 *     rng (function): 0〜1 の乱数を返す関数。
 *
 * Returns:
 *     object|null: 出撃コマンド `{ lane, slot, handIndex }`、または null（何もしない）。
 */
export function decideCpu(brain, state, cpuHand, dt, diff, rng) {
  brain.reactT -= dt;
  if (brain.reactT > 0) return null;
  brain.reactT = diff.reactionMs;
  if (rng() < diff.missChance) return null;

  const energy = state.energy.cpu;
  const threat = evaluateLanes(state);
  let lane = 0;
  for (let l = 1; l < 3; l += 1) if (threat[l] > threat[lane]) lane = l;

  if (threat[lane] > 0) {
    const laneUnits = state.units.filter((u) => !u.dead && u.side === 'you' && u.lane === lane);
    const ideal = config.cpu.counter[classifyThreat(laneUnits)] ?? config.cpu.counter.other;
    const answerAttr = rng() < diff.accuracy ? ideal : 'dps';
    let idx = pickAnswer(answerAttr, cpuHand, energy);
    if (idx < 0) {
      const highEnergy = energy >= config.energyMax * config.cpu.pushEnergyFrac;
      if (!isUrgent(state, lane) && !highEnergy) return null; // 切迫せず余力もない → 貯める
      idx = pickAnyAffordable(cpuHand, energy, rng); // 切迫 or エナジー上限近く → 妥協して出す
      if (idx < 0) return null;
    }
    const def = deriveUnitDef(cpuHand[idx]);
    return { lane, slot: choosePlacement(state, lane, def), handIndex: idx };
  }

  if (energy >= config.energyMax * config.cpu.pushEnergyFrac) {
    const idx = pickAnyAffordable(cpuHand, energy, rng);
    if (idx >= 0) {
      const def = deriveUnitDef(cpuHand[idx]);
      return { lane: Math.floor(rng() * 3), slot: def.ranged ? 1 : 2, handIndex: idx };
    }
  }
  return null;
}
