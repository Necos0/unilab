# CLAUDE.md

このリポジトリでコードを書くときに従うルール。

## コーディング規約

- **1 ファイル 1 クラス**: 1 つのファイルには 1 つのクラスのみを定義する。
- **Docstring 必須**: すべてのクラス・関数に Google docstring 形式の説明文を付与する。

## ディレクトリ運用

- **必要になった時点で作る**: ディレクトリは将来の予定で先回りして空フォルダ・`.gitkeep` を切らず、実際にファイルを置く段階で作成する。
- **README.md と同期する**: ディレクトリを追加・削除・リネームしたときは、必ず `README.md` の「ディレクトリ構造」セクションを同じコミット内で更新する。実装と乖離した構造図は混乱の元になるため、構造変更とドキュメント更新はセットで行う。
- **未実装のディレクトリは「今後追加予定」表に記載**: README.md の構造図は実在するディレクトリのみを載せ、まだ存在しないものは「今後追加予定のディレクトリ」表に書く。

## 動作確認・テスト

- **ブラウザ動作確認は指示があるときだけ行う**: `npm run dev` の起動、ブラウザでの表示確認、Playwright MCP による自動操作・スクリーンショット取得などは、ユーザーから明示的な指示があった場合にのみ実施する。指示がない場合はコード変更と型・Lint チェックまでで止め、動作確認はユーザーに委ねる（不要な dev サーバー起動やスナップショット生成で環境やリポジトリを汚さないため）。
- **テスト生成物は残さない**: ブラウザ動作確認のスクリーンショット（例: `battle-*.png`）、Playwright MCP が出力する `.playwright-mcp/` 配下のログ・スナップショット、その他の一時ファイルは、確認を終えた時点で削除する。確認用に生成したものはコミットに含めない。
- **アセットとして残すファイルは `frontend/public/` か `frontend/src/` 配下に置く**: リポジトリ直下や任意の場所に画像・データを置かない。恒久的に必要なアセットは適切な配置先にコミットする。

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
