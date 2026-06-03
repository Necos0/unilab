# 要件定義: ループカウンタ機能

## はじめに

`flowchart-loop` で導入した while / do-while ループに、**周回数を積み上げて他のスロットに伝える仕組み** を追加する。ループ body 内に置かれた **counter ノード**（金枠・力こぶの power-up アイコンを持つ `lockedCard`）と、それに ID で紐づく **multiplier スロット**（同じく金枠）をペアにし、counter を通過するたびにペアの multiplier の倍率値が +1 される。プレイヤーは「ループで何周ぶん貯めるか」を考え、ループを抜けた後（将来的にはループ内も）に「倍率 × カードの power」で一撃を放つ、というパズル要素が生まれる。

利用者は 2 種類いる：
- **ステージデザイナー**（このプロジェクトの作成者）：`stages.json` に「counter＋multiplier ペア」を ID 参照で宣言的に書ける。
- **プレイヤー（小学生想定）**：`stage 4-3` で「ループで値をためる＝変数に値を蓄積する」というプログラミングの基礎概念をパズルとして体験する。

最初の具体的な成果物は **stage 4-3 の書き換え**：既存の `body` 末尾に **6 番目** として counter (`counterId: "c1"`) を追加し、ループ後の `{ "multiplier": 5 }` を `{ "multiplier": { "counterRef": "c1" } }` に置き換える。既存の手札・敵 HP・ループ条件は変更しない。

### スコープと前提（今回の方針）

- **対象は「単一カウンタ＋単一連動 multiplier」のみ**。複数カウンタ（シルバー枠等で識別する追加カウンタ）、同一 counterId に対する複数の multiplier 参照、入れ子ループ内のカウンタは **今回の対象外**（将来拡張）。
- **multiplier スロットの配置はループ後のみ**を想定（stage 4-3 の構造）。ループボディ内に multiplier を置いてカウントと同周回で連動させるケースは **今回の対象外**（将来拡張）。
- カウンタ値を **`evaluateCondition` の条件式から参照する機能は対象外**（例：`loopCount >= 5` のような脱出条件は書けない）。ループの脱出条件は引き続き `playerHp` / `enemyHp` 等の既存変数のみ。
- 既存の `multiplier: 5`（数値リテラル）記法は **完全後方互換**で残し、新記法 `multiplier: { counterRef: ... }` を使ったときだけカウンタ連動が有効になる。

### 想定する記述イメージ（※具体的なキー名は設計フェーズで微調整可能）

```jsonc
"4-3": {
  "enemyId": "wolf",
  "maxEnemyHp": 100,
  "cards": [
    { "id": "attack", "power": 5 },
    { "id": "attack", "power": 15 },
    { "id": "guard",  "power": 30 },
    { "id": "heal",   "power": 10 },
    { "id": "heal",   "power": 10 },
    { "id": "heal",   "power": 10 }
  ],
  "flow": [
    {
      "loop": {
        "mode": "post",
        "condition": "playerHp <= 50 && enemyHp <= 50",
        "label": "自分のHPが50以下で敵のHPも50以下",
        "trueDir": "right",
        "falseDir": "up",
        "body": [
          {},
          { "lockedCard": { "id": "monster", "power": 60 } },
          {},
          {},
          {},
          { "lockedCard": { "id": "counter", "counterId": "c1" } }   // 6 番目として追加
        ]
      }
    },
    {},
    { "lockedCard": { "id": "monster", "power": 50 } },
    { "multiplier": { "counterRef": "c1" } }                          // 既存の "multiplier": 5 から置換
  ]
}
```

---

## 要件

### 要件1: counter 用 `lockedCard` の宣言と認識
**ユーザーストーリー：** ステージデザイナーとして、`stages.json` の任意スロット（ループ body 内含む）に `{ "lockedCard": { "id": "counter", "counterId": "<id>" } }` を書くことで、そのスロットをカウンタとして扱いたい。なぜなら、通常スロットと同じ記法でループ body 内に手動配置できれば、既存ローダーへの影響を最小化できるから。

