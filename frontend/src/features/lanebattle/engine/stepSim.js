import config from '../data/lanebattle_config.json';

/**
 * ユニット `u` の攻撃対象を選ぶ（要件 1・8）。
 *
 * `u.laneReach`（届くレーン差。0＝同レーンのみ、1＝隣レーンまで。既定 0）の
 * 範囲にいる敵のうち、`u.detectRange`（探知距離）内で最も近い 1 体を返す。
 * レーン判定をハードコードせず `laneReach`（データ）で決めることで、将来
 * 「隣レーンも攻撃できるキャラ」を `findTarget` を書き換えずに足せる。距離は
 * いまは横 x 差のみで測る（`laneReach > 0` を実際に使うキャラを作るときに
 * レーン差の重み付けを加える）。DOM に触れない純関数。
 *
 * Args:
 *     state (object): 対戦状態。`units` を走査する。
 *     u (object): 対象を探すユニット。
 *
 * Returns:
 *     object | null: 選ばれた敵ユニット。いなければ null。
 */
export function findTarget(state, u) {
  const reach = u.laneReach ?? 0;
  let best = null;
  let bestDist = Infinity;
  for (const o of state.units) {
    if (o.dead || o.side === u.side) continue;
    if (Math.abs(o.lane - u.lane) > reach) continue;
    const dist = Math.abs(o.x - u.x);
    if (dist <= u.detectRange && dist < bestDist) {
      bestDist = dist;
      best = o;
    }
  }
  return best;
}

/**
 * 目標 `goalX` へ最大 `dist` だけ寄せる（味方の追い越し禁止つき。要件1・8）。
 *
 * 進行方向（前進でも後退でも）にいる同レーン・同陣営の最寄り味方を追い越さない
 * よう、その手前 `config.stackGap` までに移動量を制限する。前進では前の味方（壁
 * など）を追い越せず、後退では後ろの味方に留められる（＝壁が前・遠距離は壁に
 * 守られる、の両方が成立）。敵味方はすり抜ける（同陣営のみ判定）。既に間隔以下
 * なら進まない（後退で押し戻さない）。DOM に触れない純関数。
 *
 * Args:
 *     state (object): 対戦状態。
 *     u (object): 動かすユニット。
 *     goalX (number): 目標 x。
 *     dist (number): このステップで進みたい距離（正）。
 */
function moveToward(state, u, goalX, dist) {
  const toward = Math.sign(goalX - u.x);
  if (toward === 0) return;
  let bestGap = Infinity;
  for (const o of state.units) {
    if (o.dead || o === u || o.side !== u.side || o.lane !== u.lane) continue;
    const g = (o.x - u.x) * toward;
    if (g > 0 && g < bestGap) bestGap = g;
  }
  let move = dist;
  if (bestGap < Infinity) move = Math.max(0, Math.min(dist, bestGap - config.stackGap));
  u.x += toward * move;
}

/**
 * 攻撃エフェクト用のイベントを `state.hits` に 1 件積む（要件 1・4）．
 *
 * 描画層が「元→先」の向きと種別を描けるよう，攻撃元・攻撃先の仮想座標
 * （x・lane），攻撃した側 `side`，遠隔か `ranged` を純データで記録する．
 * ダメージ適用（dealDamage 等）とは分離し，ここでは hp にも DOM にも触れない．
 * 1 攻撃アクションにつき主対象へ 1 件だけ積む（pierce/splash でも氾濫させない）．
 *
 * Args:
 *     state (object): 対戦状態．`hits` に push する．
 *     from (object): 攻撃元 `{x, lane}`．
 *     to (object): 攻撃先 `{x, lane}`．
 *     side (string): 攻撃した側 `'you'` / `'cpu'`（色分け用）．
 *     ranged (boolean): 遠隔なら true（飛翔体）／近接なら false（斬撃）．
 *     opts (object): 追加情報．
 *         base (boolean): 本陣（タワー）の攻撃か．true なら敵味方共通色にする．
 *         splash (number): 範囲攻撃の半径（仮想x）．0 なら範囲表示なし．
 *         pierce (number): 貫通攻撃の射程（仮想x）．0 なら貫通ビーム表示なし．
 */
function pushHit(state, from, to, side, ranged, opts = {}) {
  state.hits.push({
    fromX: from.x,
    fromLane: from.lane,
    toX: to.x,
    toLane: to.lane,
    side,
    ranged,
    base: opts.base ?? false,
    splash: opts.splash ?? 0,
    pierce: opts.pierce ?? 0,
  });
}

