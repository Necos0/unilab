# フローチャート型パズルRPG (アプリ名未定)

## 概要

フローチャート型パズルRPG。キャラクターを自由に移動しボスを倒すことを目指すRPGゲーム。

## 世界観

### ビジュアルスタイル

GBA 期の同人 RPG を思わせるハイディテールな 2D ピクセルアートを基調とする。『聖剣伝説3』や『聖剣伝説 Secret of Mana』のような、鮮やかで明るい色彩、陽光を感じる彩度の高い緑、澄んだ青空、繊細なディザリングによる陰影表現を特徴とする。視点はクォータービュー(真上から約 45 度見下ろす俯瞰)で、手作り感のあるタイル表現と、くっきりしたピクセル輪郭で統一する。マップは 16:9 のアスペクト比、スクロールを想定しない単一画面構成で描かれる。

### 舞台設定

プレイヤーが冒険するのは、なだらかな丘と野花に覆われた陽だまりの草原世界。地平線には遠い山並みと穏やかな雲が浮かぶ、穏やかながらどこか神秘的なファンタジー世界である。

各マップには **ステージへの入口となる複数のランドマーク** が配置され、それらは **分岐を含む土の道のネットワーク** によって互いに結ばれる。西端には冒険の出発点となるランドマーク、東端にはゴールとなるランドマークが置かれ、その間にいくつかのランドマークが点在する。道は単純な一本道ではなく、あるランドマークから複数方向へ枝分かれする支線を持ち、地形に沿って S 字にうねりながらマップを横断する。ランドマークは道の肩に直接寄り添い、道を歩けば逸れることなく入口の傍らを通り過ぎることができる(道がランドマーク内部を貫いたり重なったりはしない)。ランドマークの数や種類、道の材質(土・石畳・砂・雪上の足跡など)、分岐の形状はマップの舞台設定に合わせて変化する。

例として、最初のフィールドマップ(`public/maps/map_1.png`)には以下の 5 つのランドマークが配置され、4 本の道で結ばれている:

| 位置 | ランドマーク |
|---|---|
| 西端(出発点) | 木造のアーチ門を構えた小さな村の入口(二本の木柱と横木、古びた看板と吊り提灯) |
| 西寄り中央 | 苔むした古い石造りの井戸 |
| 北寄り中央 | 草むらと岩に囲まれた、朽ちて空洞になった巨大な倒木 |
| 中央 | 塔が半ば崩れた、廃墟化した石造りの砦 |
| 東端 | 背の高い立石が円環状に並ぶ古代のストーンサークル |

道は村の門のアーチから始まって井戸の縁を通り、井戸付近で南北に分岐する。北の支線は朽ちた倒木の開口部へ伸び、南の本道は砦の崩れた門の脇をかすめてさらに東へ進み、ストーンサークルの入口で終わる。プレイヤーはこのネットワーク上を、行き先のランドマークに応じて分岐を選びながら移動する。

### 雰囲気

マップの地表には生き物の姿は描かれない。しかし各ランドマークは内部が暗く沈み、うっすらと霧や影が漂っており、「中に何かが潜んでいる」ことを静かに示唆する。プレイヤーはこの入口を選択することでステージ(戦闘画面)へと進入する。

## 技術スタック

- **フロントエンド**: JavaScript / **React**
  - フローチャート描画: React Flow
  - ドラッグ&ドロップ: dnd-kit
- **サーバーサイド**: Python(将来導入予定)

> **開発方針**: 初期はフロントエンド完結型で開発する。サーバーサイドは当面使用せず、機能拡張の必要性が出てきた段階でPythonによるサーバーを導入する。

## 開発環境セットアップ

### 前提環境

| 項目 | 推奨バージョン | 備考 |
|---|---|---|
| Node.js | 20.x (LTS) 以上 | Vite 8 の要件 |
| npm | Node に同梱 | パッケージマネージャ |
| Git | 任意 | - |

推奨ツール(任意):
- **nvm** または **volta**: Node バージョン管理
- **VS Code**: エディタ(拡張: ESLint / Prettier / ES7+ React snippets)
- **React DevTools**: Chrome / Edge 拡張

### 初回セットアップ

```bash
# リポジトリ取得
git clone https://github.com/Necos0/unilab.git
cd unilab/frontend

# 依存関係のインストール
npm install
```

### 開発サーバー起動

```bash
cd frontend
npm run dev
```

ブラウザで `http://localhost:5173` を開くと、アプリが表示されます。ファイルを保存すると自動でリロードされます(HMR)。

### 本番ビルド

```bash
cd frontend
npm run build      # dist/ に成果物を出力
npm run preview    # ビルド結果をローカル確認
```

### 使用ライブラリ

| パッケージ | 用途 |
|---|---|
| `react` / `react-dom` | UIフレームワーク |
| `@xyflow/react` | フローチャート描画(旧 React Flow) |
| `@dnd-kit/core` | カードのドラッグ&ドロップ |
| `framer-motion` | アニメーション・演出 |
| `zustand` | グローバル状態管理 |
| `vite` | 開発サーバー・ビルドツール |

## ゲームシステム

### 戦闘画面

Undertale的なデザインを採用。

- **上部**: 敵
- **中部**: フローチャート
- **下部**: HP、フローチャートに入れるカード

### ゲームプレイ

1. ステージごとにフローチャートの形が決まっている
2. ユーザーは持っているカードをドラッグ&ドロップでフローチャートに当てはめる
3. 実行ボタンを押すとフローチャート通りに処理が進む

### 勝利条件

処理終了までに以下を満たすこと:

- ユーザーが死んでいないこと
- 相手が死んでいること

