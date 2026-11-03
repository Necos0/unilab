import config from '../data/lanebattle_config.json';

/**
 * 決着時のスコアを算出する（要件3・8）。
 *
 * クリア（`state.result === 'you'`＝時間内に敵本陣を 0 にした）なら、勝利点
 * `winBase` に残り時間ボーナス（`timeBonusPerSec × 残り秒`）を足す＝速いクリア
 * ほど高い。それ以外（`'cpu'` 自本陣陥落／`'timeout'` 時間切れ＝未クリア）は、
 * 敵本陣に与えたダメージに比例（`damageScoreMax × 与ダメージ / 本陣最大HP`、
 * 下限 `min`）＝膠着でも削った分は点になる。`damageScoreMax < winBase` なので
 * クリアが未クリアを常に上回る。スコア算出はこの 1 か所に集約（将来のランキング
 * 送信もここから）。config と state から決まる純関数。
 *
 * Args:
 *     state (object): 決着済みの対戦状態（`result` / `t` / `base.cpu.hp`）。
 *
 * Returns:
 *     number: スコア。
 */
export function computeScore(state) {
  const s = config.score;
  if (state.result === 'you') {
    const remainingSec = Math.max(0, (config.timeLimitMs - state.t) / 1000);
    return Math.round(s.winBase + s.timeBonusPerSec * remainingSec);
  }
  const baseMax = config.base.hp;
  const dmg = Math.max(0, Math.min(baseMax, baseMax - state.base.cpu.hp));
  return Math.max(s.min, Math.round((s.damageScoreMax * dmg) / baseMax));
}