#### 受け入れ基準
1. WHEN `stages.json` のスロット要素が `lockedCard.id === "counter"` を持つ THEN the system SHALL そのスロットを counter ノードとして扱い、`lockedCard` の `counterId` を `SlotNode` の `data` に伝播する
2. WHEN counter スロットが flow 配列の任意位置（ループ body 内・ループ外問わず）に書かれる THEN the system SHALL 通常スロットと同じく座標を割り当て、通常スロットと同じく前後のスロットへエッジで接続する
3. IF `counterId` が文字列でない、または空文字 WHEN counter スロットを展開する THEN the system SHALL `console.warn` で警告し、当該スロットを **通常の `lockedCard`（カウンタ機能なし）として展開**する
4. WHEN 同じ `counterId` を持つ counter スロットが **複数** 出現する THEN the system SHALL `console.warn` で警告し、**最初に出現したもののみを採用**して以降を通常 `lockedCard` として扱う

### 要件2: multiplier スロットのカウンタ参照記法
**ユーザーストーリー：** ステージデザイナーとして、`{ "multiplier": { "counterRef": "<id>" } }` の形でカウンタ参照を multiplier スロットに書きたい。なぜなら、既存の数値リテラル `{ "multiplier": 5 }` を一切壊さず、新記法を追加するだけで連動を表現できるから。

#### 受け入れ基準
1. WHEN スロット要素の `multiplier` が **数値**（既存記法） THEN the system SHALL 従来どおりその数値を倍率として扱い、カウンタ連動を一切行わない（**完全後方互換**）
2. WHEN スロット要素の `multiplier` が **オブジェクト**で `counterRef` を持つ THEN the system SHALL そのスロットを「カウンタ連動 multiplier スロット」として扱い、`counterRef` を `SlotNode` の `data` に伝播する
3. WHEN カウンタ連動 multiplier スロットを描画する THEN the system SHALL `MultiplierIndicator` をカウンタ値（実行前は 0）で表示する
4. IF `counterRef` が文字列でない、または空文字 THEN the system SHALL `console.warn` で警告し、**倍率 1 倍**（カードの power をそのまま使用）にフォールバックする
5. IF `counterRef` の値に対応する counter スロットが同じステージの flow に存在しない THEN the system SHALL `console.warn` で警告し、**倍率 1 倍**にフォールバックする

### 要件3: カウントのランタイム管理
**ユーザーストーリー：** プレイヤーとして、ループ body 内の counter ノードを実行が通過するたび、ペアの multiplier の数値が増えてほしい。なぜなら、「何周ぶんためたか」が画面で見えれば、ループの効果を実感できるから。

#### 受け入れ基準
1. WHEN プレイヤーが Play ボタンを押し実行が開始される THEN the system SHALL 全 counter のカウンタ値を **0** に初期化する
2. WHEN 実行シーケンスが counter ノードに到達する THEN the system SHALL 対応する `counterId` のカウンタ値を **+1** する
3. WHEN プレイヤーが Reset を押す、または Play を再度押して再実行する THEN the system SHALL 全カウンタ値を **0** にリセットする
4. WHILE 同一実行内で同じ counter ノードが複数周回通過される the system SHALL 周回ごとに +1 を累積する（周回ごとにリセットしない）

### 要件4: multiplier への倍率反映と効果適用
**ユーザーストーリー：** プレイヤーとして、ループで貯めた回数分の倍率で、最後のスロットに置いたカードの威力が増えてほしい。なぜなら、それがこのパズルの「貯めて叩き込む」核心だから。

#### 受け入れ基準
1. WHEN 実行シーケンスがカウンタ連動 multiplier スロットに到達する THEN the system SHALL そのスロットに置かれているカードの効果を、**カードの power × その時点の対応カウンタ値** で適用する（既存の数値倍率と同じ計算式）
2. WHEN 実行がカウンタ連動 multiplier スロットに到達した時点で **対応カウンタ値 = 0**（counter ノードを一度も通過していない） THEN the system SHALL 倍率 0 として効果を適用する（attack なら 0 ダメージ、heal なら 0 回復、guard なら 0 シールド）
3. WHEN カウンタ連動 multiplier スロットに **カードが置かれていない**（プレイヤーが空欄のまま実行） THEN the system SHALL 通常の空スロットと同じく効果なしで通過する

### 要件5: 視覚: 金枠表現
**ユーザーストーリー：** プレイヤーとして、counter とペアの multiplier が「セットである」ことを、見ただけで分かってほしい。なぜなら、ID の文字列はプレイヤーには見せないので、視覚的な紐付けが必要だから。

