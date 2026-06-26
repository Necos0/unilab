# CLAUDE.md

このリポジトリでコードを書くときに従うルール。

## コーディング規約

- **1 ファイル 1 クラス**: 1 つのファイルには 1 つのクラスのみを定義する。
- **Docstring 必須**: すべてのクラス・関数に Google docstring 形式の説明文を付与する。

## 文章・表現

このルールは **ゲーム内でプレイヤーに表示するテキスト**（UI 文言・セリフ・説明文・カード名など）にのみ適用する。開発セッション中の Claude の応答や、コード・コメント・ドキュメント（README.md など）には適用しない。

- **漢字にはふりがなを振る**: ゲーム内でプレイヤーに見せる文章で漢字を使うときは、必ずふりがな（ルビ）を振る。
- **なるべく簡単な単語を使う**: 難しい言い回しや専門用語を避け、できるだけやさしい単語で書く。

## ディレクトリ運用

- **必要になった時点で作る**: ディレクトリは将来の予定で先回りして空フォルダ・`.gitkeep` を切らず、実際にファイルを置く段階で作成する。
- **README.md と同期する**: ディレクトリを追加・削除・リネームしたときは、必ず `README.md` の「ディレクトリ構造」セクションを同じコミット内で更新する。実装と乖離した構造図は混乱の元になるため、構造変更とドキュメント更新はセットで行う。
- **未実装のディレクトリは「今後追加予定」表に記載**: README.md の構造図は実在するディレクトリのみを載せ、まだ存在しないものは「今後追加予定のディレクトリ」表に書く。

## 動作確認・テスト

- **ブラウザ動作確認は指示があるときだけ行う**: `npm run dev` の起動、ブラウザでの表示確認、Playwright MCP による自動操作・スクリーンショット取得などは、ユーザーから明示的な指示があった場合にのみ実施する。指示がない場合はコード変更と型・Lint チェックまでで止め、動作確認はユーザーに委ねる（不要な dev サーバー起動やスナップショット生成で環境やリポジトリを汚さないため）。
- **テスト生成物は残さない**: ブラウザ動作確認のスクリーンショット（例: `battle-*.png`）、Playwright MCP が出力する `.playwright-mcp/` 配下のログ・スナップショット、その他の一時ファイルは、確認を終えた時点で削除する。確認用に生成したものはコミットに含めない。
- **アセットとして残すファイルは `frontend/public/` か `frontend/src/` 配下に置く**: リポジトリ直下や任意の場所に画像・データを置かない。恒久的に必要なアセットは適切な配置先にコミットする。

## 画像アセットの最適化

`frontend/public/` に画像（PNG）を追加・差し替えするときは、**コミット前に必ず最適化する**。最適化前の生成画像はファイルサイズが過大で（マップやスプライトで 1 枚 3MB 級になることがある）、読み込みが目に見えて遅くなる。`.png` の拡張子・透過・ファイル名はそのまま維持するので、コード側の参照は変更不要。

ツールは `pngquant`（減色）と macOS 標準の `sips`（リサイズ）を使う。`pngquant` が無ければ `brew install pngquant`。

### 手順

1. **過剰解像度ならまずリサイズ**（アイコン・ボタンなど、実表示サイズより明らかに大きいもの）。表示寸法の 2 倍（Retina 相当）を上限の目安に、長辺をキャップする。マップ・タイトル・敵スプライトは表示解像度とほぼ同等なのでリサイズ不要。

   ```sh
   sips -Z <長辺px> path/to/icon.png      # アスペクト比を保って長辺を縮小
   ```

2. **pngquant で減色**（全 PNG 共通。これが削減の主役）。

   ```sh
   # ドット絵・アイコン・スプライト（色数が少なく、ほぼ無劣化）
   pngquant --quality=65-92 --skip-if-larger --strip --force --ext .png path/to/sprite.png

   # マップなどの詳細な背景画（色数が多く 65-92 ではスキップされやすい。
   # UI 背後の背景なので、やや強めの 55-85 まで落としてよい）
   pngquant --quality=55-85 --strip --force --ext .png path/to/maps/map_0.png
   ```

### 目安・注意

- **削減効果の目安**: 全体で 60〜75% 減（過去実績 60MB → 14MB）。
- **元画像の退避**: 上書きするので、不安なら作業前にコピーを取る（git 履歴にも残る）。品質が気に入らなければ元画像から品質パラメータを変えてやり直す。
- **未使用画像は置かない**: どこからも参照していない画像はコミットしない（過去に `icon_round.png` のような孤立ファイルがあった）。
- **WebP は使わない**: 削減率はさらに高いが、`.png` をハードコードで組み立てている参照（スプライトパス生成・エディタ・JSON 等）を全て書き換える必要があり、リスクに見合わない。PNG + pngquant で十分。

## 命名規則

プロジェクト全体で以下の命名規則を統一する。

### JavaScript / React (frontend)

| 対象 | 規則 | 例 |
|---|---|---|
| React コンポーネントファイル | PascalCase | `BattleScreen.jsx` |
| CSS Modules | コンポーネント名と一致 | `BattleScreen.module.css` |
| カスタムフックファイル | `use` プレフィックス + camelCase | `useGameState.js` |
| その他の JS ファイル | camelCase | `damageCalculator.js` |
| エントリポイント等の特殊ファイル | lowercase | `main.jsx`, `index.css` |
| クラス・React コンポーネント | PascalCase | `BattleScreen`, `CardDeck` |
| 変数・関数 | camelCase | `currentHp`, `calculateDamage` |
| 定数 | SCREAMING_SNAKE_CASE | `MAX_HP`, `DEFAULT_DECK_SIZE` |
| boolean 変数・関数 | `is` / `has` / `can` プレフィックス | `isAlive`, `hasCard`, `canPlay` |

### Python (将来の backend)

| 対象 | 規則 | 例 |
|---|---|---|
| ファイル・モジュール | snake_case | `damage_calculator.py` |
| クラス | PascalCase | `BattleEngine` |
| 関数・変数 | snake_case | `current_hp`, `calculate_damage` |
| 定数 | SCREAMING_SNAKE_CASE | `MAX_HP` |

### 共通

| 対象 | 規則 | 例 |
|---|---|---|
| ディレクトリ | lowercase（必要なら kebab-case） | `features/`, `battle/` |
| JSON データファイル | snake_case | `cards.json`, `stages.json` |
| 画像・アセット（単発） | snake_case | `boss_idle.png`, `card_frame.svg` |
| スプライト連番（アニメーション） | `<ID>_<状態>_<2桁ゼロ埋め連番>.png` | `slime_idle_00.png`, `slime_idle_05.png` |
| カード画像 | `<効果>.png`（効果は `cards.json` の `id`。数値はカード画像上に UI がテキスト合成するので、ファイル名には含めない） | `attack.png`, `guard.png`, `heal.png` |