/**
 * 各ユニットを 1 ステップ分「移動 または 攻撃」させる（要件 1・8）。
 *
 * ユニット 1 体につき `findTarget` を 1 回だけ呼び、その 1 つの標的で「攻撃
 * するか動くか」を分岐する（移動と攻撃で標的を共有するので、動く相手と殴る
 * 相手が必ず一致し、ターゲット選定ロジックも 1 か所にまとまる）。標的が居れ
 * ば、射程（`range`）内なら `atkTimer` に従って `resolveAttack`、射程外なら
 * `Math.sign(target.x - u.x)` の向き（前方＝前進／後方＝後退。要件 1-7/8）へ
 * 進む。標的が居なければ、敵本陣が射程内なら本陣 HP を削り、遠ければ本陣へ
 * 前進する。速度は素の `spd` に鈍足倍率 `slowMul` と `config.moveSpeedScale`
 * を掛ける。死亡判定・本陣防衛はこの関数では行わない（後続ブロック）。攻撃が
 * 発生したティックでは `pushHit` で攻撃エフェクト用イベントを `state.hits` に
 * 積む（対ユニット・対本陣の 2 経路）。ダメージ適用とは分離し DOM には触れない．
 *
 * Args:
 *     state (object): 対戦状態。`units` / `base` を更新する。
 *     dt (number): 経過ミリ秒。
 */
export function stepUnits(state, dt) {
  const s = dt / 1000;
  for (const u of state.units) {
    if (u.dead) continue;
    if (u.slowT > 0) {
      u.slowT -= dt;
      if (u.slowT <= 0) u.slowMul = 1;
    }
    if (u.atkTimer > 0) u.atkTimer -= dt;
    const speed = u.spd * u.slowMul * config.moveSpeedScale;
    const target = u.rushBase ? null : findTarget(state, u);
    if (target) {
      if (Math.abs(target.x - u.x) <= u.range) {
        if (u.atkTimer <= 0) {
          u.atkTimer = u.atkInterval;
          resolveAttack(state, u, target);
          // 攻撃元 u → 主対象 target．resolveAttack（pierce/splash で多重処理）
          // ではなくここで 1 件だけ積む．範囲は splash 半径，貫通は本陣までの距離を
          // 渡して可視化する（ビームが攻撃位置→敵本陣の直前まで伸びる）．
          const pierceBaseX = u.side === 'you' ? config.field.cpuBaseX : config.field.youBaseX;
          pushHit(state, u, target, u.side, !!u.def.ranged, {
            splash: u.splash,
            pierce: u.pierce ? Math.abs(pierceBaseX - u.x) : 0,
          });
        }
      } else {
        moveToward(state, u, target.x, speed * s);
      }
    } else {
      const baseX = u.side === 'you' ? config.field.cpuBaseX : config.field.youBaseX;
      const enemyBase = u.side === 'you' ? 'cpu' : 'you';
      if (Math.abs(baseX - u.x) <= u.range) {
        if (u.atkTimer <= 0) {
          u.atkTimer = u.atkInterval;
          state.base[enemyBase].hp -= u.atk;
          // 本陣は lane を持たないので攻撃元の lane に撃ち込む形で記録する．
          pushHit(state, u, { x: baseX, lane: u.lane }, u.side, !!u.def.ranged);
        }
      } else {
        moveToward(state, u, baseX, speed * s);
      }
    }
  }
}

/**
 * ユニットへダメージを適用する（死亡シールドを反映。要件 8）。
 *
 * 被弾側の陣営に死亡シールド（`state.shield[side]`）が残っていれば、その
 * 倍率 `mul` を掛けて軽減する（サソリ等の deathShield 能力）。DOM に触れない。
 *
 * Args:
 *     state (object): 対戦状態。`shield` を参照する。
 *     target (object): 被弾ユニット。`hp` を減らす。
 *     amount (number): 素のダメージ量。
 */
export function dealDamage(state, target, amount) {
  const sh = state.shield[target.side];
  const mul = sh.t > 0 ? sh.mul : 1;
  target.hp -= amount * mul;
}

/**
 * 1 回の攻撃の効果を解決する（要件 1・8）。
 *
 * 攻撃に付随する回復（`healOnAttack`）と鈍足（`slowOnAttack`）を先に適用し、
 * 続いて対象へダメージを与える。回復・鈍足のレーン範囲は `supportAllLanes`
 * で決まる（既定 false＝自レーンのみ、true＝全レーン。フェニックス・ゴールデン
 * バードなどレジェンドが true）。ダメージは貫通（`pierce`：前方 `range` 内の
 * 敵全員）／範囲（`splash`：着弾点まわり）／単体のいずれか。範囲・貫通が届く
 * レーンは `attackAllLanes` で決まる（既定 false＝同レーン、true＝全レーン。
 * ドラゴン等が true。検知の `laneReach` とは独立の軸）。貫通の到達距離は固定
 * `range` ではなく「攻撃元から敵本陣までの距離」で、打つ位置によって変わる
 * （前進するほど短く。前方の敵を本陣手前まで全て貫く）。攻撃の間隔・発生
 * タイミングは呼び出し側（stepCombat）が管理する。DOM に触れない純関数。
 *
 * Args:
 *     state (object): 対戦状態。
 *     u (object): 攻撃するユニット。
 *     target (object | null): 主対象。null の場合は回復/鈍足のみ適用して返す。
 */