#### 受け入れ基準
1. WHEN counter ノードを描画する THEN the system SHALL `SlotNode` の枠線を **金色のスタイル**で表示する
2. WHEN カウンタ連動 multiplier スロットを描画する THEN the system SHALL `SlotNode` の枠線を **counter ノードと同じ金色のスタイル**で表示する
3. IF スロットが通常の `lockedCard`（counter 以外）または数値リテラルの multiplier の場合 THEN the system SHALL NOT 金枠を適用しない（既存スタイルを維持する）

### 要件6: 視覚: counter ノードの内部表現
**ユーザーストーリー：** プレイヤーとして、counter ノードが「パワーアップ装置」だと一目で分かるアイコンを見たい。なぜなら、ノード単体でも何の役割かが伝わってほしいから。

#### 受け入れ基準
1. WHEN counter ノードを描画する THEN the system SHALL `lockedCard` の表示に「**力こぶ／パワーアップ**」をイメージするカードイラスト（`public/cards/counter.png`）を使用する
2. WHEN counter カードを実装する THEN the system SHALL カード ID `"counter"` を `cards.json`（または相当データソース）に登録し、既存のカード解決機構で参照できるようにする

### 要件7: 演出: counter 通過時の光り（ペア同期）
**ユーザーストーリー：** プレイヤーとして、ループのどの瞬間でカウンタが増えたかを目で追いたい。さらに、counter が光るのと **同時に対応する multiplier スロットの枠も光ってほしい**。なぜなら、変化のタイミングが分かれば「ここで貯まった」という因果関係をつかめ、かつ光のシンクロで「この 2 つはペアだ」がより強く伝わるから。

#### 受け入れ基準
1. WHEN 実行シーケンスが counter ノードに到達する THEN the system SHALL counter カードに一時的な発光エフェクト（例：金色のフラッシュやハイライト）を表示する
2. WHEN counter ノードの発光エフェクトを開始する THEN the system SHALL **同じタイミングでペアの multiplier スロットの金枠にも対応する発光エフェクト** を表示する
3. WHEN 発光エフェクトの時間が経過する THEN the system SHALL counter カードと ペアの multiplier 枠の両方を通常表示へ戻す
4. WHILE 同一周回内に同じ counter ノードを 1 回通過する the system SHALL 発光エフェクトを（counter 側・multiplier 側ともに）1 回だけ再生する
5. IF カウンタ連動 multiplier スロットが flow に存在しない（要件11-3 のフォールバック中） WHEN counter ノードを通過する THEN the system SHALL counter 側の発光のみ行い、multiplier 側の発光は行わない（参照先が無いため）

### 要件8: 演出: multiplier 数字のリアルタイム更新
**ユーザーストーリー：** プレイヤーとして、counter が通るたびに、ペアの multiplier の数字がその場で増えていく様子を見たい。なぜなら、counter ↔ multiplier の連動がアニメーションで一気に伝わるから。

#### 受け入れ基準
1. WHEN counter ノードの通過によりカウンタ値が +1 される THEN the system SHALL 同じ瞬間にペアの multiplier スロットの `MultiplierIndicator` 表示を新しい値へ更新する
2. WHEN multiplier の数字が更新される THEN the system SHALL 軽い強調アニメーション（例：数字のスケール拡大→戻し、または金色のフラッシュ）で「いま増えた」ことを示す
3. WHILE ループ実行中 the system SHALL multiplier の表示と内部のカウンタ値を常に一致させる（表示遅延で計算値とずれない）

### 要件9: stage 4-3 の書き換え（具体的成果物）
**ユーザーストーリー：** プレイヤーとして、stage 4-3 でループカウンタのパズルを遊びたい。

#### 受け入れ基準
1. WHEN stage 4-3 の定義を更新する THEN the system SHALL `body` 配列の **6 番目**（末尾）に `{ "lockedCard": { "id": "counter", "counterId": "c1" } }` を追加する（既存の 5 スロット `[ {}, monster:60, {}, {}, {} ]` は維持する）
2. WHEN stage 4-3 の定義を更新する THEN the system SHALL ループ後の `{ "multiplier": 5 }` を `{ "multiplier": { "counterRef": "c1" } }` に置き換える
3. the system SHALL stage 4-3 の `enemyId` / `maxEnemyHp` / `cards` / `loop.mode` / `loop.condition` / `loop.label` / `loop.trueDir` / `loop.falseDir` を **一切変更しない**
4. WHEN プレイヤーが stage 4-3 を実行する THEN the system SHALL ループ body 末尾の counter を周回ごとに通過してカウントを積み上げ、ループ脱出後の multiplier スロットに置かれたカードを `power × カウント値` で適用する

