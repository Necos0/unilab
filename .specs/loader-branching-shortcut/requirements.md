# 要件定義: 条件分岐ステージの短縮形式ローダー（loader-branching-shortcut）

## はじめに

本機能は、`stages.json` で条件分岐を含むステージを定義するときの記述量を大幅に削減する。現状、分岐ステージは `slots` / `conditions` / `edges` / 各ノードの `id` / `position` / `sourceHandle` をすべて明示的に書く必要があり、簡単な分岐でも 30 行以上になる。本機能で新規導入する `flow` キーは「階層構造で書くだけで、id・position・edges が自動算出される」仕組みを提供する。

線形ステージ（マップ 1）は引き続き既存の `slots` キーで記述でき、本機能の追加は完全に後方互換である。`stagesLoader` は `flow` キーがあればそれを優先、なければ `slots` を使うルーティングで両形式を共存サポートする。

実装後、ステージ 2-1 を `flow` 形式に書き直して短縮効果を実感する。マップ 1 のステージは触らない（線形は `slots` 形式のままで十分に簡潔なため）。

## 用語

- **`flow` 形式**: 本機能で新規導入する短縮形式。`stage.flow` 配列に「通常スロット要素」と「条件分岐要素」を階層的に並べる。
- **`slots` 形式**: 既存の線形ステージ向け形式。マップ 1 のステージで使用中。本機能ではそのまま維持する。
- **通常スロット要素**: `flow` 配列内の要素のうち、`condition` キーを持たないオブジェクト。`{}` または `{ lockedCard: {...} }` の形。
- **条件分岐要素**: `flow` 配列内の要素のうち、`condition` キー（文字列）を持つオブジェクト。`true` / `false` キーにそれぞれの経路の配列（ネストした `flow` 構造）を持つ。
- **メイン経路**: `flow` の最上位配列に並ぶ要素列。y 座標は 120（既存規約）。
- **False 経路**: 条件分岐要素の `false` キー配列。y 座標を下にずらす（y=280）。
- **合流先**: 条件分岐の True / False 経路がどちらも収束する次のノード。`flow` 配列で「条件分岐要素の次にある要素」または `goal`。

## 要件

### 要件1: `flow` キーの新規導入と後方互換性

**ユーザーストーリー：** ステージデザイナーとして、分岐ステージを階層構造の JSON で簡潔に書きたい。なぜなら、明示形式（`slots` + `conditions` + `edges` + position 等）は冗長で、簡単な分岐でも 30 行以上になり、構造が読み取りにくいから。

#### 受け入れ基準

1. WHEN `stages.json` のステージ定義に `flow` キーが存在する THEN the system SHALL `flow` 配列を解析して `slots` / `conditions` / `edges` / `start` / `goal` を自動生成する
2. WHEN ステージ定義に `flow` キーが存在しない AND `slots` キーが存在する THEN the system SHALL 既存の `slots` 形式の処理ルートを使う（マップ 1 のステージは無変更で動作）
3. IF ステージ定義に `flow` と `slots` の両方が存在する THEN the system SHALL `flow` を優先し、`console.warn` で「両方のキーが定義されている、`flow` を使う」と警告を出す
4. WHEN `flow` を使って展開した結果 THEN the system SHALL 既存の `expandStage` 戻り値と同じ形（`{ enemyId, cards, slots, conditions, start, goal, edges }`）を返す（後段の `battleStore` 等は形式の違いを意識せず動作する）

### 要件2: `flow` 配列の要素の種類

**ユーザーストーリー：** ステージデザイナーとして、`flow` 配列に「通常スロット」と「条件分岐」を直感的に並べて書きたい。

#### 受け入れ基準

1. WHEN `flow` 配列の要素が `condition` キーを持たない THEN the system SHALL その要素を「通常スロット」として扱う。`{}` または `{ lockedCard: {...} }` の形を受け付ける
2. WHEN `flow` 配列の要素が `condition` キー（文字列）を持つ THEN the system SHALL その要素を「条件分岐」として扱う
3. WHEN 条件分岐要素が `true` キーを持つ THEN the system SHALL その値を配列として受け取り、True 経路のサブフローとして扱う（再帰的に同じ `flow` 形式）
4. WHEN 条件分岐要素が `false` キーを持つ THEN the system SHALL その値を配列として受け取り、False 経路のサブフローとして扱う
5. IF `true` または `false` キーが省略されている THEN the system SHALL 空配列として扱う（その経路は「分岐後すぐに合流」になる）
6. WHEN 条件分岐要素が `condition` 以外のフィールド（例: `lockedCard`）を持っていても THEN the system SHALL それらは無視する（条件分岐ノードはカードを持たないため）

