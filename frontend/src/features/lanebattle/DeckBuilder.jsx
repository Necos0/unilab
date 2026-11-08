import { useState } from 'react';
import LbSprite from './LbSprite';
import Furigana from './Furigana';
import { rosterDefs } from './engine/deriveUnitDef';
import useProgressStore from '../../stores/progressStore';
import { isUnitUnlocked, isDifficultyUnlocked } from './engine/unitUnlock';

const DECK_SIZE = 6;
const MAX_LEGEND = 1;
const ROSTER = rosterDefs();
const DEF_BY_ID = Object.fromEntries(ROSTER.map((d) => [d.id, d]));
/* 下部に横並びで出す難易度ボタン（押下＝その難易度で対戦開始）． */
const DIFFICULTIES = [
  { key: 'star1', stars: 1, label: 'かんたん' },
  { key: 'star2', stars: 2, label: 'ふつう' },
  { key: 'star3', stars: 3, label: 'つよい' },
];

/**
 * デッキ編成画面（要件3）。
 *
 * ロスター16体を一覧表示し、プレイヤーが6体ちょうどを選ぶと対戦を開始できる。
 * 初期状態は空（自分で6体を選ぶ）。7体目は受け付けず、選択済みキャラの
 * 再クリックで解除する。レジェンドは1デッキ1体まで（2体目は目立つトースト警告）。
 *
 * 本編進捗（`progressStore.clearedStageIds`）に連動し、クリア済みステージに
 * 登場したキャラだけ解放する（mecha_dragon は常時）。未解放キャラは「？」で
 * 伏せ、選択不可にする（ネタバレ防止）。未解放が1つ以上あるときは「ストーリー
 * を すすめると ふえるよ」の案内を上部に出す。下部には難易度ボタン（☆×1/×2/
 * ×3）を横並びに置き、押すと `onStart(deck, difficultyKey)` でその難易度の
 * 対戦へ進む。☆×2 は 3-4、☆×3 は 4-4 クリアで解放（未解放はロック表示）。
 *
 * Args:
 *     props (object):
 *         onStart (function): `(deckIds, difficultyKey)` を渡して対戦を開始する。
 *             deckIds は決定した6枚（ID配列）、difficultyKey は 'star1'/'star2'/'star3'。
 *
 * Returns:
 *     JSX.Element: 編成画面。
 */
export default function DeckBuilder({ onStart }) {
  const [deck, setDeck] = useState([]); // 初期デッキは空（自分で6ひき選ぶ）
  /* 伝説2体目を選ぼうとしたときの目立つ警告トースト。key を進めるたびに再アニメする。 */
  const [legendWarn, setLegendWarn] = useState(0);
  /* 本編進捗。クリア済みステージに登場したキャラだけ解放する（要件1・4）。 */
  const clearedStageIds = useProgressStore((s) => s.clearedStageIds);

  const toggle = (id) => {
    if (!isUnitUnlocked(id, clearedStageIds)) return; // 未解放キャラは選べない
    setDeck((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length >= DECK_SIZE) return cur;
      if (DEF_BY_ID[id]?.legend && cur.filter((x) => DEF_BY_ID[x]?.legend).length >= MAX_LEGEND) {
        setLegendWarn((k) => k + 1);
        return cur;
      }
      return [...cur, id];
    });
  };

  const ready = deck.length === DECK_SIZE;
  const remain = DECK_SIZE - deck.length;
  const hasLocked = ROSTER.some((d) => !isUnitUnlocked(d.id, clearedStageIds));

  return (
    <div className="lb-deckbuild">
      {legendWarn > 0 && (
        <div className="lb-toast" key={legendWarn}>
          <img className="lb-toast-face" src="/sprites/robo/robo.png" alt="ビット" />
          <span className="lb-toast-msg">レジェンドは 1デッキに 1ぴき だけだよ！</span>
        </div>
      )}
      {hasLocked && (
        <p className="lb-unlock-note">
          <Furigana text="ストーリーを すすめると、つかえる キャラが ふえるよ！" />
        </p>
      )}
      <p className="lb-lead">
        <Furigana
          text={
            'ずかんから なかまを 6ひき えらんで、じぶんの デッキを つくろう。手《て》ふだは 3まいずつ。' +
            '出《だ》したカードは、いちばん うしろに もどるよ。あいて（コンピュータ）も 同《おな》じ ルール！'
          }
        />
      </p>

      <div className="lb-roster">
        {ROSTER.map((d) => {
          const on = deck.includes(d.id);
          const locked = !isUnitUnlocked(d.id, clearedStageIds);
          return (
            <button
              key={d.id}
              type="button"
              className={`lb-pick${on ? ' on' : ''}${d.legend ? ' legend' : ''}${locked ? ' locked' : ''}`}
              onClick={() => toggle(d.id)}
              disabled={locked}
              aria-pressed={on}
            >
              {locked ? (
                <span className="lb-pk-locked">？</span>
              ) : (
                <>
                  <span className="lb-stage sm">
                    <LbSprite id={d.id} />
                  </span>
                  <span className="lb-pk-name"><Furigana text={d.name} /></span>
                  <span className="lb-pk-stat">
                    コスト{d.cost}・HP{d.hp}
                  </span>
                  {d.ability !== '近接' && (
                    <span className="lb-pk-ability"><Furigana text={d.ability} /></span>
                  )}
                </>
              )}
            </button>
          );
        })}
      </div>

      <div className="lb-tray">
        <b>あなたの デッキ</b>
        <div className="lb-slots">
          {Array.from({ length: DECK_SIZE }).map((_, k) => (
            <div key={k} className={`lb-slot${deck[k] ? '' : ' empty'}`}>
              {deck[k] ? (
                <span className="lb-stage">
                  <LbSprite id={deck[k]} />
                </span>
              ) : (
                '+'
              )}
            </div>
          ))}
        </div>
        <span className="lb-hint">
          {ready ? '6/6 デッキ かんせい！' : `あと ${remain}ぴき えらんでね`}
        </span>
        <div className="lb-difficulty-row">
          {DIFFICULTIES.map((d) => {
            const unlocked = isDifficultyUnlocked(d.key, clearedStageIds);
            return (
              <button
                key={d.key}
                type="button"
                className={`lb-diff-btn${unlocked ? '' : ' locked'}`}
                disabled={!ready || !unlocked}
                onClick={() => onStart(deck, d.key)}
                title={unlocked ? undefined : 'ストーリーを すすめると あそべるよ'}
              >
                <span className="lb-diff-stars">{'★'.repeat(d.stars)}</span>
                <span className="lb-diff-label">{unlocked ? d.label : '🔒'}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