export function resolveAttack(state, u, target) {
  const supportSameLane = !u.supportAllLanes; // 既定は自レーンのみ／レジェンド等は全レーン
  if (u.healOnAttack > 0) {
    for (const o of state.units) {
      if (o.dead || o.side !== u.side) continue;
      if (supportSameLane && o.lane !== u.lane) continue;
      o.hp = Math.min(o.maxHp, o.hp + u.healOnAttack);
    }
  }
  if (u.slowOnAttack) {
    for (const o of state.units) {
      if (o.dead || o.side === u.side) continue;
      if (supportSameLane && o.lane !== u.lane) continue;
      o.slowT = u.slowOnAttack.ms;
      o.slowMul = u.slowOnAttack.mul;
    }
  }
  if (!target) return;
  const dir = u.side === 'you' ? 1 : -1;
  const dmgSameLane = !u.attackAllLanes; // 既定は同レーン／ドラゴン等は全レーン攻撃
  if (u.pierce) {
    // 貫通の到達距離は固定 range ではなく「攻撃元から敵本陣までの距離」．
    // 前方にいる敵ユニットを本陣手前まで全て貫く（打つ位置で範囲が変わる）．
    const enemyBaseX = u.side === 'you' ? config.field.cpuBaseX : config.field.youBaseX;
    const reach = Math.abs(enemyBaseX - u.x);
    for (const o of state.units) {
      if (o.dead || o.side === u.side) continue;
      if (dmgSameLane && o.lane !== u.lane) continue;
      const ahead = (o.x - u.x) * dir;
      if (ahead > 0 && ahead <= reach) dealDamage(state, o, u.atk);
    }
  } else if (u.splash > 0) {
    for (const o of state.units) {
      if (o.dead || o.side === u.side) continue;
      if (dmgSameLane && o.lane !== u.lane) continue;
      if (Math.abs(o.x - target.x) <= u.splash) dealDamage(state, o, u.atk);
    }
  } else {
    dealDamage(state, target, u.atk);
  }
}

/**
 * 本陣の自動迎撃（要件 6・8）。
 *
 * 各陣営の本陣は「固定射程」ではなく**自陣全域**を守る：中央 `field.midX` を
 * 越えて自本陣側に踏み込んだ敵ユニットのうち、**本陣に最も近い 1 体**（＝一番
 * 奥まで侵入した敵）を `intervalMs` 間隔で `atk` ぶん撃つ。自陣側かどうかは
 * `(o.x - midX) * dirToBase > 0`（`dirToBase` は midX から本陣への向き。
 * you:-1／cpu:+1）で判定するので、レーンをまたいで全レーンの侵入敵が対象になる。
 * これにより、本陣防衛より射程の長い遠距離ユニット（トカゲ等）でも、自陣に
 * 入れば必ず被弾する。クールダウン `base[side].defT` は撃った時だけリセット
 * するので、敵が自陣に入った瞬間に反応する。`dealDamage` を通すため、死亡
 * シールド中の敵には本陣の弾も軽減される。迎撃したティックでは `pushHit` で
 * 本陣→対象ユニットのイベントを `state.hits` に積む（塔の射撃なので ranged）。
 * DOM に触れない純関数。
 *
 * Args:
 *     state (object): 対戦状態。`base` / `units` を更新する。
 *     dt (number): 経過ミリ秒。
 */
export function stepBaseDefense(state, dt) {
  const def = config.base.defense;
  const midX = config.field.midX;
  for (const side of ['you', 'cpu']) {
    const b = state.base[side];
    if (b.defT > 0) {
      b.defT -= dt;
      if (b.defT > 0) continue;
    }
    const baseX = side === 'you' ? config.field.youBaseX : config.field.cpuBaseX;
    const dirToBase = Math.sign(baseX - midX); // 中央から本陣への向き（you:-1／cpu:+1）
    let target = null;
    let best = Infinity;
    for (const o of state.units) {
      if (o.dead || o.side === side) continue;
      if ((o.x - midX) * dirToBase <= 0) continue; // 自陣側に入っていない敵は無視
      const dist = Math.abs(o.x - baseX);
      if (dist < best) {
        best = dist;
        target = o;
      }
    }
    if (target) {
      b.defT = def.intervalMs;
      dealDamage(state, target, def.atk);
      // 攻撃元は本陣（baseX，対象のレーン上）．塔の射撃なので遠隔（飛翔体）扱い．
      // base:true で敵味方とも共通色にし，ユニット攻撃と区別する．
      pushHit(state, { x: baseX, lane: target.lane }, target, side, true, { base: true });
    }
  }
}

