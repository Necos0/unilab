import config from '../data/lanebattle_config.json';
import { deriveUnitDef } from './deriveUnitDef';
import { createDeck } from './createDeck';
import { createLaneSprite } from './laneSprite';

const VW = config.virtualWidth;
const HUD_INTERVAL_MS = 66;

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * レーン戦の対戦エンジンを生成する（要件5・6・7・9・10・11）。
 *
 * React に依存しない素のオブジェクト。内部で `requestAnimationFrame`
 * ループを1本持ち、`running` の間だけ毎フレーム `tick` を回す。ユニットは
 * `createLaneSprite` が作る DOM をエンジンが直接更新するため、多数の
 * ユニットが動いても React の再レンダリングは発生しない。プレイヤーと
 * CPU は同じ `createDeck`（6枚デッキ・手札3・ローテ）で戦う。エネルギーは
 * 時間回復し、経過に応じて回復が加速する（エスカレーション）。数値は
 * すべて `lanebattle_config.json` と各ユニット定義（`deriveUnitDef`）から
 * 読み、ロジックには定数を埋め込まない（要件14）。
 *
 * Args:
 *     opts (object):
 *         laneEl (HTMLElement): ユニット・エフェクトを描画するレーン要素。
 *         playerDeckIds (string[]): プレイヤーの6枚デッキ。
 *         cpuDeckIds (string[]): CPU の6枚デッキ（省略時は config.cpu.deck）。
 *         onHud (function): HUD 値を通知するコールバック（間引き）。
 *         onEnd (function): 決着時に `{ win, score, kills }` を通知する。
 *
 * Returns:
 *     object: 制御ハンドル。
 *         start (function): 状態を初期化して対戦を開始（再戦にも使う）。
 *         deployCard (function): プレイヤーの手札 index を出撃させる。
 *         setDiffMode (function): 敵味方の見分けモードを切り替える。
 *         destroy (function): ループ停止・DOM 掃除・破棄。
 */