### 要件10: 既存ステージへの非破壊性
**ユーザーストーリー：** 開発者として、既存ステージ（1-X / 2-X / 3-X / 4-1 / 4-2 / 5-X 等）の挙動を一切変えずに本機能を導入したい。なぜなら、デグレ検証コストが上がるから。

#### 受け入れ基準
1. WHEN 既存ステージで `multiplier` を **数値リテラル**として使っているスロット（例：従来の `{ "multiplier": 2 }` 等） THEN the system SHALL 倍率計算・描画・演出の全側面で **本機能導入前と完全に同一**に動作する
2. WHEN 既存ステージに counter スロットや `counterRef` を一切持たない THEN the system SHALL カウンタ管理機構を一切初期化・実行せず、既存の実行パスを完全に再現する
3. IF `lockedCard.id` が `"counter"` 以外（既存の `"monster"` 等） THEN the system SHALL NOT 金枠・カウント・発光等のカウンタ用の挙動を適用しない

### 要件11: 不正状態の防御
**ユーザーストーリー：** 開発者として、`counterRef` の typo や counter ノード忘れがあったときに、アプリがクラッシュせず警告で気づけるようにしたい。なぜなら、`stages.json` は手書きで、入力ミスが起こりやすいから。

#### 受け入れ基準
1. IF カウンタ連動 multiplier スロットが参照する `counterRef` の対象 counter が flow に存在しない THEN the system SHALL `console.warn` で警告し、倍率 1 倍として実行を継続する
2. IF 同じ `counterId` を持つ counter ノードが複数存在する THEN the system SHALL `console.warn` で警告し、**最初の 1 個のみ**をカウンタとして採用する（残りは通常 `lockedCard`）
3. IF counter ノードはあるが、それを参照する `counterRef` のスロットが flow に存在しない THEN the system SHALL `console.warn` で警告するが、counter 自体は通常のロックスロットとして展開し実行可能にする
4. WHEN 上記いずれの不正状態でも THEN the system SHALL NOT アプリのクラッシュ・実行停止・無限ループを引き起こさない

---

## 対象外（今回のスコープ外）

- **複数カウンタ**（シルバー枠などで識別する 2 つ目以降のカウンタ）。将来拡張。
- **同じ counterId に対する複数の multiplier 参照**（1 つの counter を複数 multiplier が共有）。将来拡張。
- **ループボディ内 multiplier**（counter と同じ周回内で multiplier が連動する配置）。今回は ループ後 multiplier のみ。
- **入れ子ループ内のカウンタ**。`flowchart-loop` 同様、単一 while / do-while のみ対応。
- **`evaluateCondition` からのカウンタ参照**（例：`loopCount >= 5` のような脱出条件）。条件式は既存変数のみ。
- **カウンタの減算・任意値セット**（`-1` ノードや `reset` ノード）。+1 のみ。
- **stage 4-3 のバランス調整**。本要件は構造の置き換えであり、敵 HP・手札・ループ条件はプレイテストで微調整しうる。

---

## 用語

| 用語 | 意味 |
|---|---|
| counter ノード | `lockedCard.id === "counter"` を持つスロット。実行で通過するたびに対応カウンタ値を +1 する。金枠・力こぶアイコン。 |
| counter カード | counter ノードに固定配置されるカード ID `"counter"`。`cards.json` に登録される。 |
| カウンタ連動 multiplier スロット | `multiplier` が `{ "counterRef": "<id>" }` 形式のスロット。倍率を対応カウンタ値で動的決定する。金枠。 |
| `counterId` | counter スロット側でカウンタを識別する文字列。 |
| `counterRef` | カウンタ連動 multiplier 側で counter を参照する文字列。`counterId` と一致する必要がある。 |
| カウンタ値 | `counterId` ごとに保持される整数。実行開始時 0、counter 通過ごとに +1。 |
| 金枠 | counter とペアの multiplier 双方に共通の視覚スタイル。「これらは連動している」をプレイヤーへ示すマーカー。 |
