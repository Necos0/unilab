import config from '../data/lanebattle_config.json';
import { createBattleState } from './battleState';
import { applyDeploy } from './applyDeploy';
import { stepSim } from './stepSim';
import { createDeck } from './createDeck';
import { deriveUnitDef } from './deriveUnitDef';
import { decideCpu } from './cpuBrain';

const FIXED_MS = 1000 / 60;
const HUD_MS = 66;

/**
 * カード ID の配列をシャッフルした新しい配列を返す（毎戦の手札の並びを変える）。
 *
 * 入力配列は書き換えず複製してから並べ替える。乱数は入力層の都合なので
 * `Math.random` を使う（PvP 用の seed 付き決定的シャッフルは必要になったら
 * 差し込む）。
 *
 * Args:
 *     ids (string[]): シャッフルするカード ID の配列。
 *
 * Returns:
 *     string[]: 並べ替えた新しい配列。
 */
function shuffle(ids) {
  const a = ids.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * 対戦の駆動層（純シムを rAF ループで回し、デッキ・HUD もつなぐ。要件 3・8）。
 *
 * React に依存しない。内部で `createBattleState` の状態とプレイヤーの
 * `createDeck`（6 枚・手札 3・出したら最後尾）を 1 組ずつ持つ。
 * `requestAnimationFrame` ループで実時間 dt を貯め、`FIXED_MS`（1/60 秒）刻みで
 * `stepSim` を回す（固定タイムステップ＝決定的）。毎フレーム `onFrame(state, dt)`
 * を呼ぶ（描画のフック）。HUD（エナジー・手札・次カード）は `HUD_MS` 間引きで
 * `onHud(hud)` に渡し、React の再描画を毎フレームにしない。出撃は
 * `deploy(handIndex, lane, slot)`：手札の該当カードで `applyDeploy` し、成功した
 * ときだけデッキをローテ（最後尾へ）する。敵（CPU）も内部に 1 組のデッキと思考
 * 状態を持ち、毎フレーム `decideCpu` で反応してプレイヤーと同じ `applyDeploy` から
 * 出撃する（要件4・8）。難易度は `difficulty`（既定 `config.cpu.difficulty.normal`）。
 *
 * Args:
 *     opts (object):
 *         deckIds (string[]): プレイヤーの 6 枚デッキ（キャラ ID）。
 *         state (object): 使う対戦状態（任意）。省略時は内部で生成する。UI と
 *             同じ state オブジェクトを共有したいとき（本陣 HP の表示など）に渡す。
 *         onFrame (function): 毎フレーム `(state, dt)` を渡す（描画用）。
 *         onHud (function): HUD 情報 `{energy, energyMax, hand, next}` を渡す。
 *         difficulty (object): CPU 難易度プリセット（任意）。省略時は
 *             `config.cpu.difficulty.normal`。
 *
 * Returns:
 *     object: 制御ハンドル。
 *         start (function): ループを開始する。
 *         deploy (function): `(handIndex, lane, slot)` で出撃（true/false）。
 *         getState (function): 現在の state を返す（テスト・確認用）。
 *         destroy (function): ループ停止・破棄。
 */
export function createRuntime({ deckIds, state: initialState, onFrame, onHud, difficulty } = {}) {
  const state = initialState ?? createBattleState();
  const deck = createDeck(shuffle(deckIds ?? []));
  const cpuDeck = createDeck(shuffle(config.cpu.deck ?? []));
  const diff = difficulty ?? config.cpu.difficulty.normal;
  const cpuBrain = { reactT: diff.reactionMs };
  let running = false;
  let acc = 0;
  let last = 0;
  let rafId = 0;
  let killed = false;
  let hudT = 0;

  function buildHud() {
    const hand = deck.hand().map((id) => {
      const d = deriveUnitDef(id);
      const cost = d.cost * config.costToEnergy;
      return { id, name: d.name, cost, disabled: state.energy.you < cost };
    });
    const nextId = deck.nextPreview();
    return {
      energy: state.energy.you,
      energyMax: config.energyMax,
      regenMul: state.regenMul,
      hand,
      next: nextId ? { id: nextId, name: deriveUnitDef(nextId).name } : null,
    };
  }

  function frame(now) {
    if (killed) return;
    const dt = Math.min(100, now - last);
    last = now;
    if (running) {
      acc += dt;
      while (acc >= FIXED_MS) {
        stepSim(state, FIXED_MS);
        acc -= FIXED_MS;
      }
      const cmd = decideCpu(cpuBrain, state, cpuDeck.hand(), dt, diff, Math.random);
      if (cmd) {
        const id = cpuDeck.hand()[cmd.handIndex];
        if (applyDeploy(state, { side: 'cpu', id, lane: cmd.lane, slot: cmd.slot })) {
          cpuDeck.play(cmd.handIndex);
        }
      }
      onFrame?.(state, dt);
      hudT += dt;
      if (hudT >= HUD_MS) {
        hudT = 0;
        onHud?.(buildHud());
      }
    }
    rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      running = true;
      last = performance.now();
      onHud?.(buildHud());
      if (!rafId) rafId = requestAnimationFrame(frame);
    },
    deploy(handIndex, lane, slot) {
      const id = deck.hand()[handIndex];
      if (!id) return false;
      const ok = applyDeploy(state, { side: 'you', id, lane, slot });
      if (ok) {
        deck.play(handIndex);
        onHud?.(buildHud());
      }
      return ok;
    },
    getState() {
      return state;
    },
    destroy() {
      killed = true;
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}
