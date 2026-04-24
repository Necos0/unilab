# 要件定義: カード UI 画像化と Hand / Card 分離

## はじめに

戦闘画面下段の手札領域では現在「カードA / カードB / カードC」というテキストのプレースホルダが表示されている。これを `frontend/public/cards/` 配下のカード画像（`attack.png` / `guard.png` / `heal.png`）に差し替え、同時に「手札全体のレイアウト」と「個別カードの見た目」を別コンポーネントに分離する。合わせて、カードの `power` はステージ依存パラメータとして `stages.json` 側で定義する構造に変更する。現行の `cards.json` は廃止し、必要なメタデータはステージ定義に集約する。

本スペックは UI 差し替え・コンポーネント分離・データ構造変更までをスコープとし、ドラッグ&ドロップや対話ロジックは扱わない。

## 要件

### 要件1: カード画像の表示
**ユーザーストーリー：** プレイヤーとして、手札に表示されるカードを視覚的に識別したい。なぜならテキストだけではカードの効果や種類が直感的にわからず、ゲーム体験として没入感が損なわれるから。

#### 受け入れ基準
1. WHEN 戦闘画面が手札を描画する THEN the system SHALL `/cards/<id>.png` を `<img>` で表示する
2. WHEN カード画像が描画される THEN the system SHALL カード画像の下段パネル領域に当該ステージの `power` 値を数値としてオーバーレイ合成する
3. WHEN カード画像が描画される THEN the system SHALL ピクセルアート調の見た目を維持する（`image-rendering: pixelated`）
4. WHEN カード画像が描画される THEN the system SHALL ユーザーによるドラッグ開始やテキスト選択を抑止する（`draggable={false}`, `user-select: none`）
5. WHEN 画像の `alt` 属性を設定する THEN the system SHALL カードの `id` を alt テキストとして使用する（`displayName` は本スペックでは保持しない）

### 要件2: Hand / Card の責務分離
**ユーザーストーリー：** 開発者として、手札のレイアウトロジックと個別カードの見た目を別コンポーネントに分けたい。なぜなら将来のドラッグ&ドロップ導入・枚数変化のアニメーション追加・カードデザイン変更時に影響範囲を限定し、変更を小さく保ちたいから。

#### 受け入れ基準
1. WHEN 実装を配置する THEN the system SHALL `frontend/src/features/cards/` 配下に `Card.jsx` と `Hand.jsx` を別ファイルとして定義する
2. WHEN `Hand` がレンダリングされる THEN the system SHALL `cards` プロパティで受け取った配列を左から順に `Card` で描画する
3. WHEN `Card` がレンダリングされる THEN the system SHALL `card` プロパティ（`id`, `power`）のみを参照し、JSON 等のデータ import を内部で行わない
4. WHEN `BattleScreen` が手札を描画する THEN the system SHALL `<Hand cards={...} />` を通じてカード配列を渡し、`BattleScreen` 内にカード関連の DOM 構造（`.card` div 等）を持たない

### 要件3: データ構造の変更（`cards.json` 廃止・`stages.json` 拡張）
**ユーザーストーリー：** ゲーム設計者として、カードの `power` をステージごとに設定したい。なぜなら同じカード（例：こうげき）でも序盤と終盤で威力を変えるといった難易度調整が必要になるから。

#### 受け入れ基準
1. WHEN データ構造を再編する THEN the system SHALL `frontend/src/data/cards.json` を削除する
2. WHEN `stages.json` のステージ定義を拡張する THEN the system SHALL 各ステージに `cards` フィールド（`{ id: string, power: number }` の配列）を追加する
3. WHEN 同じカードを 2 枚以上持たせる THEN the system SHALL `cards` 配列に同一 `id` を複数回含めることで表現する
4. WHEN 戦闘画面が現在ステージを解決する THEN the system SHALL そのステージの `cards` 配列をそのまま `Hand` の `cards` プロパティに渡す
5. WHEN 既存の `stage-00` を移行する THEN the system SHALL `cards` として `[{ id: "attack", power: 12 }, { id: "guard", power: 12 }, { id: "heal", power: 12 }]` を設定し、現行の 3 枚表示と同等の見た目を保つ
6. WHEN `cards.json` への import が残存している箇所を調査する THEN the system SHALL 全 import を削除し、未参照のデータファイルを残さない

### 要件4: 可変サイズのレイアウト
**ユーザーストーリー：** プレイヤーとして、画面サイズに応じて手札が自然にフィットしてほしい。なぜなら固定サイズだと小さな画面では見切れ、大きな画面では小さすぎて視認性が落ちるから。

#### 受け入れ基準
1. WHEN カードがレンダリングされる THEN the system SHALL `height: 100%` と `aspect-ratio: 2 / 3` に基づきサイズを決定する
2. WHEN `playerArea` の高さが変化する THEN the system SHALL カードの高さがそれに追従し、幅は縦横比から算出される
3. WHEN 手札が複数枚描画される THEN the system SHALL `Hand` 内で横並びに一定の `gap` を空けて配置する
4. WHILE 画像読み込み中・読み込み後 the system SHALL カード領域のレイアウトが変動しないよう `aspect-ratio` でサイズを先に確保する

### 要件5: スコープ外の確認
**ユーザーストーリー：** 開発者として、本スペックのスコープ境界を明示したい。なぜなら後続スペックで扱う機能領域を区別し、スコープクリープを防ぎたいから。

#### 受け入れ基準
1. WHILE 本スペックの作業中 the system SHALL ドラッグ&ドロップ処理を実装しない
2. WHILE 本スペックの作業中 the system SHALL カードの選択状態・使用済み状態などの対話ロジックを実装しない
3. WHILE 本スペックの作業中 the system SHALL プレイヤー個別のデッキ構成や所持カード管理を実装しない（参照するのは `stages.json` の `cards` のみ）
4. WHILE 本スペックの作業中 the system SHALL カード画像の新規作成・差し替えを行わない（既存 3 枚のみを対象とする）
5. WHILE 本スペックの作業中 the system SHALL カードの `displayName` を再導入しない（alt 属性は `id` で代替）

## プロジェクトルール適合

- **1 ファイル 1 クラス**: `Card.jsx` / `Hand.jsx` にそれぞれ単一のコンポーネントを定義する。
- **Docstring 必須**: 各コンポーネントに Google docstring 形式の説明を付与する。
- **命名規則**: コンポーネントファイルは PascalCase（`Card.jsx`, `Hand.jsx`）、CSS Modules は同名（`Card.module.css`, `Hand.module.css`）、JSON のキーは camelCase（`cards`, `id`, `power`）。
- **ディレクトリ運用**: `features/cards/` は本スペック実装時に作成し、同コミットで `README.md` の構造図を更新（`cards.json` 削除も反映）する。
