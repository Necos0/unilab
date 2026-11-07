import config from '../data/lanebattle_config.json';

const { field } = config;
const PAD = field.arenaPadPct ?? 0;

/**
 * 仮想 x（0..virtualWidth）を盤面内の左位置%へ変換する（アリーナ内側寄せ）．
 *
 * ユニット・本陣・エフェクトはすべてこの 1 つの写像で配置する．盤面の端に
 * `arenaPadPct`% ずつ袖（アリーナ外）を残し，仮想座標 0..virtualWidth を
 * [PAD, 100-PAD]% に線形マップする．袖には本陣キャラ（主人公／ドラゴン）が
 * 立つ．sim の距離計算は仮想座標のままで，これは描画の写像だけを変える．
 *
 * Args:
 *     x (number): 仮想 x 座標（0..virtualWidth）．
 *
 * Returns:
 *     number: 盤面に対する左位置%（PAD..100-PAD）．
 */
export function arenaXPct(x) {
  return PAD + (x / field.virtualWidth) * (100 - 2 * PAD);
}

/**
 * 仮想長さ（splash 半径など）を盤面幅に対する%へ変換する．
 *
 * `arenaXPct` と同じ横スケール（アリーナ幅＝100-2*PAD%）で長さを換算する．
 * 位置ではなく「幅・半径」なので PAD のオフセットは足さない．
 *
 * Args:
 *     len (number): 仮想座標系での長さ．
 *
 * Returns:
 *     number: 盤面幅に対する%．
 */
export function arenaLenPct(len) {
  return (len / field.virtualWidth) * (100 - 2 * PAD);
}