### 要件3: ノード id の自動採番

**ユーザーストーリー：** 開発者として、`flow` 形式で id を書かなくても、フローチャート全体でユニークな id が自動的に振られることを保証したい。なぜなら、id 衝突は React のキー警告や `battleStore` の `slotAssignments` 読み取り失敗の原因になるから。

#### 受け入れ基準

1. WHEN 通常スロット要素を展開する THEN the system SHALL `slot-N` 形式の id を採番する。N は `flow` 全体（メイン経路 + すべてのサブフロー）で連番（1, 2, 3, ...）
2. WHEN 条件分岐要素を展開する THEN the system SHALL `cond-M` 形式の id を採番する。M は `flow` 全体での条件分岐の連番（1, 2, 3, ...）
3. WHEN 採番は深さ優先・走査順で行う THEN the system SHALL メイン経路 → 各分岐の True → False の順に走査し、出現順で id を振る

### 要件4: 座標の自動計算

**ユーザーストーリー：** ステージデザイナーとして、座標を書かずに「分岐は下に広がる」レイアウトが自動で得られる形にしたい。

#### 受け入れ基準

1. WHEN メイン経路の要素を配置する THEN the system SHALL `x = SLOT_X_START + column * SLOT_X_STEP`、`y = 120` の座標を割り振る。column はメイン経路上の位置インデックス（0 から）
2. WHEN 条件分岐要素を配置する THEN the system SHALL メイン経路上の他要素と同じ y=120 に配置する
3. WHEN True 経路の要素を配置する THEN the system SHALL `y = 120` のまま「メイン経路の延長」として右に並べる
4. WHEN False 経路の要素を配置する THEN the system SHALL `y = 280` に配置する（メイン経路より下、菱形ノード+次のスロットが重ならない位置）
5. WHEN 分岐後の合流先（メイン経路上で条件分岐の次の要素）を配置する THEN the system SHALL `y = 120`、column は「True 経路の長さと False 経路の長さの最大 + 1（条件分岐自身も加算）」で算出する
6. IF メイン経路の最後が条件分岐要素である THEN the system SHALL True / False 経路の各最終要素から `goal` へ直接エッジを引き、合流先ノードを別途生成しない
7. `start` ノードの座標は既存の規約（`{ x: START_X, y: 120 }`）、`goal` ノードは `{ x: 全体の最大 column 位置, y: 120 }` を採用する

### 要件5: edges の自動生成

**ユーザーストーリー：** 開発者として、`flow` 形式から正しい構造のエッジ配列が自動生成され、`stagesLoader` の戻り値が既存の明示形式と完全に同じ形になることを保証したい。

#### 受け入れ基準

1. WHEN 通常スロットから次の通常スロットへ接続する THEN the system SHALL `{ id: 'e-${src}-${dst}', source, target }` のエッジを生成する（`sourceHandle` なし、線形ステージと同形式）
2. WHEN 通常スロットから条件分岐ノードへ接続する THEN the system SHALL `{ id: 'e-${src}-${dst}', source, target }` のエッジを生成する
3. WHEN 条件分岐ノードから True 経路の最初の要素へ接続する THEN the system SHALL `{ id, source, target, sourceHandle: 'true' }` を生成する
4. WHEN 条件分岐ノードから False 経路の最初の要素へ接続する THEN the system SHALL `{ id, source, target, sourceHandle: 'false' }` を生成する
5. WHEN True 経路が空配列 THEN the system SHALL 条件分岐から直接合流先へ `sourceHandle: 'true'` のエッジを引く
6. WHEN False 経路が空配列 THEN the system SHALL 条件分岐から直接合流先へ `sourceHandle: 'false'` のエッジを引く
7. WHEN True / False 経路の最終要素から合流先へ接続する THEN the system SHALL 通常の線形エッジ（`sourceHandle` なし）を生成する
8. WHEN メイン経路の最後の要素から `goal` へ接続する THEN the system SHALL `e-${src}-goal` のエッジを生成する
9. WHEN 条件分岐がメイン経路の最後の要素 THEN the system SHALL True / False の最終要素から `goal` へ直接エッジを引く（要件 4-6 と整合）

