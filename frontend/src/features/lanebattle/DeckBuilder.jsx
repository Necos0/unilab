import { useState } from 'react';
import LbSprite from './LbSprite';
import Furigana from './Furigana';
import { rosterDefs } from './engine/deriveUnitDef';

const DECK_SIZE = 6;
const MAX_LEGEND = 1;
const ROSTER = rosterDefs();
const DEF_BY_ID = Object.fromEntries(ROSTER.map((d) => [d.id, d]));

/**
 * デッキ編成画面（要件3）。
 *
 * ロスター16体を一覧表示し、プレイヤーが6体ちょうどを選ぶと対戦を開始できる。
 * 初期状態は空（自分で6体を選ぶ）。7体目は受け付けず、選択済みキャラの
 * 再クリックで解除する。レジェンドは1デッキ1体まで（2体目は目立つトースト警告）。
 *
 * Args:
 *     props (object):
 *         onStart (function): 決定した6枚デッキ（ID配列）を渡して開始する。
 *
 * Returns:
 *     JSX.Element: 編成画面。
 */
export default function DeckBuilder({ onStart }) {
  const [deck, setDeck] = useState([]); // 初期デッキは空（自分で6ひき選ぶ）
  /* 伝説2体目を選ぼうとしたときの目立つ警告トースト。key を進めるたびに再アニメする。 */
  const [legendWarn, setLegendWarn] = useState(0);

  const toggle = (id) => {
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

  return (
    <div className="lb-deckbuild">
      {legendWarn > 0 && (
        <div className="lb-toast" key={legendWarn}>
          <img className="lb-toast-face" src="/sprites/robo/robo.png" alt="ビット" />
          <span className="lb-toast-msg">レジェンドは 1デッキに 1ぴき だけだよ！</span>
        </div>
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
          return (
            <button
              key={d.id}
              type="button"
              className={`lb-pick${on ? ' on' : ''}${d.legend ? ' legend' : ''}`}
              onClick={() => toggle(d.id)}
              aria-pressed={on}
            >
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
        <button
          type="button"
          className="lb-start"
          disabled={!ready}
          onClick={() => onStart(deck)}
        >
          この 6ぴきで スタート！
        </button>
      </div>
    </div>
  );
}
