# 要件定義: 倍率スロット（multiplier-slot）

## はじめに

スロットの新しい種別として「倍率スロット」を導入する。`stages.json` のスロット定義に `multiplier: <整数>` を書くと、そのスロットを通過する `attack` / `guard` / `heal` カードの `power` が倍率分だけ増幅される。視覚的にはスロットの **右上に白色で「x2」** のようなテキストを表示する。これに伴い、既存の `acceptOnly` アイコン（現状は右上配置）を **左上に移動** し、倍率と acceptOnly が同時に存在しても衝突しないレイアウトに整理する。倍率スロットは `acceptOnly` や `lockedCard` と組み合わせ可能で、「attack カード専用 × 2 倍」「locked attack 20 ＝ 実質 40」のような複合的なステージデザインを表現できる。難易度バリエーションと表現力を高める目的で、ステージデザイナーが使う機能。

## 要件

### 要件 1: スロットの倍率指定（データモデル）

**ユーザーストーリー：** ステージデザイナーとして、`stages.json` のスロット定義に `multiplier: 2` のような短いフィールドを書くだけで「このスロットは効果 2 倍」を表現したい。なぜなら、難易度の段階や戦略的なヒントとして倍率を提示できると、ステージ設計の幅が広がるから。

#### 受け入れ基準

1. WHEN `stages.json` のスロット要素に `multiplier: 2` を書く THEN the system SHALL そのスロットの effect 倍率を 2 として扱う
2. WHEN `multiplier` フィールドが未指定 THEN the system SHALL 従来通り倍率 1（無効化、効果はそのまま）として扱う
3. IF `multiplier` の値が整数でない（小数、文字列、`null`、`true` 等） THEN the system SHALL `console.warn` で警告を残し、倍率なしとして扱う
4. IF `multiplier` の値が `0` 以下 THEN the system SHALL `console.warn` で警告を残し、倍率なしとして扱う
5. WHEN `multiplier: 1` を明示指定する THEN the system SHALL 倍率指定なしと同じ挙動を取る（明示指定は許容するが意味的に区別はしない）
6. WHEN 線形ステージ（`slots` キー）と flow ステージ（`flow` キー）の両形式で `multiplier` を使う THEN the system SHALL 同じ振る舞いで処理する（ローダー側で吸収）

### 要件 2: 倍率の効果適用

**ユーザーストーリー：** プレイヤーとして、倍率スロットを通過した攻撃・防御・回復カードが通常より強い効果を発揮する挙動を見たい。なぜなら、「x2」と表示されたスロットで実際に効果が増幅されることで、視覚と挙動が一致して気持ちよく遊べるから。

#### 受け入れ基準

1. WHEN attack カードが multiplier ≥ 2 のスロットを通過する THEN the system SHALL `card.power × multiplier` を敵 HP から減算する
2. WHEN heal カードが multiplier ≥ 2 のスロットを通過する THEN the system SHALL `card.power × multiplier` をプレイヤー HP に加算する（`maxPlayerHp` でクランプ、既存挙動）
3. WHEN guard カードが multiplier ≥ 2 のスロットを通過する THEN the system SHALL `card.power × multiplier` を `applyGuard` の引数として渡す（さらに `maxPlayerHp` でクランプは既存挙動）
4. IF カードが `lockedCard` で配置されている AND カード id が attack / guard / heal のいずれか WHEN そのスロットを通過する THEN the system SHALL 倍率を適用する（locked であってもカード種別が対象なら適用）
5. IF カードが `monster` 種別（locked モンスター攻撃） THEN the system SHALL multiplier の影響を受けず、`card.power` をそのまま `consumeShieldOnDamage` に渡す
6. IF カードが `reflect` 種別 THEN the system SHALL multiplier の影響を受けない（reflect は `power` を持たないので元々無関係）
7. WHEN multiplier 未指定スロットで attack / guard / heal が発火する THEN the system SHALL 従来通り `card.power × 1` の効果（= `card.power` そのまま）を発動する