### 要件6: ステージ 2-1 の短縮形式への書き換え

**ユーザーストーリー：** プレイヤーとして、ステージ 2-1 が短縮形式で書かれていても、明示形式と同じ挙動で動くことを確認したい。

#### 受け入れ基準

1. WHEN ステージ 2-1 を `flow` 形式で書き換える THEN the system SHALL 以下の構造になる（既存の明示形式と同じ実行結果を生む）：
   ```json
   "2-1": {
     "enemyId": "wolf",
     "cards": [
       { "id": "attack", "power": 10 },
       { "id": "heal",   "power": 10 }
     ],
     "flow": [
       { "lockedCard": { "id": "monster", "power": 50 } },
       {},
       {
         "condition": "playerHp > 50",
         "true": [
           { "lockedCard": { "id": "attack", "power": 20 } }
         ],
         "false": []
       },
       {}
     ]
   }
   ```
2. WHEN ステージ 2-1 を読み込んで実行する THEN the system SHALL 明示形式時と同じノード配置・同じエッジ接続・同じ条件分岐挙動を再現する
3. WHEN ステージ 2-1 の `flow` 形式から展開された結果 THEN the system SHALL `stage.slots` が 4 件、`stage.conditions` が 1 件、`stage.edges` が 7 件含まれる

### 要件7: 入れ子分岐への対応（将来拡張）

**ユーザーストーリー：** 開発者として、`flow` 形式が「True 経路の中にさらに条件分岐」のような入れ子構造にも対応できる設計であることを保証したい。なぜなら将来のステージで複雑な分岐を導入する可能性があるから。

#### 受け入れ基準

1. WHEN `true` または `false` キーの配列の中に条件分岐要素が含まれる THEN the system SHALL 再帰的にその分岐を展開し、入れ子の階層が深くなっても正しく処理する
2. WHEN 入れ子の分岐に対する座標計算 THEN the system SHALL 親の経路（True / False）の y 座標を基準として、さらにネストした分岐の False 経路はさらに下へずらす（y のオフセットを階層ごとに加算）。具体的な値は実装時に調整、最低限「重ならない」ことを保証
3. WHEN 入れ子の分岐に対する id 採番 THEN the system SHALL `slot-N` / `cond-M` のグローバル連番として、入れ子も含めた走査順で振る

### 要件8: バリデーションとエラー処理

**ユーザーストーリー：** 開発者として、`flow` の書き間違いがあったときに、無音で間違った挙動になるのではなく、明確なログが出てほしい。

#### 受け入れ基準

1. WHEN `flow` が配列でない THEN the system SHALL `console.warn` で「`flow` must be an array」を出し、空ステージとして扱う
2. WHEN `flow` 要素が `condition` を持つが `true` / `false` キーがどちらも未定義 THEN the system SHALL 両方を空配列として扱う（要件 2-5 と整合）
3. WHEN 通常スロット要素に未知のフィールドが含まれる THEN the system SHALL 警告は出さず、`lockedCard` のみ抽出する（将来フィールドの追加に備える前方互換性）

### 要件9: 既存システムとの整合

**ユーザーストーリー：** 開発者として、本機能の追加が既存のステージ実装・既存ローダー・既存ユーティリティを壊さないことを保証したい。

#### 受け入れ基準

1. WHEN マップ 1 のステージ（1-1〜1-4、`slots` キーのみ）を読み込む THEN the system SHALL 従来通り `slots` ベースのローダーで処理する（コードパスは変わらず、後方互換）
2. WHEN ステージ 2-1 を `flow` 形式に書き換えた後 THEN the system SHALL 既存の `battleStore.startExecution` / `FlowchartArea` / `ConditionNode` / `evaluateCondition` がそのまま動作する（戻り値の形が変わらないため）
3. WHEN ローダー拡張の実装位置 THEN the system SHALL `stagesLoader.js` 内に追加する。新規ファイル作成は避け、既存の `expandStage` を「`flow` または `slots` のどちらを使うか」のルーティング起点とする
