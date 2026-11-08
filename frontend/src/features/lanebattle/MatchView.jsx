import { useEffect, useRef, useState } from 'react';
import BattleField from './BattleField';
import HandBar from './HandBar';
import ResultOverlay from './ResultOverlay';
import config from './data/lanebattle_config.json';
import { createBattleState } from './engine/battleState';
import { createRuntime } from './engine/createRuntime';
import { createRenderer } from './engine/createRenderer';
import { computeScore } from './engine/score';
import useLaneBattleBest from './hooks/useLaneBattleBest';

/* 残り秒を M:SS に整形する（切り上げで自然にカウントダウン）。 */
function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 1 試合分の「遊べる版」コンポーネント（要件 2・3・8）。
 *
 * 駆動層（`createRuntime`）・描画層（`createRenderer`）・HUD（React）をまとめる。
 * `onHud` を state に受けてエナジー・手札を React で更新し、`onFrame` で
 * ユニットを命令的に描画する（数の多いユニットで React 再描画を起こさないため、
 * 描画を二系統に分ける）。対戦状態は `createBattleState` で 1 つ作り、`BattleField`
 * の本陣 HP 表示と駆動層で**同じオブジェクトを共有**する。駆動層・描画層は
 * レンダー中に触れないよう `useEffect` の中で生成する（React の refs 規約）。
 * カードをタップすると手札を選択（ハイライト）し、盤面のセルをタップで配置する。
 * 決着すると駆動層が `onResult` を 1 回だけ呼ぶので、そこで `computeScore` で
 * スコアを出し、`useLaneBattleBest` にベスト提出して `ended` に結果スナップ
 * ショットを置き、`ResultOverlay` を盤面に重ねる（対戦中→結果の段階遷移）。
 * 「もう いちど」は `createBattleState()` を作り直して `state` を差し替える：
 * `useEffect` の依存が変わるので駆動層・描画層ごと作り直り、盤面も HP も初期化
 * される。`MatchView` は将来 `LaneBattleApp` に載せる本番の遊べる版で、今は
 * プレビューで単体表示する。
 *
 * Args:
 *     props (object):
 *         deckIds (string[]): プレイヤーの 6 枚デッキ（キャラ ID）。
 *         cpuDeckIds (string[]): CPU のデッキ（キャラ ID）。`LaneBattleApp` が
 *             難易度に応じて渡す（☆×1 は解放済みからランダム、☆×2/×3 は固定）。
 *         difficulty (object): 難易度プリセット（AIパラメータ・random フラグ等）。
 *         onExit (function): 結果画面の「もどる」。渡されたときだけボタンを出す
 *             （プレビュー単体では戻り先が無いので省略できる）。
 *         onRebuild (function): 結果画面の「デッキを かえる」。渡されたときだけ
 *             ボタンを出す（編成画面へ戻す。アプリ導線で使う）。
 *
 * Returns:
 *     JSX.Element: 盤面＋HUD（＋決着後は結果オーバーレイ）。
 */
export default function MatchView({ deckIds, cpuDeckIds, difficulty, onExit, onRebuild }) {
  const fieldRef = useRef(null);
  const rtRef = useRef(null);
  const [state, setState] = useState(() => createBattleState());
  const [hud, setHud] = useState(null);
  const [selected, setSelected] = useState(null);
  const [ended, setEnded] = useState(null);
  const { best, submit } = useLaneBattleBest();

  useEffect(() => {
    const renderer = createRenderer(fieldRef.current);
    const rt = createRuntime({
      deckIds,
      cpuDeckIds,
      difficulty,
      state,
      onFrame: (s, dt) => renderer.sync(s, dt),
      onHud: setHud,
      onResult: (s) => {
        const score = computeScore(s);
        setEnded({
          win: s.result === 'you',
          score,
          timeSec: s.t / 1000,
          energyUsed: Math.round(s.energySpent.you),
          damage: Math.max(0, Math.round(config.base.hp - s.base.cpu.hp)),
          isNewBest: submit(score),
        });
      },
    });
    rtRef.current = rt;
    rt.start();
    return () => {
      rt.destroy();
      renderer.destroy();
      rtRef.current = null;
    };
  }, [deckIds, cpuDeckIds, difficulty, state, submit]);

  const handleCellTap = (lane, slot) => {
    if (selected == null) return;
    if (rtRef.current?.deploy(selected, lane, slot)) setSelected(null);
  };

  /* 「もう いちど」：新しい state に差し替え、useEffect 経由で駆動層ごと作り直す。 */
  const handleRematch = () => {
    setEnded(null);
    setSelected(null);
    setHud(null);
    setState(createBattleState());
  };

  const energyPct = hud ? (hud.energy / hud.energyMax) * 100 : 0;

  return (
    <div className="lbf-match">
      <div className="lbf-top">
        <span className={`lbf-time${hud && hud.timeLeft < 30 ? ' low' : ''}`}>
          {hud ? formatTime(hud.timeLeft) : ''}
        </span>
      </div>
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
      {ended && (
        <ResultOverlay
          result={ended}
          best={best}
          onRematch={handleRematch}
          onRebuild={onRebuild}
          onExit={onExit}
        />
      )}
    </div>
  );
}