export function createLaneBattleEngine({
  laneEl,
  playerDeckIds,
  cpuDeckIds,
  onHud,
  onEnd,
}) {
  const st = {
    running: false,
    killed: false,
    units: [],
    energy: 0,
    cpuEnergy: 0,
    elapsed: 0,
    regenMul: 1,
    energySpent: 0,
    kills: 0,
    cpuPlayT: 0,
    playerDeck: null,
    cpuDeck: null,
    hudT: 0,
    ended: false,
    youShieldT: 0,
    youShieldMul: 1,
    cpuShieldT: 0,
    cpuShieldMul: 1,
    youGuardHp: 0,
    cpuGuardHp: 0,
    youGuardT: 0,
    cpuGuardT: 0,
  };

  /* ユニットへのダメージ適用。死亡時シールド（サソリ）が有効な側は被ダメを軽減。 */
  function dealDamage(target, amount) {
    const shieldT = target.side === 'you' ? st.youShieldT : st.cpuShieldT;
    const mul = shieldT > 0 ? (target.side === 'you' ? st.youShieldMul : st.cpuShieldMul) : 1;
    target.hp -= amount * mul;
  }

  const defCache = new Map();
  function defOf(id) {
    if (!defCache.has(id)) defCache.set(id, deriveUnitDef(id));
    return defCache.get(id);
  }

  function clearUnits() {
    st.units.forEach((u) => u.sprite.remove());
    st.units = [];
    laneEl.querySelectorAll('.ring, .shot').forEach((n) => n.remove());
  }

  /* ---- 軽量エフェクト（純DOM。ゲームループとは独立に自然消滅する） ---- */
  function fxShot(fromX, toX, side) {
    const s = document.createElement('div');
    s.className = `shot ${side}`;
    s.style.left = `${(fromX / VW) * 100}%`;
    laneEl.appendChild(s);
    // 強制リフローで開始位置を確定させてから移動（CSS transition）
    void s.offsetWidth;
    s.style.left = `${(toX / VW) * 100}%`;
    setTimeout(() => s.remove(), 190);
  }
  function fxRing(cx, radius, side, bomb) {
    const r = document.createElement('div');
    r.className = `ring ${side}${bomb ? ' bomb' : ''}`;
    r.style.left = `${(cx / VW) * 100}%`;
    r.style.width = `${((radius * 2) / VW) * 100}%`;
    r.style.height = `${bomb ? 34 : 22}px`;
    laneEl.appendChild(r);
    void r.offsetWidth;
    r.style.transform = 'translate(-50%, 0) scale(1)';
    r.style.opacity = '0';
    setTimeout(() => r.remove(), 330);
  }

  function spawn(id, side) {
    const def = defOf(id);
    const sprite = createLaneSprite(laneEl, def, side);
    const u = {
      id,
      def,
      side,
      x: side === 'you' ? config.youBaseX : config.cpuBaseX,
      hp: def.hp,
      maxHp: def.hp,
      atk: def.atk,
      spd: def.spd,
      range: def.range,
      splash: def.splash,
      deathbomb: def.deathbomb,
      pierce: !!def.pierce,
      healOnAttack: def.healOnAttack ?? 0,
      slowOnAttack: def.slowOnAttack ?? null,
      deathShield: def.deathShield ?? null,
      atkInterval: def.atkIntervalMs ?? config.attackIntervalMs,
      slowT: 0,
      slowMul: 1,
      sprite,
      atkTimer: 0,
      dead: false,
      deadT: 0,
      animT: 0,
      frame: 0,
    };
    st.units.push(u);
    sprite.setPos((u.x / VW) * 100);
    return u;
  }

  /*
   * 攻撃解決。攻撃対象 target が null なら城攻撃。特殊能力の複合を扱う：
   * 遠距離（range>90）は弾演出、ヒーラー（healOnAttack）は攻撃時に味方回復、
   * スロー（slowOnAttack）は攻撃時に敵全体を減速、貫通（pierce）は一直線上の
   * 敵全員に、範囲（splash）は着弾点まわりの敵全員に、いずれも無ければ単体に。
   */
  function resolveAttack(u, target) {
    const dir = u.side === 'you' ? 1 : -1;
    const enemyBaseX = u.side === 'you' ? config.cpuBaseX : config.youBaseX;
    if (u.range > 90) fxShot(u.x, target ? target.x : enemyBaseX, u.side);

    // ヒーラー：攻撃と同時に味方全体を回復
    if (u.healOnAttack > 0) {
      for (const o of st.units) {
        if (o.dead || o.side !== u.side) continue;
        o.hp = Math.min(o.maxHp, o.hp + u.healOnAttack);
      }
      fxRing(u.x, 44, u.side, false);
    }
    // スロー：攻撃と同時に敵全体を減速
    if (u.slowOnAttack) {
      for (const o of st.units) {
        if (o.dead || o.side === u.side) continue;
        o.slowT = u.slowOnAttack.ms;
        o.slowMul = u.slowOnAttack.mul;
      }
    }

    if (target && u.pierce) {
      for (const o of st.units) {
        if (o.dead || o.side === u.side) continue;
        const ahead = (o.x - u.x) * dir;
        if (ahead > 0 && ahead <= u.range) dealDamage(o, u.atk);
      }
      fxRing(u.x + (dir * u.range) / 2, u.range / 2, u.side, false);
    } else if (target && u.splash > 0) {
      for (const o of st.units) {
        if (o.dead || o.side === u.side) continue;
        if (Math.abs(o.x - target.x) <= u.splash) dealDamage(o, u.atk);
      }
      fxRing(target.x, u.splash, u.side, false);
    } else if (target) {
      dealDamage(target, u.atk);
    }
  }

  /* ユニットが敵の守り神（ヒーロー/ドラゴン）を攻撃する。到達＝即勝ちではなく、守り神を削る。 */
  function attackGuardian(u) {
    if (u.range > 90) {
      fxShot(u.x, u.side === 'you' ? config.cpuBaseX : config.youBaseX, u.side);
    }
    if (u.side === 'you') st.cpuGuardHp -= u.atk;
    else st.youGuardHp -= u.atk;
  }

  /* 守り神の迎撃：自陣ベースの range 内で最も近い敵ユニット1体を撃つ（漏れた少数を一掃）。 */
  function guardianTick(dt, side, baseX) {
    const key = side === 'you' ? 'youGuardT' : 'cpuGuardT';
    st[key] -= dt;
    if (st[key] > 0) return;
    st[key] = config.guardian.intervalMs;
    let target = null;
    let best = Infinity;
    for (const o of st.units) {
      if (o.dead || o.side === side) continue;
      const d = Math.abs(o.x - baseX);
      if (d <= config.guardian.range && d < best) {
        best = d;
        target = o;
      }
    }
    if (target) {
      dealDamage(target, config.guardian.atk);
      fxShot(baseX, target.x, side);
    }
  }

  function cpuAI(dt) {
    // 敵（CPU）はエナジー回復に補正（config.cpu.energyRegenMul）をかけて強くする。
    const cpuRegenMul = config.cpu.energyRegenMul ?? 1;
    st.cpuEnergy = Math.min(
      config.energyMax,
      st.cpuEnergy + (dt / 1000) * config.energyRegenPerSec * st.regenMul * cpuRegenMul,
    );
    st.cpuPlayT -= dt;
    if (st.cpuPlayT > 0) return;

    const hand = st.cpuDeck.hand();
    const affordable = hand
      .map((id, i) => ({ id, i, cost: defOf(id).cost * config.costToEnergy }))
      .filter((o) => st.cpuEnergy >= o.cost);
    if (affordable.length > 0) {
      const pick = affordable[Math.floor(Math.random() * affordable.length)];
      st.cpuEnergy -= pick.cost;
      spawn(pick.id, 'cpu');
      st.cpuDeck.play(pick.i);
      st.cpuPlayT = config.cpu.minGapMs + Math.random() * config.cpu.randGapMs;
    } else {
      st.cpuPlayT = 300;
    }
  }

  function advanceFrame(u, dt) {
    const dur = u.dead ? u.def.deadMs : u.def.idleMs;
    const frames = u.dead ? u.def.deadFrames : u.def.idleFrames;
    u.animT += dt;
    if (u.animT < dur) return;
    u.animT = 0;
    if (u.dead) {
      if (u.frame < frames - 1) u.frame += 1; // dead は最後で止める
    } else {
      u.frame = (u.frame + 1) % frames;
    }
    u.sprite.setFrame(u.dead ? 'dead' : 'idle', u.frame);
  }

  /*
   * スコア（勝利時のみ）。速く・少ない出撃ほど高い。時間と出撃数がペナルティ。
   * 敗北は 0。手こずるほど高得点になる「与ダメ加点」は廃止（要件11 改）。
   */
  function computeScore(win) {
    if (!win) return 0;
    const sec = st.elapsed / 1000;
    const raw =
      config.score.winBase -
      sec * config.score.timePenaltyPerSec -
      st.energySpent * config.score.energyPenalty;
    return Math.max(config.score.min, Math.round(raw));
  }

  function finish(win) {
    if (st.ended) return;
    st.ended = true;
    st.running = false;
    onEnd?.({
      win,
      score: computeScore(win),
      timeSec: st.elapsed / 1000,
      energyUsed: st.energySpent,
    });
  }

  function hudPayload() {
    const hand = st.playerDeck.hand().map((id) => {
      const d = defOf(id);
      const cost = d.cost * config.costToEnergy;
      return { id, name: d.name, cost, disabled: st.energy < cost };
    });
    const nextId = st.playerDeck.nextPreview();
    return {
      running: st.running,
      energy: st.energy,
      energyMax: config.energyMax,
      timeSec: Math.max(0, st.elapsed) / 1000,
      energyUsed: st.energySpent,
      youGuardHp: Math.max(0, st.youGuardHp),
      cpuGuardHp: Math.max(0, st.cpuGuardHp),
      guardMax: config.guardian.hp,
      score: computeScore(true), // 「今勝ったら」の暫定スコア（速く・エナジー消費が少ないほど高い）
      hand,
      next: nextId ? { id: nextId, name: defOf(nextId).name } : null,
    };
  }
  function pushHud() {
    onHud?.(hudPayload());
  }

  function tick(dt) {
    const s = dt / 1000;
    st.elapsed += dt;
    // 段階式エスカレーション：0-15秒=1倍 / 15-30秒=2倍 / 30-45秒=3倍 … （maxMul で頭打ち）
    st.regenMul = Math.min(
      config.escalation.maxMul,
      1 + Math.floor(st.elapsed / config.escalation.stepMs),
    );
    st.energy = Math.min(
      config.energyMax,
      st.energy + s * config.energyRegenPerSec * st.regenMul,
    );
    if (st.youShieldT > 0) st.youShieldT -= dt;
    if (st.cpuShieldT > 0) st.cpuShieldT -= dt;
    cpuAI(dt);
    guardianTick(dt, 'you', config.youBaseX);
    guardianTick(dt, 'cpu', config.cpuBaseX);

    for (const u of st.units) {
      advanceFrame(u, dt);
      if (u.dead) {
        u.deadT += dt;
        continue;
      }
      if (u.slowT > 0) u.slowT -= dt;
      const dir = u.side === 'you' ? 1 : -1;
      let target = null;
      let tdist = Infinity;
      for (const o of st.units) {
        if (o.dead || o.side === u.side) continue;
        const ahead = (o.x - u.x) * dir;
        if (ahead > 0 && ahead < tdist) {
          tdist = ahead;
          target = o;
        }
      }
      const guardX = u.side === 'you' ? config.cpuBaseX : config.youBaseX;
      const guardAhead = (guardX - u.x) * dir;
      if (target && tdist <= u.range) {
        u.atkTimer -= dt;
        if (u.atkTimer <= 0) {
          u.atkTimer = u.atkInterval;
          resolveAttack(u, target);
        }
      } else if (!target && guardAhead <= u.range) {
        // 敵ユニットがおらず守り神が間合い内 → 守り神を攻撃（削り切れば勝ち）
        u.atkTimer -= dt;
        if (u.atkTimer <= 0) {
          u.atkTimer = u.atkInterval;
          attackGuardian(u);
        }
      } else {
        const base = u.slowT > 0 ? u.spd * u.slowMul : u.spd;
        const speed = base * config.moveSpeedScale;
        u.x += dir * speed * s;
        u.sprite.setPos((u.x / VW) * 100);
      }
    }

    // 死亡処理（＋死亡時 範囲爆弾）と、HP バー更新
    st.units = st.units.filter((u) => {
      if (u.hp <= 0 && !u.dead) {
        u.dead = true;
        u.deadT = 0;
        u.frame = 0;
        u.animT = 0;
        u.sprite.setFrame('dead', 0);
        u.sprite.hideHp();
        if (u.side === 'cpu') {
          st.kills += 1;
        }
        if (u.deathbomb > 0) {
          for (const o of st.units) {
            if (o.dead || o.side === u.side) continue;
            if (Math.abs(o.x - u.x) <= u.deathbomb) dealDamage(o, u.atk * 3);
          }
          fxRing(u.x, u.deathbomb, u.side, true);
        }
        if (u.deathShield) {
          if (u.side === 'you') {
            st.youShieldT = u.deathShield.ms;
            st.youShieldMul = u.deathShield.mul;
          } else {
            st.cpuShieldT = u.deathShield.ms;
            st.cpuShieldMul = u.deathShield.mul;
          }
          fxRing(u.x, 60, u.side, true);
        }
      }
      if (!u.dead) u.sprite.setHp(u.hp / u.maxHp);
      const deadDone = u.def.deadMs * u.def.deadFrames + 250;
      if (u.dead && u.deadT > deadDone) {
        u.sprite.remove();
        return false;
      }
      return true;
    });

    if (st.cpuGuardHp <= 0) finish(true);
    else if (st.youGuardHp <= 0) finish(false);

    st.hudT += dt;
    if (st.hudT >= HUD_INTERVAL_MS) {
      st.hudT = 0;
      pushHud();
    }
  }

  let last = performance.now();
  function frame(now) {
    if (st.killed) return;
    const dt = Math.min(60, now - last);
    last = now;
    if (st.running) tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    start() {
      clearUnits();
      st.energy = config.energyStart;
      st.cpuEnergy = config.cpu.energyStart;
      st.elapsed = 0;
      st.regenMul = 1;
      st.energySpent = 0;
      st.kills = 0;
      st.cpuPlayT = config.cpu.firstPlayMs;
      st.ended = false;
      st.youShieldT = 0;
      st.youShieldMul = 1;
      st.cpuShieldT = 0;
      st.cpuShieldMul = 1;
      st.youGuardHp = config.guardian.hp;
      st.cpuGuardHp = config.guardian.hp;
      st.youGuardT = config.guardian.intervalMs;
      st.cpuGuardT = config.guardian.intervalMs;
      // 手札の初期並びは毎戦シャッフル（編成の並び順で固定にしない）
      st.playerDeck = createDeck(shuffle(playerDeckIds));
      st.cpuDeck = createDeck(shuffle(cpuDeckIds ?? config.cpu.deck));
      last = performance.now();
      st.running = true;
      pushHud();
    },
    deployCard(index) {
      if (!st.running) return;
      const id = st.playerDeck.hand()[index];
      if (!id) return;
      const cost = defOf(id).cost * config.costToEnergy;
      if (st.energy < cost) return;
      st.energy -= cost;
      st.energySpent += cost;
      spawn(id, 'you');
      st.playerDeck.play(index);
      pushHud();
    },
    setDiffMode(mode) {
      laneEl.dataset.diff = mode;
    },
    destroy() {
      st.killed = true;
      st.running = false;
      clearUnits();
    },
    // テスト/シミュレーション用に内部状態を覗く（本番UIからは使わない）
    _debug: st,
    _tick: tick,
  };
}