## ディレクトリ構造

> **更新ルール**: ディレクトリ構造に変更があった場合（追加・削除・リネーム）は、必ず本セクションを最新の状態に更新する。実装と乖離した構造図は新規参加者を混乱させるため、変更とドキュメント更新は同じコミットに含める。

```
unilab/
├── README.md
├── CLAUDE.md                     ← Claude Code 向けのコーディング規約
├── .claude/                      ← Claude Code 用スキル・コマンド
├── .specs/                       ← /spec コマンドの成果物(要件・設計・タスク)
├── docs/                         ← 開発者向けドキュメント(仕組みの解説等)
│   ├── flowchart-rendering.md
│   └── map-landmark-movement.md
└── frontend/                     ← React フロントエンド(将来 backend を横に追加)
    ├── public/                   ← 静的アセット(URL で参照)
    │   ├── favicon.svg
    │   ├── cards/                ← カード画像(<id>.png)
    │   ├── icons/                ← UI アイコン
    │   │   └── flowchart/        ← フローチャート関連アイコン(start.svg / goal.svg)
    │   ├── maps/                 ← マップ画像(map_<id>.png)
    │   └── sprites/              ← キャラ・敵・エフェクトのスプライト画像
    │       └── enemies/
    │           └── slime/
    │               └── idle/     ← スライム idle アニメーション(6 フレーム)
    └── src/
        ├── main.jsx              ← エントリポイント
        ├── App.jsx
        ├── index.css             ← グローバル CSS
        ├── components/           ← 汎用 UI パーツ
        │   ├── HpBar.jsx
        │   └── HpBar.module.css
        ├── data/                 ← 静的データ(stages.json 等、JS から import)
        │   ├── enemies.json
        │   ├── maps.json         ← マップ定義(背景画像・ランドマーク座標・道のエッジ)
        │   ├── player.json       ← プレイヤーのステータス(maxHp 等、将来 attack/defense を追加)
        │   └── stages.json       ← ステージ定義(敵・使用可能カード・フローチャート形状)
        ├── stores/               ← グローバル状態管理(zustand)
        │   ├── battleStore.js    ← 手札・スロット割当・ドラッグ状態
        │   └── mapStore.js       ← マップ画面の現在位置・移動状態
        └── features/             ← 機能単位で分割
            ├── battle/           ← 戦闘画面
            │   ├── BattleScreen.jsx
            │   ├── BattleScreen.module.css
            │   ├── BackToMapButton.jsx        ← 右上のテスト用「マップへ戻る」ボタン
            │   ├── BackToMapButton.module.css
            │   ├── enemy/        ← 敵スプライトのアニメーション描画
            │   │   ├── EnemySprite.jsx
            │   │   ├── EnemySprite.module.css
            │   │   ├── enemySpritePath.js
            │   │   └── useSpriteAnimation.js
            │   └── flowchart/    ← フローチャート描画(React Flow、戦闘画面内で使用)
            │       ├── FlowchartArea.jsx
            │       ├── FlowchartArea.module.css
            │       ├── SlotNode.jsx
            │       └── SlotNode.module.css
            ├── cards/            ← カード UI(個別カード・手札レイアウト)
            │   ├── Card.jsx
            │   ├── Card.module.css
            │   ├── Hand.jsx
            │   └── Hand.module.css
            └── map/              ← フィールドマップ画面
                ├── MapScreen.jsx          ← マップ画面ルート(SVG 全体を組み立てる)
                ├── MapScreen.module.css
                ├── MapBackground.jsx      ← 背景画像レイヤ
                ├── MapPaths.jsx           ← 道(SVG path)レイヤ
                ├── MapPaths.module.css
                ├── Landmark.jsx           ← ランドマーク 1 個分(クリック・ホバー)
                ├── Landmark.module.css
                ├── LandmarkScroll.jsx     ← 巻物形のステージ名バナー
                ├── LandmarkScroll.module.css
                ├── LandmarkDetail.jsx     ← ホバー時の詳細パネル(難易度・たたかう)
                ├── LandmarkDetail.module.css
                ├── PlayerSprite.jsx       ← プレイヤースプライト＋移動アニメーション
                ├── findNodeById.js        ← ランドマーク/分岐点を ID 横断で引く(純関数)
                └── findShortestPath.js    ← BFS による最短経路探索(純関数)
```

### 今後追加予定のディレクトリ

実装が必要になったタイミングで作成する（先回りした空フォルダは置かない）。

| 想定パス | 用途 |
|---|---|
| `frontend/src/features/battle/effects/` | フラッシュ・シェイク等の演出 |
| `frontend/src/features/stage/` | ステージ選択・進行管理 |
| `frontend/src/engine/` | UI 非依存のゲームロジック(純粋 JS、将来 Python 移植時の仕様書代わり) |
| `frontend/src/hooks/` | カスタムフック |
| `backend/` | Python サーバー(将来導入) |

### 設計の意図

| ディレクトリ | 狙い |
|---|---|
| `frontend/` をトップに分離 | 後から `backend/` を横に足すだけで済む構成 |
| `features/` で機能単位 | ファイル種別ではなく機能でまとめ見通しを良くする |
| `engine/` を UI から分離 | 純粋関数でテスト容易、将来 Python へ移植しやすい |
| `data/` を JSON で分離し `src/` に配置 | JS から `import` して同期アクセスでき、ビルド時に JSON の破損を検知できる。ステージ・カード追加はコード変更なしで行える |
| 画像・フォントを `public/` に集約 | URL で参照する資産（`<img src>` 等）の置き場。JSON からファイル名で参照でき、将来バックエンド配信に切り替えても参照形式が同じ |
