# タスク一覧: なかまの城（レーン大戦争ミニゲーム）

## 概要

`frontend/src/features/lanebattle/` に自己完結で積み上げる。クリティカルパスは **データ層（config/units・deriveUnitDef）→ エンジン（deck→engine→abilities→cpuAI）→ React 層（hook→BattleView/HandBar→DeckBuilder→Result）→ 隔離マウント（Gate→main.jsx 1行）→ バランス/検証**。テストフレームワークが無いため、完了条件は主に **`npm run lint` 通過 + ヘッドレス（headless Chrome）での自動対戦/描画確認 + 実アプリでの手動確認** で判定する。特殊能力の**具体数値はユーザーが並行決定**するため、能力は仕組みを完成させ、値は暫定（企画プレゼンの4体）で置いて後から差し替え可能にする。

合計タスク数：16件 ｜ 想定工数：約 8〜10 時間（MVP＝タスク1〜12 で「起動→編成→対戦→勝敗→自己ベスト」が通る）

> **MVP ライン**：タスク12完了で遊べる状態。タスク13〜14で隔離マウント完成、15でバランス、16で最終検証。

## タスク

- [x] **1. feature 雛形とデータ2ファイル**
  - 内容：`features/lanebattle/` を作成。`data/lanebattle_config.json`（城HP・エネルギー回復/上限・エスカレーション・攻撃間隔・スコア係数・CPUペース・derive係数）と `data/lanebattle_units.json`（ロスター許可リスト＝`dragon_final`除く16体、および `UnitOverride[]`。初期上書きは golem/cobra/cactus/wolf の暫定値）を用意。
  - ファイル：`frontend/src/features/lanebattle/data/lanebattle_config.json`、`.../data/lanebattle_units.json`
  - 依存：なし
  - 完了条件：両 JSON が有効（`python3 -c json.load` でパス）で、config に全調整キーが存在する。

- [x] **2. `deriveUnitDef`（既定算出＋上書き）**
  - 内容：`enemies.json` の `maxHp`/`sizeRatio` から cost/atk/spd/hp と既定 range/splash/deathbomb を算出し、`lanebattle_units.json` の上書きを適用して `UnitDef` を返す純関数。許可リスト外 id は対象外。
  - ファイル：`frontend/src/features/lanebattle/engine/deriveUnitDef.js`
  - 依存：タスク1
  - 完了条件：ヘッドレスで全16体の `UnitDef` を出力し、golem HP が上書き値・未上書き敵が自動値になることを確認（要件7,14）。

- [x] **3. `createDeck`（6枚キュー・手札3・ローテ）**
  - 内容：`createDeck(ids)` → `{ hand(), nextPreview(), play(index) }`。`play` で該当を最後尾へ。player/CPU 共通。
  - ファイル：`frontend/src/features/lanebattle/engine/createDeck.js`
  - 依存：なし
  - 完了条件：ヘッドレスで「6枚を順に play → 出したカードが3手後に手札へ戻る」ローテを検証（要件4）。

- [x] **4. `laneSprite`（命令的スプライトノード）**
  - 内容：レーン上1ユニットの DOM（`.unit`＝オーラ＋`<img>`＋HPバー）を生成し、`setFrame`/`setPos`/`playDead`/`setHp` を提供。フレーム URL は `getEnemyFramePath` を再利用、使用フレームは `new Image()` で先読み。自陣=青オーラ＋右向き、CPU=赤オーラ＋左向き。
  - ファイル：`frontend/src/features/lanebattle/engine/laneSprite.js`、`.../BattleView.module.css`（`.unit` 等）
  - 依存：なし（`getEnemyFramePath` を import）
  - 完了条件：ヘッドレスで1体を配置し idle が再生・青/赤オーラと向きが出る（要件6,8）。

- [x] **5. `createLaneBattleEngine`（コア：進軍・戦闘・勝敗・HUD）**
  - 内容：状態（units/城HP/energy/elapsed/score）と rAF ループ。エネルギー回復＋エスカレーション、単体近接の攻撃、前進、敵城ダメージ、死亡（dead再生→除去）、勝敗判定、`onHud`（間引き）/`onEnd`。`deployCard(index)`。
  - ファイル：`frontend/src/features/lanebattle/engine/createLaneBattleEngine.js`
  - 依存：タスク2,3,4
  - 完了条件：ヘッドレス自動対戦で「出撃→進軍→接触戦闘→城ダメージ→どちらかの城0で `onEnd`」まで到達（要件5,6,10,11）。

- [x] **6. 特殊能力の解決＋演出（splash/ranged/deathbomb）**
  - 内容：`resolveAttack` を範囲（着弾点周囲）・遠距離（間合い外＋弾演出）・単体に分岐。死亡時 `deathbomb` で周囲ダメージ。リング/弾の軽量 fx（純DOM＋CSS transition）。
  - ファイル：`frontend/src/features/lanebattle/engine/resolveAttack.js`、`createLaneBattleEngine.js`、`BattleView.module.css`（`.ring`/`.shot`）
  - 依存：タスク5
  - 完了条件：ヘッドレスで golem=範囲・cobra=遠距離弾・cactus=死亡爆弾が発火（対象複数にダメージ）することを確認（要件7）。

- [x] **7. `cpuAI`（CPUデッキ制の自動プレイ）**
  - 内容：CPU 用 `createDeck` をシャッフルで用意し、エネルギー回復（同エスカレーション）＋手札から出せるカードを間隔乱数で選び出撃→ローテ。強さは `config.cpu`（デッキ/ペース/開始エネルギー）で調整可能に。
  - ファイル：`createLaneBattleEngine.js`（`cpuAI` メソッド）、`data/lanebattle_config.json`（cpu 項）
  - 依存：タスク5
  - 完了条件：ヘッドレスで CPU が複数種のユニットを波状に展開し、放置すると自陣が負けうることを確認（要件9）。

