import { useEffect, useRef, useState } from 'react';
import BattleField from './BattleField';
import HandBar from './HandBar';
import { createBattleState } from './engine/battleState';
import { createRuntime } from './engine/createRuntime';
import { createRenderer } from './engine/createRenderer';

/**
 * 1 試合分の「遊べる版」コンポーネント（要件 2・3・8）。
 *
 * 駆動層（`createRuntime`）・描画層（`createRenderer`）・HUD（React）をまとめる。
 * `onHud` を state に受けてエナジー・手札を React で更新し、`onFrame` で
 * ユニットを命令的に描画する（数の多いユニットで React 再描画を起こさないため、
 * 描画を二系統に分ける）。対戦状態は `createBattleState` で 1 つ作り、`BattleField`
 * の本陣 HP 表示と駆動層で**同じオブジェクトを共有**する。駆動層・描画層は
 * レンダー中に触れないよう `useEffect` の中で生成する（React の refs 規約）。
 * カードをタップすると手札を選択（ハイライト）する。実際の配置（レーン×前後
 * スロットへのタップ）は後続ブロックで足す。`MatchView` は将来 `LaneBattleApp`
 * に載せる本番の遊べる版で、今はプレビューで単体表示する。
 *
 * Args:
 *     props (object):
 *         deckIds (string[]): プレイヤーの 6 枚デッキ（キャラ ID）。
 *
 * Returns:
 *     JSX.Element: 盤面＋HUD。
 */
export default function MatchView({ deckIds }) {
  const fieldRef = useRef(null);
  const rtRef = useRef(null);
  const [state] = useState(() => createBattleState());
  const [hud, setHud] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const renderer = createRenderer(fieldRef.current);
    const rt = createRuntime({
      deckIds,
      state,
      onFrame: (s, dt) => renderer.sync(s, dt),
      onHud: setHud,
    });
    rtRef.current = rt;
    rt.start();
    return () => {
      rt.destroy();
      renderer.destroy();
      rtRef.current = null;
    };
  }, [deckIds, state]);

  const handleCellTap = (lane, slot) => {
    if (selected == null) return;
    if (rtRef.current?.deploy(selected, lane, slot)) setSelected(null);
  };

  const energyPct = hud ? (hud.energy / hud.energyMax) * 100 : 0;

  return (
    <div className="lbf-match">
      <BattleField
        state={state}
        fieldRef={fieldRef}
        onCellTap={handleCellTap}
        active={selected != null}
      />
      <div className="lbf-hud">
        <span className="lbf-ebar">
          ⚡
          <span className="lbf-ebar-track">
            <i style={{ width: `${energyPct}%` }} />
          </span>
          <b>{hud ? Math.floor(hud.energy) : 0}</b>/{hud ? hud.energyMax : 0}
          <span className="lbf-mult">⏩×{hud ? hud.regenMul : 1}</span>
        </span>
        {hud && (
          <HandBar
            hand={hud.hand}
            next={hud.next}
            selectedIndex={selected}
            onDeploy={(i) => setSelected((cur) => (cur === i ? null : i))}
          />
        )}
      </div>
    </div>
  );
}
