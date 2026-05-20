# 要件定義: カード種別制限スロット（restricted-slot）

## はじめに

`lockedCard`（事前配置された変更不可カード）とは別軸として、「特定の種別のカードしか受け入れないが、配置自体はプレイヤーが行うスロット」を導入する。3 種類の制限を用意する：`attack` 専用、`guard` 専用、`heal` 専用。ステージデザイナーは `stages.json` のスロット定義に `acceptOnly: "attack" | "guard" | "heal"` を書くだけで制限を設定できる。視覚的にはスロット右上に小さなアイコン（HP バーや Guard バーで使う SVG と統一感のある意匠）を表示し、プレイヤーがどの種別のカードを置くべきか一目で分かるようにする。不一致なカードをドラッグした場合は赤ハイライトで拒否を示し、ドロップ自体も成立させない。

## 要件

### 要件 1: スロットのカード受け入れ制限の指定（データモデル）

**ユーザーストーリー：** ステージデザイナーとして、`stages.json` のスロット定義に簡潔なフィールドを書くだけで「このスロットには attack カードしか置けない」を表現したい。なぜなら、戦略性のあるステージ設計（例: 序盤の防御ターン強制）を低コストで作れるようになるから。

#### 受け入れ基準

1. WHEN `stages.json` のスロット要素に `acceptOnly: "attack"` を書く THEN the system SHALL そのスロットを「attack カード専用スロット」として扱う
2. WHEN `stages.json` のスロット要素に `acceptOnly: "guard"` を書く THEN the system SHALL そのスロットを「guard カード専用スロット」として扱う
3. WHEN `stages.json` のスロット要素に `acceptOnly: "heal"` を書く THEN the system SHALL そのスロットを「heal カード専用スロット」として扱う
4. WHEN `acceptOnly` フィールドが未指定 THEN the system SHALL 従来通り全カード受け入れ可能なスロットとして扱う
5. IF `acceptOnly` の値が `"attack"` / `"guard"` / `"heal"` 以外（タイポ含む） THEN the system SHALL `console.warn` で警告を出し、制限なしとして扱う
6. WHEN 線形ステージ（`slots` キー）と flow ステージ（`flow` キー）の両形式で `acceptOnly` を使う THEN the system SHALL 同じ振る舞いで処理する（ローダー側で吸収）

### 要件 2: lockedCard との排他制御

**ユーザーストーリー：** ステージデザイナーとして、`lockedCard` と `acceptOnly` を 1 つのスロットに両方書いてしまった場合に、誤りに気づきたい。なぜなら、これら 2 つはスロット責務が異なる（lockedCard = 完全固定、acceptOnly = プレイヤー配置可能でタイプ制限のみ）ので、両方指定するのは設計意図が曖昧になるから。

#### 受け入れ基準

1. IF 同一スロットに `lockedCard` と `acceptOnly` の両方が指定されている THEN the system SHALL `stagesLoader` で `console.warn` を出し、`lockedCard` を優先して `acceptOnly` を無視する
2. WHEN 警告ログを出す THEN the system SHALL スロット ID と該当ステージ ID を含めて出力する（デバッグの手掛かりとして）
3. IF `lockedCard` のみ指定されている THEN the system SHALL 従来通り `lockedCard` の挙動で動作する（変更なし）
4. IF `acceptOnly` のみ指定されている THEN the system SHALL 要件 1 の通り種別制限スロットとして動作する

### 要件 3: 制限スロットの視覚アイコン表示

**ユーザーストーリー：** プレイヤーとして、フローチャートを見ただけで「このスロットには何のカードを置くべきか」が分かりたい。なぜなら、ドラッグして失敗するまで分からない UX は手数が増えて煩わしいから。

#### 受け入れ基準