- [x] **8. `useLaneBattleEngine` フック（React↔エンジン橋渡し）**
  - 内容：レーン ref を受けてエンジンを生成・破棄。`onHud` を throttled に React state へ反映（energy/score/城HP/手札/勝敗）。`deploy`/`rematch`/`setDiffMode` を返す。
  - ファイル：`frontend/src/features/lanebattle/hooks/useLaneBattleEngine.js`
  - 依存：タスク5,6,7
  - 完了条件：React 上でエンジンが動き、アンマウントで rAF/リスナーが確実に解放される（多重生成なし）。

- [x] **9. `BattleView` ＋ `HandBar`（アリーナのReact枠）**
  - 内容：HUD（両城HPゲージ・スコア）・レーン枠（ref をエンジンへ）・エネルギーバー・手札3枚＋つぎ・見分けモード切替。カードタップで `deploy(index)`、コスト不足は無効表示。
  - ファイル：`frontend/src/features/lanebattle/BattleView.jsx`、`HandBar.jsx`、`BattleView.module.css`
  - 依存：タスク8
  - 完了条件：実アプリ/ヘッドレスで手札から出撃でき、エネルギー・スコア・城HPが更新表示される（要件4,5,8,10,11）。

- [x] **10. `DeckBuilder`（16→6 編成）**
  - 内容：ロスター16体の一覧、選択トグル、6体で開始可、残り枚数表示、初期おすすめデッキ。各キャラのコスト/HP/特殊ラベルを表示。
  - ファイル：`frontend/src/features/lanebattle/DeckBuilder.jsx`、`DeckBuilder.module.css`
  - 依存：タスク2
  - 完了条件：6体ちょうどで開始ボタンが活性、7体目は拒否、選択解除が効く（要件3）。

- [x] **11. `useLaneBattleBest` ＋ `ResultOverlay`（自己ベスト・結果）**
  - 内容：`localStorage['lanebattle.bestScore']` の読み書きフック。結果画面で勝敗・今回スコア・自己ベスト・更新表示・「もう一度」「編成しなおす」「もどる」。
  - ファイル：`frontend/src/features/lanebattle/hooks/useLaneBattleBest.js`、`ResultOverlay.jsx`、`ResultOverlay.module.css`
  - 依存：タスク8,9
  - 完了条件：勝敗後に結果が出て、ベスト更新が保存・再表示される。本編セーブに別キーで干渉しない（要件2,12,13）。

- [x] **12. `LaneBattleApp`（フェーズ状態機械の統合）**
  - 内容：`deckbuild`/`battle`/`result` を state で切替え、DeckBuilder→BattleView→ResultOverlay を束ねる。「もう一度」＝同デッキで再戦、「もどる」＝閉じる要求を親（Gate）へ通知。
  - ファイル：`frontend/src/features/lanebattle/LaneBattleApp.jsx`、`LaneBattleApp.module.css`
  - 依存：タスク9,10,11
  - 完了条件：**MVP**：編成→対戦→結果→再戦/編成のループが1画面内で完結（要件13）。

- [x] **13. `useHiddenCommand` ＋ `LaneBattleGate`（隠しコマンド＋オーバーレイ）**
  - 内容：`useHiddenCommand('wqinouelabegg', onFire)`（capture keydown・入力欄/修飾キーのガードを自前再現）。`LaneBattleGate` が検出で `createPortal` により全画面オーバーレイをマウント、「もどる」でアンマウント＋フォーカス復帰。
  - ファイル：`frontend/src/features/lanebattle/LaneBattleGate.jsx`、`hooks/useHiddenCommand.js`、`LaneBattleGate.module.css`
  - 依存：タスク12
  - 完了条件：任意画面で `wqinouelabegg` 打鍵→起動、終了→元画面。入力欄フォーカス中・修飾キー押下では発動しない（要件1,15）。

- [x] **14. マウント（共有変更は1行）＋ README 同期**
  - 内容：`main.jsx` に `<LaneBattleGate />` を1行追加（`App` は無変更）。`README.md` の構造図に `features/lanebattle/` を追記。
  - ファイル：`frontend/src/main.jsx`、`README.md`
  - 依存：タスク13
  - 完了条件：`npm run lint` 通過、`npm run build` 成功、他の共有ファイル差分が `main.jsx` の1行のみ（要件15）。

- [ ] **15. バランス初期調整（ヘッドレス自動対戦で計測→config追い込み）**
  - 内容：ヘッドレスでプレイヤー/CPU 双方を自動プレイさせ、平均決着時間・勝率・撃破数・膠着有無を計測するスクリプトで `lanebattle_config.json` を反復調整。目標：おおよそ 60〜120 秒で決着、極端な一方勝ちや無限膠着が無い。
  - ファイル：`frontend/src/features/lanebattle/data/lanebattle_config.json`（値のみ）、（計測用スクリプトはスクラッチパッド）
  - 依存：タスク7,12
  - 完了条件：複数回のシミュレーションで目標レンジに収まり、ロジックコードは無変更（要件14）。

- [ ] **16. 最終E2E確認とテスト生成物の掃除**
  - 内容：`npm run dev` で実起動→`wqinouelabegg`→編成→勝ち/負け→自己ベスト保存→再戦→もどる、を一通り手動＋ヘッドレスで確認。スクショ等の一時生成物を削除。
  - ファイル：（コード変更なし。確認とクリーンアップ）
  - 依存：タスク14,15
  - 完了条件：全要件のふるまいが実機で確認でき、リポジトリに一時ファイルが残らない（プロジェクト規約）。
