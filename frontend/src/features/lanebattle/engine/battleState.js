import config from '../data/lanebattle_config.json';

/**
 * 対戦 1 回分の状態オブジェクトを生成する（3 レーン版の土台。要件 6・8）。
 *
 * DOM や React に一切依存しない純オブジェクトを返す。描画・入力・CPU から
 * 分離した「勝敗が決まる計算」の入れ物。フィールドは次のとおり：
 *   - `t`      : 経過ミリ秒（攻撃間隔・移動の積算に使う）。
 *   - `base`   : 各陣営の本陣。`you.hp`/`cpu.hp`（体力）と `defT`（防衛攻撃の
 *                クールダウン）。
 *   - `shield` : 死亡シールド（deathShield 能力）の陣営フラグ。`{t, mul}` で
 *                残り時間と被ダメ倍率を持つ（個体ではなくチーム全体に効く）。
 *   - `energy` : 各陣営の現在エナジー（`you`/`cpu`）。`stepSim` が時間で回復する。
 *   - `energySpent` : 各陣営が使ったエナジー総量（スコア用。ユニット5で使う）。
 *   - `units`  : 場に出ているユニットの配列（`spawnUnit` が積む）。
 *   - `result` : 決着。`'you'` / `'cpu'` / `null`。
 * デッキ（手札）や seed 付き乱数などは、それらが要る後続の作業ユニットで足す。
 *
 * config はインポート済みの既定値を使うが、引数 `cfg` でも差し込めるように
 * してある。headless テストで別の設定を渡してこの純関数を単体検証できる
 * ようにするため（横断原則「決定的・テストしやすさ」）。本陣 HP は
 * `config.base.hp` を両陣営に同値で入れる（左右対称）。
 *
 * Args:
 *     cfg (object): 盤面・本陣などの設定。省略時は `lanebattle_config.json`。
 *
 * Returns:
 *     object: 対戦状態。`t` / `base` / `shield` / `units` / `result` を持つ。
 */
export function createBattleState(cfg = config) {
  return {
    t: 0,
    base: {
      you: { hp: cfg.base.hp, defT: 0 },
      cpu: { hp: cfg.base.hp, defT: 0 },
    },
    shield: {
      you: { t: 0, mul: 1 },
      cpu: { t: 0, mul: 1 },
    },
    energy: { you: cfg.energyStart, cpu: cfg.energyStart },
    energySpent: { you: 0, cpu: 0 },
    units: [],
    result: null,
  };
}
