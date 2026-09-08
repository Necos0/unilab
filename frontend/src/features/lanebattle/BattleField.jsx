import config from './data/lanebattle_config.json';

const { field, deploy } = config;
const pctX = (x) => (x / field.virtualWidth) * 100;
const pctY = (y) => (y / field.virtualHeight) * 100;

/**
 * 3 レーン盤面の描画（フィールド整備。要件 1・2・6・8）。
 *
 * `battleState` を props で受け取り、盤面（3 レーン・自陣の配置ゾーン・
 * 中央ライン・両陣営の本陣 HP バー）を描く純表示コンポーネント。位置は
 * すべて `config.field`／`config.deploy` の仮想座標を親要素に対する % へ
 * 変換して置く（既存エンジンと同じ「仮想座標→%」方式）。本陣 HP バーは
 * `state.base.*.hp` を初期 HP（`config.base.hp`）で割った割合で伸縮し、
 * props の `state` が変わるたびに再描画されて動く（描画は state を読むだけ、
 * state を書き換えるのは交戦ロジック側＝関心の分離）。
 *
 * 既存の 1 レーン版 `BattleView` には手を付けず新規に作る部品で、稼働中の
 * 旧版を壊さずに並行開発する。スタイルは旧 `lb-` と衝突しないよう `lbf-`
 * （lane battle field）接頭辞を新設する。ユニット（キャラ）の出撃・移動は
 * 後続の作業ユニットで各レーン内に描くため、この段では箱までを用意する。
 *
 * Args:
 *     props (object):
 *         state (object): `createBattleState` が返す対戦状態。`base.you.hp`
 *             / `base.cpu.hp` を読む。
 *
 * Returns:
 *     JSX.Element: 3 レーン盤面。
 */
export default function BattleField({ state }) {
  const youHpPct = (state.base.you.hp / config.base.hp) * 100;
  const cpuHpPct = (state.base.cpu.hp / config.base.hp) * 100;

  return (
    <div className="lbf-field">
      {field.laneYs.map((y, lane) => (
        <div
          key={lane}
          className="lbf-lane"
          style={{
            top: `${pctY(y - field.laneHeight / 2)}%`,
            height: `${pctY(field.laneHeight)}%`,
          }}
        >
          {deploy.youSlotXs.map((x, step) => (
            <span key={step} className="lbf-cell" style={{ left: `${pctX(x)}%` }} />
          ))}
        </div>
      ))}

      <div className="lbf-mid" style={{ left: `${pctX(field.midX)}%` }} />

      <div className="lbf-base you" style={{ left: `${pctX(field.youBaseX)}%` }}>
        <span className="lbf-hp"><i style={{ width: `${youHpPct}%` }} /></span>
      </div>
      <div className="lbf-base cpu" style={{ left: `${pctX(field.cpuBaseX)}%` }}>
        <span className="lbf-hp"><i style={{ width: `${cpuHpPct}%` }} /></span>
      </div>
    </div>
  );
}