/**
 * HP が尽きたユニットの死亡処理（要件 8）。
 *
 * `hp <= 0` かつ未 dead のユニットを dead 化し、死亡時能力を発火する。
 * deathbomb 持ちは同レーンの爆風範囲内の敵へ `u.atk * 3` を `dealDamage`
 * （死亡シールド反映）。deathShield 持ちは自陣の `state.shield` に残り時間と
 * 被ダメ軽減倍率をセットする。爆風の巻き添えで死んだユニットの deathbomb は
 * 次ステップで処理される（1 パスのため連鎖は 1 ティック遅延）。配列からの
 * 除去と決着判定はここでは行わず `stepSim` に任せる（dead を立てるだけ）。
 * DOM に触れない純関数。
 *
 * Args:
 *     state (object): 対戦状態。`units` / `shield` を更新する。
 */
export function processDeaths(state) {
  for (const u of state.units) {
    if (u.dead || u.hp > 0) continue;
    u.dead = true;
    u.deadT = 0;
    if (u.deathbomb > 0) {
      for (const o of state.units) {
        if (o.dead || o.side === u.side || o.lane !== u.lane) continue;
        if (Math.abs(o.x - u.x) <= u.deathbomb) dealDamage(state, o, u.atk * 3);
      }
    }
    if (u.deathShield) {
      const sh = state.shield[u.side];
      sh.t = u.deathShield.ms;
      sh.mul = u.deathShield.mul;
    }
  }
}

/**
 * 対戦を 1 ステップ進める総合更新（要件 6・8）。
 *
 * 呼ぶ側（rAF ループや headless テスト）は `stepSim(state, dt)` を繰り返す
 * だけでよい。処理順は「時間加算 → 両陣営のエナジー回復（エスカレーション。
 * CPU は難易度で決まる `state.cpuRegenMul` 倍）→ 陣営シールドの減衰 → ユニットの移動/攻撃
 * （`stepUnits`）→ 本陣の迎撃（`stepBaseDefense`）→ 死亡処理（`processDeaths`）
 * → dead の一括除去 → 決着判定」。シールド減衰を先頭に置くことで、前ティック
 * のシールドは減り、同ティックに死亡処理が張ったシールドは満タンのまま残る。
 * 死亡処理を攻撃の後に置くことで、本陣の弾で死んだ敵も同ティックで死ぬ。dead は
 * 反復中は立てるだけにして最後に 1 回の filter で除去する（反復中の削除による
 * 取りこぼしを避ける mark-and-sweep）。決着は `state.result` に入れ、以降は早期
 * return で凍結する：敵本陣 0＝`'you'`（クリア）、自本陣 0＝`'cpu'`、どちらも 0 で
 * なく `t >= config.timeLimitMs`＝`'timeout'`（時間切れ）。dead を
 * 即除去するため、死亡アニメの表示（少し残す等）は描画側（後続ユニット）で扱う。
 * DOM に触れない純関数。
 *
 * Args:
 *     state (object): 対戦状態。
 *     dt (number): 経過ミリ秒。
 */
export function stepSim(state, dt) {
  if (state.result) return;
  state.t += dt;
  const regenMul = Math.min(config.escalation.maxMul, 1 + Math.floor(state.t / config.escalation.stepMs));
  state.regenMul = regenMul;
  const es = (dt / 1000) * config.energyRegenPerSec * regenMul;
  state.energy.you = Math.min(config.energyMax, state.energy.you + es);
  state.energy.cpu = Math.min(config.energyMax, state.energy.cpu + es * (state.cpuRegenMul ?? 1));
  for (const side of ['you', 'cpu']) {
    if (state.shield[side].t > 0) state.shield[side].t -= dt;
  }
  stepUnits(state, dt);
  stepBaseDefense(state, dt);
  processDeaths(state);
  state.units = state.units.filter((u) => !u.dead);
  if (state.base.cpu.hp <= 0) state.result = 'you';
  else if (state.base.you.hp <= 0) state.result = 'cpu';
  else if (state.t >= config.timeLimitMs) state.result = 'timeout';
}
