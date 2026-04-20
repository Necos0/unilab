# CLAUDE.md

このリポジトリでコードを書くときに従うルール。

## コーディング規約

- **1 ファイル 1 クラス**: 1 つのファイルには 1 つのクラスのみを定義する。
- **Docstring 必須**: すべてのクラス・関数に Google docstring 形式の説明文を付与する。

## ディレクトリ運用

- **必要になった時点で作る**: ディレクトリは将来の予定で先回りして空フォルダ・`.gitkeep` を切らず、実際にファイルを置く段階で作成する。
- **README.md と同期する**: ディレクトリを追加・削除・リネームしたときは、必ず `README.md` の「ディレクトリ構造」セクションを同じコミット内で更新する。実装と乖離した構造図は混乱の元になるため、構造変更とドキュメント更新はセットで行う。
- **未実装のディレクトリは「今後追加予定」表に記載**: README.md の構造図は実在するディレクトリのみを載せ、まだ存在しないものは「今後追加予定のディレクトリ」表に書く。

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
