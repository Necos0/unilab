import config from '../data/lanebattle_config.json';
import { arenaXPct as xPct, arenaLenPct } from './arena';

const { field } = config;

/**
 * レーン番号を盤面内の縦位置%（レーン帯の中心）へ．
 *
 * ユニットは帯の下寄せで描かれるが，エフェクトは帯中心を狙う（弾・斬撃の
 * 基準点として体の中ほどに当たり，左右どのレーンでも同じ高さ感になる）．
 * 想定外の lane が来ても中央レーンへ落として安全に返す．
 */
function laneCenterPct(lane) {
  const y = field.laneYs[lane] ?? field.laneYs[1];
  return (y / field.virtualHeight) * 100;
}

/**
 * 攻撃エフェクトの DOM を 1 個生成し，アニメ終了で自走 remove する（要件 1・2・6）．
 *
 * `state.hits` の 1 イベントを受け取り，盤面全面のエフェクト層 `fxEl` に要素を
 * 挿す．遠隔（`ranged`）は飛翔体 `.lbf-proj` を「元→先」へ `left/top` 補間で
 * 飛ばし（向きは始点・終点の位置関係から自然に決まる），近接は被弾点 `to` に
 * 斬撃 `.lbf-slash` を拡大フェードで出す．色は攻撃側 `side`（`you`/`cpu`）の
 * クラスで分ける．動きは Web Animations API が持ち（CSS はコンテナ幅基準で
 * 元→先を動かせないため），`onfinish` で DOM から取り除く（盤面に残さない）．
 *
 * Args:
 *     fxEl (HTMLElement): 盤面全面のエフェクト層（`createRenderer` が用意）．
 *     hit (object): `{fromX, fromLane, toX, toLane, side, ranged}`（stepSim が記録）．
 */
export function createAttackEffect(fxEl, hit) {
  const fromX = xPct(hit.fromX);
  const toX = xPct(hit.toX);
  const fromY = laneCenterPct(hit.fromLane);
  const toY = laneCenterPct(hit.toLane);

  // 貫通（pierce）：攻撃元から射程ぶん伸びるビーム主体．弾・斬撃は出さない．
  if (hit.pierce > 0) {
    const beam = document.createElement('div');
    beam.className = `lbf-beam ${hit.side}`;
    const lenPct = arenaLenPct(hit.pierce);
    const dir = hit.side === 'you' ? 1 : -1; // you は右へ，cpu は左へ伸びる
    const left = dir > 0 ? fromX : fromX - lenPct;
    beam.style.left = `${left}%`;
    beam.style.width = `${lenPct}%`;
    beam.style.top = `${fromY}%`;
    beam.style.transformOrigin = dir > 0 ? 'left center' : 'right center'; // 攻撃元側から伸ばす
    fxEl.appendChild(beam);
    const b = beam.animate(
      [
        { transform: 'translateY(-50%) scaleX(0.15)', opacity: 1 },
        { transform: 'translateY(-50%) scaleX(1)', opacity: 0 },
      ],
      { duration: 220, easing: 'ease-out' },
    );
    b.onfinish = () => beam.remove();
    return;
  }

  // 範囲攻撃（splash）の着弾リングを先に敷く（攻撃側の色で広がって消える）．
  if (hit.splash > 0) {
    const aoe = document.createElement('div');
    aoe.className = `lbf-aoe ${hit.side}`;
    // splash 半径を px に（真円にするため．% だと縦横のスケールが違い楕円になる）．
    const r = (arenaLenPct(hit.splash) / 100) * fxEl.clientWidth;
    aoe.style.left = `${toX}%`;
    aoe.style.top = `${toY}%`;
    aoe.style.width = `${2 * r}px`;
    aoe.style.height = `${2 * r}px`;
    fxEl.appendChild(aoe);
    const a = aoe.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0.7 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
      ],
      { duration: 320, easing: 'ease-out' },
    );
    a.onfinish = () => aoe.remove();
  }

  const el = document.createElement('div');
  // 本陣（タワー）の弾は敵味方とも同色（.base）でユニット攻撃と区別．近接は side 色．
  el.className = hit.ranged ? (hit.base ? 'lbf-proj base' : `lbf-proj ${hit.side}`) : `lbf-slash ${hit.side}`;

  if (hit.ranged) {
    // 飛翔体：元に置いて先へ移動．終盤 15% で消えて着弾感を出す．
    el.style.left = `${fromX}%`;
    el.style.top = `${fromY}%`;
    fxEl.appendChild(el);
    const anim = el.animate(
      [
        { left: `${fromX}%`, top: `${fromY}%`, opacity: 1 },
        { left: `${toX}%`, top: `${toY}%`, opacity: 1, offset: 0.85 },
        { left: `${toX}%`, top: `${toY}%`, opacity: 0 },
      ],
      { duration: 200, easing: 'linear' },
    );
    anim.onfinish = () => el.remove();
  } else {
    // 近接：被弾点で弾ける．translate(-50%) はアニメ内に入れて中心を保つ．
    el.style.left = `${toX}%`;
    el.style.top = `${toY}%`;
    fxEl.appendChild(el);
    const anim = el.animate(
      [
        { transform: 'translate(-50%, -50%) scale(0.4)', opacity: 0.9 },
        { transform: 'translate(-50%, -50%) scale(1.4)', opacity: 0 },
      ],
      { duration: 150, easing: 'ease-out' },
    );
    anim.onfinish = () => el.remove();
  }
}
