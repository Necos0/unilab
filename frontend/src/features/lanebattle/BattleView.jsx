import HandBar from './HandBar';
import useLaneBattleEngine from './hooks/useLaneBattleEngine';
import { getEnemyFramePath } from '../battle/enemy/enemySpritePath';

/* 自陣＝ヒーロー、敵陣＝ドラゴン（しんのドラゴン）を「城」の代わりに置く。 */
const HERO_SRC = '/sprites/hero/idle/hero_idle_00.png';
const DRAGON_SRC = getEnemyFramePath('dragon_final', 'idle', 0);

/**
 * 対戦画面（アリーナ）（要件6・8・10改・11改）。
 *
 * 城 HP の概念は廃止。ユニットが相手のライン（ヒーロー／ドラゴン）に到達
 * した瞬間に決着する。HUD には城ゲージの代わりに、スコアに直結する「経過
 * 時間」「出したキャラ数」と、今勝った場合の暫定スコアを表示する（速く・
 * 少なく出すほど高い）。敵味方の見分けは「色＋向き」に固定。
 *
 * Args:
 *     props (object):
 *         deckIds (string[]): プレイヤーの6枚デッキ。
 *         onEnd (function): 決着時に `{ win, score, kills }` を渡す。
 *
 * Returns:
 *     JSX.Element: 対戦画面。
 */
export default function BattleView({ deckIds, onEnd }) {
  const { laneRef, hud, deploy } = useLaneBattleEngine({ deckIds, onEnd });
  const energyPct = hud ? (hud.energy / hud.energyMax) * 100 : 0;
  const youGuardPct = hud ? (hud.youGuardHp / hud.guardMax) * 100 : 100;
  const cpuGuardPct = hud ? (hud.cpuGuardHp / hud.guardMax) * 100 : 100;

  return (
    <div className="lb-arena">
      <div className="lb-hud">
        <span className="lb-stat">⏱ <b>{hud ? hud.timeSec.toFixed(1) : '0.0'}</b> びょう</span>
        <span className="lb-stat">つかった エナジー <b>{hud ? hud.energyUsed : 0}</b></span>
        <span className="lb-score">スコア <b>{hud ? hud.score : 0}</b></span>
      </div>

      <div className="lb-lane" ref={laneRef} data-diff="both">
        <div className="lb-base you">
          <span className="lb-ghp you">
            <i style={{ width: `${youGuardPct}%` }} />
          </span>
          <img src={HERO_SRC} alt="ヒーロー" draggable={false} />
        </div>
        <div className="lb-base cpu">
          <span className="lb-ghp cpu">
            <i style={{ width: `${cpuGuardPct}%` }} />
          </span>
          <img src={DRAGON_SRC} alt="ドラゴン" draggable={false} />
        </div>
      </div>

      <div className="lb-deploy">
        <span className="lb-energy">
          ⚡
          <span className="lb-bar energy">
            <i style={{ width: `${energyPct}%` }} />
          </span>
          <span className="lb-energynum">
            {hud ? Math.floor(hud.energy) : 0} / {hud ? hud.energyMax : 0}
          </span>
        </span>
        {hud && <HandBar hand={hud.hand} next={hud.next} onDeploy={deploy} />}
      </div>
    </div>
  );
}
