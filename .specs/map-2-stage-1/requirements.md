# 要件定義: マップ 2 ステージ 1（map-2-stage-1）

## はじめに

本機能はマップ 2 の最初のステージ（`2-1`）を導入する。これまでのステージは「Start → スロット並び → Goal」の **線形フローチャート** のみで構成されていたが、本ステージで初めて **条件分岐ノード（菱形）** を導入し、実行時のプレイヤー HP に応じて進路が分かれるフローチャートを実現する。条件式は文字列形式で `stages.json` に記述し、将来的な条件種別の追加に拡張可能な設計とする。

ステージ 2-1 のフローチャート構造：

```
Start → monster(50) → 空き → 条件分岐(playerHp > 50)
                                ├─ True(右) → attack(locked, 20) → 合流
                                └─ False(下) → ─────────────────── 合流
                                                                     ↓
                                                                空き → Goal
```

プレイヤーは手札の `attack(10)` と `heal(10)` を空きスロットに配置し、敵モンスター(wolf 仮置き、HP は仕様確定後に調整)を撃破する。条件分岐で「HP が 50 を超えていれば True 経路で追加攻撃 20、そうでなければ素通り」という分岐ロジックを設計し、プレイヤーが「現在の状況に応じて自動的に異なる処理が走る」というプログラミング的思考の概念を学習する。

本ステージはデモ用途も兼ね、`stages.json` の `demoStageId` を `1-1` から `2-1` に変更する。マップ画面のランドマーク表示・ステージ解放管理は本機能のスコープ外（既存のマップ 1 表示のまま）。

## 用語

- **条件分岐ノード**: 菱形で描画される新規ノードタイプ。`condition` 文字列を持ち、実行時に評価して `true` / `false` を返す。
- **True ハンドル / False ハンドル**: 条件分岐ノードの 2 つの出力点。True は **右の頂点**、False は **下の頂点** から出る。
- **分岐エッジ**: 条件分岐ノードの True / False ハンドルから次のノードへ向かうエッジ。`sourceHandle` で `'true'` または `'false'` を指定する。
- **合流**: 条件分岐後の Yes 経路と No 経路が、同じターゲットノードへ向かう複数エッジを持つ構造。明示的な「merge ノード」は持たず、ターゲットノードに複数エッジが入る形で表現する。エッジ自体は React Flow が経路を自動計算するが、視覚的に「エッジ上の一点で合流する」見た目になることを想定。
- **条件式**: `playerHp > 50` のような文字列。実行時に `evaluateCondition(expression, context)` のような関数で評価される。`context` は `{ playerHp, enemyHp, ... }` などの実行時状態。

## 要件

### 要件1: 条件分岐ノードの追加とデータ表現

**ユーザーストーリー：** ステージデザイナーとして、フローチャートに条件分岐を持つステージを `stages.json` で定義したい。なぜなら線形フローでは表現できない「条件に応じた処理の振り分け」を導入することで、プレイヤーがプログラミング的思考を学べるステージを作れるから。

#### 受け入れ基準

1. WHEN `stages.json` のノード定義に新しい種別 `condition` が現れる THEN the system SHALL そのノードを React Flow のカスタムノード（菱形）として描画する
2. WHEN `condition` ノードが定義される THEN the system SHALL `id` / `position` / `condition`(文字列)の 3 フィールドを必須として扱う
3. WHEN `condition` ノードが描画される THEN the system SHALL 視覚的に「条件分岐」と分かる形（菱形）にし、内部に条件式テキスト（例: `playerHp > 50`）を表示する
4. WHEN `condition` ノードが定義される THEN the system SHALL `sourceHandle` を 2 つ持つ：`'true'`（右の頂点）と `'false'`（下の頂点）
5. WHEN `stages.json` のエッジ定義で `sourceHandle: 'true'` または `sourceHandle: 'false'` を指定する THEN the system SHALL そのエッジを対応するハンドルから引く

### 要件2: 条件式の評価ロジック

**ユーザーストーリー：** ステージデザイナーとして、条件式を文字列で書きたい。なぜなら JSON で読みやすく、将来 `enemyHp` や手札条件などを追加するときも柔軟に対応できる形にしたいから。

#### 受け入れ基準

