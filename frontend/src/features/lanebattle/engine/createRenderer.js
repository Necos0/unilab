import config from '../data/lanebattle_config.json';
import { createLaneSprite } from './laneSprite';
import { arenaXPct } from './arena';
import { createAttackEffect } from './laneEffect';
import { createBaseSprite } from './baseSprite';
import { getHeroFramePath } from '../../map/heroSpritePath';
import { getEnemyFramePath } from '../../battle/enemy/enemySpritePath';

const { field } = config;

/**
 * 対戦状態のユニットを盤面へ描く描画層（要件 8）。
 *
 * 純シム（`state`）を読み、`createLaneSprite` の命令的スプライトへ**差分同期**
 * する。React の再レンダーを介さず、駆動層の `onFrame(state)` から毎フレーム
 * `sync(state)` を呼ぶ。`fieldEl`（`.lbf-field`）の中にレーンごとの全幅
 * ユニット層（`.lbf-units`）を作り、ユニットはその層に入れる。層が全幅なので
 * 左位置は `x / virtualWidth`（%）がそのまま効き、縦はレーン帯に下寄せ（既存
 * `.unit` の配置）で決まる。ユニットの同定は `Map<unit, sprite>`（sim が消す
 * まで unit オブジェクトは残る）。生存ユニットは `idleMs` ごとにアイドルの
 * コマを送る。`state.units` から消えたユニット＝死亡なので `dying` リストへ
 * 移し、`deadMs` ごとに死亡フレームを進めて再生し切ってからスプライトを除去
 * する（sim が dead を即除去しても死亡演出は流れる）。アニメの時間は `sync`
 * に渡る**実フレーム dt** で進む（見た目のクロックで、sim の固定ステップとは別）。
 *
 * さらに盤面全面のエフェクト層 `.lbf-fx` と本陣キャラ（味方＝主人公／敵＝真の
 * ドラゴン）を持つ。`sync` は毎フレーム `state.hits`（攻撃イベント）を読み切って
 * `createAttackEffect` でエフェクト DOM 化し，キューを空にする（消費は描画側の
 * 責務）。本陣キャラは `step(dt)` で待機アニメだけ送る。`destroy` で両者も撤去する。
 *
 * Args:
 *     fieldEl (HTMLElement): `.lbf-field` 要素。ここにユニット層を差し込む。
 *
 * Returns:
 *     object: 制御ハンドル。
 *         sync (function): `sync(state, dt)` で 1 フレーム分の同期（位置・HP・
 *             アニメ）を行う。
 *         destroy (function): スプライト・死亡アニメ・ユニット層をすべて除去する。
 */
export function createRenderer(fieldEl) {
  const layers = field.laneYs.map((y) => {
    const el = document.createElement('div');
    el.className = 'lbf-units';
    el.style.top = `${((y - field.laneHeight / 2) / field.virtualHeight) * 100}%`;
    el.style.height = `${(field.laneHeight / field.virtualHeight) * 100}%`;
    fieldEl.appendChild(el);
    return el;
  });
  // 攻撃エフェクト層（盤面全面）．飛翔体・斬撃はレーンをまたぐのでユニット層とは別に 1 枚持つ．
  const fx = document.createElement('div');
  fx.className = 'lbf-fx';
  fieldEl.appendChild(fx);
  // 本陣キャラ：味方＝主人公（hero），敵＝メカサファイアドラゴン（mecha_sapphire_dragon）．
  // 立たせるだけで動かない．どちらも enemies.json に無いため frames/frameMs は定数で与える
  // （hero=idle 4コマ／敵=idle 8コマ）．陣取り合戦は 2-4 で早期解放するため，ラスボスの
  // 「しんのドラゴン」ではなくネタバレにならない別キャラを敵本陣に立たせる．敵は少し大きめ．
  // 本陣キャラはアリーナ外の袖（盤面端寄り）に立たせる．
  const INSET = 1; // 盤面端からの内側%．
  const heroSpr = createBaseSprite(fieldEl, {
    framePath: (i) => getHeroFramePath('idle', i),
    frames: 4,
    frameMs: 200,
    flipX: false,
    heightPx: 96,
    insetPct: INSET,
    side: 'you',
  });
  const dragonSpr = createBaseSprite(fieldEl, {
    framePath: (i) => getEnemyFramePath('mecha_sapphire_dragon', 'idle', i),
    frames: 8,
    frameMs: 120,
    flipX: false,
    heightPx: 130,
    insetPct: INSET,
    side: 'cpu',
  });
  const sprites = new Map(); // unit -> { spr, animT, frame }
  const dying = []; // { spr, def, animT, frame }

  function sync(state, dt) {
    const alive = new Set(state.units);
    for (const u of state.units) {
      let rec = sprites.get(u);
      if (!rec) {
        rec = { spr: createLaneSprite(layers[u.lane], u.def, u.side), animT: 0, frame: 0 };
        sprites.set(u, rec);
      }
      rec.spr.setPos(arenaXPct(u.x));
      rec.spr.setHp(u.hp / u.maxHp);
      rec.animT += dt;
      if (rec.animT >= u.def.idleMs) {
        rec.animT = 0;
        rec.frame = (rec.frame + 1) % u.def.idleFrames;
        rec.spr.setFrame('idle', rec.frame);
      }
    }
    for (const [u, rec] of sprites) {
      if (!alive.has(u)) {
        sprites.delete(u);
        rec.spr.hideHp();
        rec.spr.setFrame('dead', 0);
        dying.push({ spr: rec.spr, def: u.def, animT: 0, frame: 0 });
      }
    }
    for (let i = dying.length - 1; i >= 0; i -= 1) {
      const d = dying[i];
      d.animT += dt;
      if (d.animT < d.def.deadMs) continue;
      d.animT = 0;
      d.frame += 1;
      if (d.frame < d.def.deadFrames) d.spr.setFrame('dead', d.frame);
      else {
        d.spr.remove();
        dying.splice(i, 1);
      }
    }
    // 攻撃イベントを消費してエフェクト化し，キューを空にする（描画側の責務）．
    for (const h of state.hits) createAttackEffect(fx, h);
    state.hits.length = 0;
    // 本陣キャラの待機アニメを実フレーム dt で進める．
    heroSpr.step(dt);
    dragonSpr.step(dt);
  }

  function destroy() {
    for (const [, rec] of sprites) rec.spr.remove();
    for (const d of dying) d.spr.remove();
    sprites.clear();
    dying.length = 0;
    layers.forEach((el) => el.remove());
    fx.remove();
    heroSpr.remove();
    dragonSpr.remove();
  }

  return { sync, destroy };
}