1. WHEN スロットの `acceptOnly` が指定されている THEN the system SHALL スロットの右上に小さなアイコン（その種別を表すマーク）を表示する
2. WHEN attack 制限スロットを描画する THEN the system SHALL 剣マーク（赤系の SVG）を表示する
3. WHEN guard 制限スロットを描画する THEN the system SHALL 盾マーク（青系、GuardBar の盾アイコンと色を統一）を表示する
4. WHEN heal 制限スロットを描画する THEN the system SHALL 十字マーク（緑系、HpBar の CrossIcon と色を統一）を表示する
5. WHEN スロットが空のとき THEN the system SHALL アイコンを常時表示する（プレイヤーが「ここに何を置けるか」を予め確認できる）
6. WHEN 一致カードが配置済みのとき THEN the system SHALL アイコンを引き続き表示する（カード上に重なる位置でも視認可能とする）
7. WHEN アイコンが描画される THEN the system SHALL HpBar / GuardBar のアイコン（14×14px、ピクセル風）と意匠を揃える

### 要件 4: 制限スロットへのドロップ拒否

**ユーザーストーリー：** プレイヤーとして、不一致カードをスロットに重ねたとき「ここには置けない」が即座に分かり、誤って配置できないようにしたい。なぜなら、後から気づいて配置をやり直す手間を避けたいから。

#### 受け入れ基準

1. WHEN 不一致カードをドラッグ中で制限スロットにホバーしている THEN the system SHALL スロットを赤ハイライト（既存の `.isOver` の青系とは違う赤系の枠線または背景）で示す
2. IF 不一致カードを制限スロットにドロップしようとする THEN the system SHALL ドロップを成立させず、カードを元の位置（手札またはドラッグ元スロット）に戻す
3. WHEN 一致カードをドラッグ中で制限スロットにホバーしている THEN the system SHALL 既存の通常スロットと同じ青系ハイライト（`.isOver`）を表示する
4. WHEN 一致カードを制限スロットにドロップする THEN the system SHALL 通常通りスロットに配置する
5. WHEN ドラッグしていないとき THEN the system SHALL 制限スロットを赤ハイライトしない（待機時は通常の見た目）

### 要件 5: 制限スロットの実行時挙動

**ユーザーストーリー：** プレイヤーとして、一致カードを配置して実行ボタンを押すと、通常スロットと同じようにカードの効果が発動する挙動を期待したい。

#### 受け入れ基準

1. WHEN 制限スロットに一致カードが配置されている AND 実行が当該ノードを通過する THEN the system SHALL カードの効果を通常通り発動する（要件 1〜4 はドロップ時の制限のみ、実行時は通常通り）
2. WHEN 制限スロットが空のまま実行が当該ノードを通過する THEN the system SHALL 既存の空きスロットと同じ挙動を取る（特に効果なし、通過のみ）
3. WHEN 実行中の制限スロットの視覚演出（traversed ハイライト等）が発火する THEN the system SHALL 既存の演出を維持し、アイコンは引き続き右上に表示される

### 要件 6: 既存挙動への影響範囲

**ユーザーストーリー：** 開発者として、新しい制限スロット機能が既存ステージ（1-1〜1-4, 2-x, 3-1, 3-2）の挙動に悪影響を与えないことを保証したい。

#### 受け入れ基準

1. WHEN `acceptOnly` が指定されていないスロット THEN the system SHALL 完全に従来挙動を維持する（アイコンなし、全カード受け入れ、ハイライト挙動も既存通り）
2. WHEN 既存ステージ（1-1〜1-4, 2-1, 2-2, 2-3, 2-4, 3-1, 3-2）を実行する THEN the system SHALL 戦闘進行が一切変わらない（描画・実行ロジックともに非破壊的）
3. WHEN `lockedCard` 単独のスロット THEN the system SHALL 従来通り、locked カード表示・ドロップ拒否・実行時のカード効果発動が動作する
4. WHEN ホバー・ドラッグ・ドロップの既存イベントハンドラ THEN the system SHALL 制限スロット以外の挙動を一切変更しない