### 要件 3: 倍率インジケータの視覚表示

**ユーザーストーリー：** プレイヤーとして、フローチャートを見ただけで「このスロットを通ると効果が 2 倍になる」が一目で分かりたい。なぜなら、戦略を立てる際に倍率スロットの存在を考慮する必要があり、ドラッグして試すまで気づけない UX は不便だから。

#### 受け入れ基準

1. WHEN スロットの `multiplier ≥ 2` が指定されている THEN the system SHALL スロットの **右上** に `x<n>`（例: `x2`、`x3`）形式の白色テキストインジケータを常時表示する
2. WHEN スロットが空のとき THEN the system SHALL 倍率インジケータを常時表示する（戦闘前から「ここは倍率」と認識可能）
3. WHEN カードが配置済みのとき THEN the system SHALL 倍率インジケータをカード上に重ねて引き続き表示する（`acceptOnly` アイコンと同様の常時表示方針）
4. WHEN 倍率インジケータが描画される THEN the system SHALL `acceptOnly` アイコン（左上に移設、要件 4-4 参照）と視覚的に衝突しない右上位置に配置する
5. IF `multiplier` が未指定 または 1 WHEN スロットを描画する THEN the system SHALL 倍率インジケータを表示しない
6. WHEN 倍率インジケータを描画する THEN the system SHALL `#f5f5f5`（白）の文字色で、既存のピクセルアート系 UI と整合するフォント・サイズで描画する（具体値は設計フェーズで決定）

### 要件 4: 既存スロット種別との共存

**ユーザーストーリー：** ステージデザイナーとして、`multiplier` を `acceptOnly` や `lockedCard` と組み合わせて、より複雑なギミックのスロットを作りたい。例えば「attack カード専用の 2 倍スロット」や「locked monster ＋ 2 倍」のような表現が欲しい。

#### 受け入れ基準

1. WHEN スロットに `multiplier: 2` と `acceptOnly: "attack"` の両方が指定されている THEN the system SHALL 両方の制限を同時に有効化する（attack カードしか置けない上に、置いたカードの power が 2 倍になる）
2. WHEN スロットに `multiplier: 2` と `lockedCard: { id: "attack", power: 20 }` の両方が指定されている THEN the system SHALL 配置済みの locked attack カードを 2 倍の power（= 40）で発動する
3. WHEN スロットに `multiplier: 2` と `lockedCard: { id: "monster", power: 30 }` の両方が指定されている THEN the system SHALL monster の power は倍率対象外として `card.power = 30` のままダメージ計算する（要件 2-5 に従う）
4. WHEN 倍率スロット表示と `acceptOnly` アイコン表示が同時に必要な場合 THEN the system SHALL **倍率を右上、`acceptOnly` を左上** に配置して干渉を避ける（既存 `acceptOnly` は右上配置だったが、本要件導入に伴い左上へ移設する）

### 要件 5: 既存挙動への影響範囲

**ユーザーストーリー：** 開発者として、倍率スロット機能が既存ステージ（1-1〜1-4, 2-1〜2-4, 3-1, 3-2, 4-1）の挙動に悪影響を与えないことを保証したい。

#### 受け入れ基準

1. WHEN `multiplier` が指定されていないスロット THEN the system SHALL 完全に従来挙動を維持する（インジケータなし、効果は `card.power` そのまま）
2. WHEN 既存ステージ（1-1〜4-1）を実行する THEN the system SHALL 戦闘進行が一切変わらない（描画・実行ロジックともに非破壊的）
3. WHEN ホバー・ドラッグ・ドロップの既存イベントハンドラ THEN the system SHALL 倍率スロットに対しても従来通り動作する（multiplier はドロップ判定に影響しない、効果計算時のみ働く）
4. WHEN `multiplier: 1` 明示指定スロット THEN the system SHALL 倍率なしスロットと完全に同じ挙動を取る（インジケータも表示しない）
