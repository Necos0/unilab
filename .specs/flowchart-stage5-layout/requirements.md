# 要件定義: フローチャート縦レイアウト拡張（stage5 向け）

## はじめに

ワールド5のステージは while / for / 条件分岐が多段に連なるため、1 行（横一列）に並べると右へ伸びすぎて読めない。これを**縦に折り返して**レイアウトするために、`stagesLoader` の `flow` DSL に **2 つの機能**を追加する。どちらも stage5 の複数ステージで再利用する想定で、**designer が明示的に指定**する（自動では効かせない＝既存ステージ非破壊）。

- **機能1：ループ脱出エッジの「潜り込み」ルーティング**（明示タグ）
  `trueDir:"down"` のループ脱出エッジを、右側へ展開される if-false スロット列より**下を通して**次ノードへ繋ぎ、エッジがスロットと重ならないようにする。
- **機能2：「改行（newline）」構文**
  `{ "newline": {} }` を置くと、以降のノードを**次の行**に配置し、**左端（START 列）から右方向のまま**並べ直す。接続エッジは既存スロット・エッジの**下を通して**左端まで伸ばす。

対象は `src/data/stagesLoader.js`（展開）と、必要に応じて描画側（`FlowchartArea` / `AnimatedProgressEdge` / `ConditionNode` のハンドル）。既存構文（`loop` / `for` / `condition` / `turn` / `multiplier` / `acceptOnly` / `lockedCard`）と既存ステージ（1-1〜4-4）の出力は変えない。

## 要件

### 要件1: ループ脱出エッジの潜り込みルーティング（明示タグ）
**ユーザーストーリー：** ステージ作者として、下向きに脱出するループの脱出エッジを、右側の if-false スロットの下を潜らせて次へ繋ぎたい。なぜなら、同じ行に並ぶ false 分岐スロットの上をエッジが横切ると、線とカードが重なって読めなくなるから。

#### 受け入れ基準
1. WHEN `loop` に脱出ルーティング指定タグ（設計で名称確定。例 `exitRoute: "under"`）があり、かつ `trueDir: "down"` THEN the system SHALL その脱出（`true`）エッジを、同じ行の右側に展開される false 分岐スロット列**より下**を通る経路で次ノードへ接続する
2. WHEN そのタグが**未指定** THEN the system SHALL 従来どおりの脱出エッジ経路で接続する（非破壊）
3. IF ループの脱出直後がゴールである（4-1 / 4-4 型） THEN the system SHALL `resolveGoalPlacement` の既存挙動を変更しない
4. WHEN 潜り込みエッジを描画する THEN the system SHALL エッジ経路が false 分岐スロットの矩形と重ならないようにする

### 要件2: 「改行（newline）」構文
**ユーザーストーリー：** ステージ作者として、横に伸びた流れを任意の位置で改行し、左端から次の行に続けたい。なぜなら、while が複数連なると 1 行では画面に収まらず、下の行へ折り返したいから。

#### 受け入れ基準
1. WHEN `flow` 配列に `{ "newline": {} }` 要素が現れる THEN the system SHALL 以降のノードを**新しい行**（配置済み全ノードの最大 y より下、`LOOP_ROW_GAP` 分下げた y）に配置する
2. WHEN 改行後に最初のノードを置く THEN the system SHALL `column` を**左端（START 列）**に戻し、走査方向は **right のまま**（左→右）継続する
3. WHEN 改行直前の終端から改行後の最初のノードへ接続する THEN the system SHALL 既存スロット・エッジの**下を通る**潜り込みエッジで繋ぐ（スロットと重ならない）
4. WHERE `newline` が同一 flow 内で複数回使われる the system SHALL そのたびに新しい行へ改行する（`turn` のような 1 回制限は設けない）
5. IF `newline` が flow 先頭にある（直前にスロット／ループ／条件が無い） THEN the system SHALL `console.warn` して無視する（安全側。`turn` と同様）
6. IF `newline` が loop body / 条件分岐の内側に書かれている THEN the system SHALL `console.warn` して無視する（top-level のみ有効。`turn` と同様）
7. WHEN `newline` を 1 つも含まないステージを展開する THEN the system SHALL 従来と**完全に同一**のノード・エッジ出力を返す（非破壊）

### 要件3: 既存構文・既存ステージへの非回帰
**ユーザーストーリー：** 開発者として、2 機能の追加が既存のフローチャートを壊さないようにしたい。なぜなら、1-1〜4-4 は検証済みの資産だから。

#### 受け入れ基準
1. WHEN 2 機能を追加する THEN the system SHALL `turn` / `loop` / `for` / `condition` / `multiplier` / `acceptOnly` / `lockedCard` の既存セマンティクスを変更しない
2. WHEN 既存ステージ（1-1〜4-4、タグ・newline を使わない）を展開する THEN the system SHALL 変更前と同一の `slots` / `conditions` / `mergeNodes` / `forStarts` / `forEnds` / `edges` / `start` / `goal` を生成する
3. WHEN 変更後に build / lint を実行する THEN the system SHALL エラーなく通過する（既存の無関係警告を除く）

### 要件4: 検証可能性
**ユーザーストーリー：** 開発者として、2 機能が意図どおり配置・接続するかを機械的に確認したい。なぜなら、レイアウトは目視だけだと回帰を見落とすから。

#### 受け入れ基準
1. WHEN 機能を実装する THEN the system SHALL `stagesLoader` 展開結果（ノード y 行・エッジの source/target ハンドル）を検査して、改行後ノードが新しい行・左端に来ること、脱出エッジが下回り経路のハンドルを持つことをヘッドレスに確認できる
2. WHEN 5-1 を題材にする THEN the system SHALL while① 脱出が if-false 列の下を通り、while②→-60→+45 の後の `newline` で for 以降が次行・左端から並ぶ配置になる