1. WHEN 実行シーケンス中に `condition` ノードに到達する THEN the system SHALL ノードの `condition` 文字列を評価して `true` または `false` を返す
2. WHEN 条件式が `playerHp > 50` のような比較式である THEN the system SHALL 左辺の変数名（`playerHp` / `enemyHp` 等）を実行時の状態値に置換して評価する
3. IF 条件式が解釈できない（未知の変数、構文エラー等）THEN the system SHALL `console.warn` でログを出し、デフォルトで `false` を返す（実行は継続）
4. WHILE 評価ロジックを実装する the system SHALL `eval` や `new Function` を使わず、自前の安全なパーサー実装で評価する（任意コード実行リスクを排除）
5. WHEN 評価関数が利用可能な変数名 THEN the system SHALL `playerHp`、`enemyHp`、`maxPlayerHp`、`maxEnemyHp`、`guardShield`、`reflectActive` の HP / 状態系の数値・boolean 変数を少なくともサポートする（将来追加しやすい設計とする）
6. WHEN 評価関数がサポートする演算子 THEN the system SHALL `>`、`<`、`>=`、`<=`、`===`、`!==` を含む。`===` / `!==` は数値だけでなく文字列・`null` との比較もサポートする
7. WHEN 評価関数が利用可能な関数式 THEN the system SHALL `slot('<スロットID>')` 形式をサポートし、そのスロットに配置されているカードの `id`（文字列）を返す。空きスロット（配置なし）の場合は `null` を返す
8. WHEN 関数式と比較演算子を組み合わせた条件式が書かれる THEN the system SHALL 以下のような表現を正しく評価する：
   - `slot('slot-1') === 'attack'`: slot-1 に attack カードが配置されている
   - `slot('slot-2') === 'heal'`: slot-2 に heal カードが配置されている
   - `slot('slot-3') === null`: slot-3 が空きスロット（または該当 ID のスロットが存在しない）
   - `slot('slot-1') !== 'monster'`: slot-1 がモンスター以外
9. WHEN リテラル値がサポートされる THEN the system SHALL 整数（`50`、`30`）、文字列（`'attack'`、`'heal'`）、`null`、`true`、`false` を最低限サポートする（将来浮動小数や他のリテラルが必要になれば拡張可能な設計とする）

### 要件3: 分岐対応のフェーズ実行

**ユーザーストーリー：** プレイヤーとして、条件分岐ノードを通った瞬間に、その時点の HP に応じて違う経路が実行されるのを見たい。なぜなら「条件に応じて処理が変わる」というプログラミングの基本概念を、視覚的・体感的に理解したいから。

#### 受け入れ基準

1. WHEN 実行シーケンスが `condition` ノードに到達する THEN the system SHALL ノードの `condition` を評価し、結果（`true` / `false`）に応じて続くエッジを選ぶ
2. WHEN 評価結果が `true` THEN the system SHALL `sourceHandle: 'true'` のエッジを次のフェーズに進む
3. WHEN 評価結果が `false` THEN the system SHALL `sourceHandle: 'false'` のエッジを次のフェーズに進む
4. WHEN 分岐で選ばれなかった経路 THEN the system SHALL そのエッジ・ノードのフェーズを実行しない（フェーズ列に含めない）
5. WHEN 分岐の各経路が合流する（複数エッジが同じターゲットを持つ）THEN the system SHALL 選ばれた経路を辿ってターゲットノードに到達し、その後は線形に進む
6. WHEN フェーズ列を組み立てる THEN the system SHALL 既存の `buildExecutionPath` を拡張し、条件分岐の評価結果を `slotAssignments` / `currentPlayerHp` 等の **実行時状態** を見て決定する（事前計算ではなくランタイム計算）

### 要件4: 通過軌跡と分岐の可視化

**ユーザーストーリー：** プレイヤーとして、実行終了後に「どの経路を通ったか」を視覚的に確認したい。なぜなら、Fail 演出時にも自分の選択が正しかったか・どこで分岐したかを振り返れる必要があるから。

#### 受け入れ基準

1. WHEN 実行が `condition` ノードを通過する THEN the system SHALL そのノード id を `traversedNodeIds` に追加する（既存の通過軌跡表示と統合）
2. WHEN 実行が True 経路または False 経路のエッジを通る THEN the system SHALL そのエッジ id を `traversedEdgeIds` に追加し、白いネオン光で固定ハイライトする
3. WHEN 実行が True 経路を通る THEN the system SHALL False 経路のエッジ・ノードには通過ハイライトを付けない（実際に通っていないため）

### 要件5: ロック attack カードのサポート

**ユーザーストーリー：** ステージデザイナーとして、特定スロットに固定の attack カード（プレイヤーが操作できない）を配置したい。なぜなら、条件分岐の True 経路にだけ「報酬」として攻撃を発動させるなど、ステージ設計の自由度を上げたいから。

#### 受け入れ基準

1. WHEN `stages.json` のスロット定義に `lockedCard: { id: 'attack', power: 20 }` のような attack ロックカードが書かれる THEN the system SHALL 既存の `monster` ロックカードと同じ仕組み（`buildSlotAssignmentsFromStage`）でスロットに固定配置する
2. WHEN attack ロックカードが配置されたスロットを実行が通過する THEN the system SHALL 既存の `attack` カード効果（`applyEnemyDamage`）を発火する
3. WHEN attack ロックカードが配置されたスロットにユーザーがカードをドラッグ&ドロップしようとする THEN the system SHALL 既存の `computeDropTransition` の `locked` ガードでドロップを拒否する
4. WHEN attack ロックカードが配置されたスロットを描画する THEN the system SHALL `.lockedCard` クラスを付与して、ホバー時の白い outline などの「ドロップできそう」演出を抑制する（既存の reflect-card-effect 後の挙動と整合）

### 要件6: ステージ 2-1 のデータ定義

**ユーザーストーリー：** プレイヤーとして、`2-1` というステージで条件分岐を含むフローチャートをプレイしたい。

#### 受け入れ基準

1. WHEN `stages.json` に `"2-1"` キーのステージが追加される THEN the system SHALL 以下の構造を持つ：
   - `enemyId`: `"wolf"`（仮置き）
   - `cards`: `[ { id: 'attack', power: 10 }, { id: 'heal', power: 10 } ]`
   - スロット並び: `monster(50)` → 空き → 条件分岐(`playerHp > 50`) → True 経路: `attack(locked, 20)` → 合流先空き、False 経路: 直接合流先空き → 合流先空き → Goal
2. WHEN ステージ 2-1 のロードが完了する THEN the system SHALL 条件分岐ノードを菱形で描画し、True 経路（右へ）と False 経路（下へ）の両方が視覚的に確認できる
3. WHEN ステージ 2-1 を実行する THEN the system SHALL ユーザーが手札 attack(10) / heal(10) を 2 つの空きスロットに配置できる（実行前は空きスロットが 2 つ未埋め）
4. WHEN プレイヤーが正しいカード配置で勝利できる構成 THEN the system SHALL 設計上ステージ 2-1 はクリア可能である

### 要件7: デモバトルの 2-1 化

**ユーザーストーリー：** 開発者として、マップ画面の「バトルデモ」ボタンで 2-1 を即座にテストできるようにしたい。なぜなら、新規導入する条件分岐機能を素早く動作確認したいから。

#### 受け入れ基準

1. WHEN `stages.json` の `demoStageId` を更新する THEN the system SHALL 値を `"1-1"` から `"2-1"` に変更する
2. WHEN アプリ起動直後にマップ画面が表示される THEN the system SHALL `App.jsx` の `stageId` 初期値が `stagesData.demoStageId` 経由で `"2-1"` になる
3. WHEN 「バトルデモ」ボタンが押される THEN the system SHALL ステージ 2-1 の戦闘画面へ遷移する

### 要件8: 既存システムとの整合

**ユーザーストーリー：** 開発者として、本機能の追加が既存のマップ 1 ステージ（1-1〜1-4）の挙動を一切壊さないことを保証したい。

#### 受け入れ基準

1. WHEN マップ 1 のステージ（1-1〜1-4）を実行する THEN the system SHALL 従来通り線形フェーズ実行で動作する（条件分岐対応のコード変更が既存挙動を壊さない）
2. WHEN `stagesLoader.js` がステージ定義を展開する THEN the system SHALL `condition` ノードを含むステージでは `slots` / `edges` を明示指定する形で対応し、線形ステージは引き続き短縮形式（`{}` のみ）で動作する
3. WHEN `buildExecutionPath` が線形ステージを扱う THEN the system SHALL 既存と同じ「Start → slot-1 → ... → Goal」のフェーズ列を返す
4. WHEN 既存の `guard` / `reflect` カード効果を持つステージで実行する THEN the system SHALL 既存の効果ロジックがそのまま発火する（条件分岐実装の追加が干渉しない）
