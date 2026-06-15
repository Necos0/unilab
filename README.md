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
    │   │   ├── icon_round.png        ← アプリのファビコン(index.html が参照)
    │   │   ├── landmark_padlock.png  ← 未解放ランドマークに重ねる南京錠
    │   │   ├── landmark_scroll.png   ← マップ上のステージ名バナー(巻物背景)
    │   │   ├── map_travel.png        ← マップ移動ボタンのアイコン
    │   │   └── flowchart/        ← フローチャート関連アイコン(goal/play/reset/start.svg)
    │   ├── maps/                 ← マップ画像(map_<id>.png、現在 map_1 / map_2)
    │   └── sprites/              ← キャラ・敵・エフェクトのスプライト画像
    │       ├── hero/             ← プレイヤースプライト(<state>/hero_<state>_NN.png)
    │       │   ├── idle/         ← 静止(現在はテスト用に 1 枚)
    │       │   ├── up/           ← 上方向への歩行
    │       │   ├── down/         ← 下方向への歩行
    │       │   ├── left/         ← 左方向への歩行
    │       │   └── right/        ← 右方向への歩行
    │       └── enemies/          ← 敵スプライト(<id>/<state>/<id>_<state>_NN.png)
    │           ├── slime/        ← idle / dead
    │           ├── wolf/         ← idle / dead
    │           ├── knight/       ← idle / dead
    │           ├── golem/        ← idle / dead
    │           ├── cactus/       ← idle / dead
    │           ├── cobra/        ← idle / dead
    │           ├── crab/         ← idle / dead
    │           ├── dragon/       ← idle / dead
    │           ├── lizard/       ← idle / dead
    │           ├── phoenix/      ← idle / dead
    │           └── starfish/     ← idle / dead
    └── src/
        ├── main.jsx              ← エントリポイント
        ├── App.jsx
        ├── index.css             ← グローバル CSS
        ├── disableBrowserZoom.js ← ブラウザの拡大縮小を抑制するグローバルリスナー
        ├── components/           ← 汎用 UI パーツ
        │   ├── HpBar.jsx
        │   ├── HpBar.module.css
        │   ├── GuardBar.jsx           ← ガード残量バー(HpBar の下に縦並び、盾アイコン付き)
        │   └── GuardBar.module.css
        ├── data/                 ← 静的データ(stages.json 等、JS から import)
        │   ├── enemies.json
        │   ├── maps.json         ← マップ定義(背景画像・ランドマーク座標・道のエッジ)
        │   ├── player.json       ← プレイヤーのステータス(maxHp 等、将来 attack/defense を追加)
        │   ├── stages.json       ← ステージ定義(敵・使用可能カード・フローチャート形状)
        │   └── stagesLoader.js   ← stages.json の短縮形式を完全形式に展開するローダー
        ├── stores/               ← グローバル状態管理(zustand)
        │   ├── battleStore.js    ← 手札・スロット割当・ドラッグ状態
        │   ├── mapStore.js       ← マップ画面の現在位置・移動状態
        │   └── progressStore.js  ← ステージのクリア記録・解放アニメ状態
        ├── hooks/                ← 機能横断のカスタムフック
        │   └── useSpriteAnimation.js  ← スプライト連番のフレーム送り(敵・主人公共用)
        ├── engine/               ← UI 非依存のゲームロジック(純関数、将来 Python 移植の仕様書代わり)
        │   ├── evaluateCondition.js   ← 条件式(文字列)を実行時状態で評価する純関数
        │   └── simulateBattle.js      ← 実行前に勝敗/無限ループ(runaway)を数値だけで判定する純関数
        ├── editer/               ← スプライトシート分割エディタ(開発用ツール、他コードから独立)
        │   ├── SpriteSheetEditor.jsx       ← エディタ画面ルート(状態集約・レイアウト)
        │   ├── SpriteSheetEditor.module.css
        │   ├── EditorEntryButton.jsx       ← マップ右下のエディタ起動ボタン
        │   ├── EditorEntryButton.module.css
        │   ├── ImageStage.jsx              ← 画像の拡大縮小・移動表示＋切り取り枠＋切り取り実行
        │   ├── ImageStage.module.css
        │   ├── FrameList.jsx               ← 切り取ったコマ一覧(ドラッグ並べ替え・削除)
        │   ├── FrameList.module.css
        │   ├── PreviewPlayer.jsx           ← コマ列の FPS 指定アニメ再生プレビュー
        │   ├── PreviewPlayer.module.css
        │   ├── SavePanel.jsx               ← キャラ名・状態指定→命名規則どおり ZIP 保存
        │   ├── SavePanel.module.css
        │   ├── cropRegion.js               ← 枠内を元画像の原寸ピクセルで切り出す(純関数)
        │   ├── createZip.js                ← 外部ライブラリ無しの ZIP(store 方式)生成(純関数)
        │   ├── dataUrlToBytes.js           ← dataURL をバイト列へ変換(純関数)
        │   ├── downloadBlob.js             ← Blob をファイルとしてダウンロード
        │   ├── buildSpriteFileName.js      ← 命名規則のファイル名を組み立てる(純関数)
        │   └── sanitizeId.js               ← 入力名を snake_case の ID へ正規化(純関数)
        └── features/             ← 機能単位で分割
            ├── battle/           ← 戦闘画面
            │   ├── BattleScreen.jsx
            │   ├── BattleScreen.module.css
            │   ├── BackToMapButton.jsx        ← 右上のテスト用「マップへ戻る」ボタン
            │   ├── BackToMapButton.module.css
            │   ├── BattleTransition.jsx       ← マップ→バトルの黒フェード演出＋画像プリロード
            │   ├── BattleTransition.module.css
            │   ├── VictoryClearOverlay.jsx    ← 勝利時の CLEAR! テキスト＋マップへ戻るボタン
            │   ├── VictoryClearOverlay.module.css
            │   ├── BattleFailOverlay.jsx      ← 失敗時の Fail テキスト＋やり直す／マップへ戻るボタン
            │   ├── BattleFailOverlay.module.css
            │   ├── preloadBattleAssets.js     ← ステージから敵スプライト・カード・アイコンを事前読み込み
            │   ├── enemy/        ← 敵側の演出(スプライト・被弾ダメージ表示・反射ダメージ表示)
            │   │   ├── DamageFloater.jsx
            │   │   ├── DamageFloater.module.css
            │   │   ├── ReflectDamageFloater.jsx       ← reflect カードによる反射ダメージ(オレンジ系)
            │   │   ├── ReflectDamageFloater.module.css
            │   │   ├── EnemySprite.jsx
            │   │   ├── EnemySprite.module.css
            │   │   └── enemySpritePath.js
            │   ├── player/       ← プレイヤー側の演出(被弾ダメージ・回復数字表示)
            │   │   ├── PlayerDamageFloater.jsx
            │   │   ├── PlayerDamageFloater.module.css
            │   │   ├── PlayerHealFloater.jsx
            │   │   └── PlayerHealFloater.module.css
            │   └── flowchart/    ← フローチャート描画(React Flow、戦闘画面内で使用)
            │       ├── AnimatedProgressEdge.jsx
            │       ├── AnimatedProgressEdge.module.css
            │       ├── ConditionNode.jsx          ← 条件分岐ノード(菱形、true/false で経路を分岐)
            │       ├── ConditionNode.module.css
            │       ├── FlowchartArea.jsx
            │       ├── FlowchartArea.module.css
            │       ├── GoalNode.jsx
            │       ├── GoalNode.module.css
            │       ├── MergeNode.jsx              ← 条件分岐の合流点(円形、loader が自動挿入)
            │       ├── MergeNode.module.css
            │       ├── MultiplierIndicator.jsx    ← 倍率スロットの「x2」表示(スロット右上)
            │       ├── MultiplierIndicator.module.css
            │       ├── PlayButton.jsx
            │       ├── PlayButton.module.css
            │       ├── ResetButton.jsx
            │       ├── ResetButton.module.css
            │       ├── RestrictedSlotIcon.jsx     ← カード種別制限スロットのアイコン(スロット右上)
            │       ├── RestrictedSlotIcon.module.css
            │       ├── SlotNode.jsx
            │       ├── SlotNode.module.css
            │       ├── StartNode.jsx
            │       ├── StartNode.module.css
            │       ├── ZoomButton.jsx          ← 拡大／縮小トグル(isExpanded 切替)
            │       ├── ZoomButton.module.css
            │       ├── ZoomControls.jsx        ← 拡大状態のビューズーム +/− ボタン
            │       └── ZoomControls.module.css
            ├── cards/            ← カード UI(個別カード・手札レイアウト)
            │   ├── Card.jsx
            │   ├── Card.module.css
            │   ├── DraggableCard.jsx      ← Card を dnd-kit でラップしドラッグ可能にする
            │   ├── DraggableCard.module.css
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
                ├── LandmarkDetail.jsx     ← 到着時の詳細パネル(難易度・たたかう・クリア済み)
                ├── LandmarkDetail.module.css
                ├── LandmarkLockOverlay.jsx        ← 未解放ステージに重ねる鎖＋南京錠の SVG
                ├── LandmarkLockOverlay.module.css
                ├── FullscreenToggleButton.jsx     ← 左上の大画面表示トグル
                ├── FullscreenToggleButton.module.css
                ├── MapTravelButton.jsx            ← 右上のマップ移動ボタン(MapSelectOverlay を開く)
                ├── MapTravelButton.module.css
                ├── MapSelectOverlay.jsx           ← マップ移動先を選ぶモーダル風オーバーレイ
                ├── MapSelectOverlay.module.css
                ├── MapSwitchTransition.jsx        ← マップ切替時の黒フェード演出
                ├── MapSwitchTransition.module.css
                ├── BattleDemoButton.jsx           ← デバッグ用:戦闘デモへ飛ぶドロップダウン
                ├── BattleDemoButton.module.css
                ├── CoordinateGrid.jsx             ← デバッグ用:座標調整の格子オーバーレイ
                ├── CoordinateGrid.module.css
                ├── PlayerSprite.jsx       ← プレイヤースプライト＋移動アニメーション
                ├── heroSpritePath.js      ← /sprites/hero 配下のスプライト URL を組み立てる(純関数)
                ├── reverseDirection.js    ← エッジ方向を逆走時に反転する(純関数)
                ├── findNodeById.js        ← ランドマーク/分岐点を ID 横断で引く(純関数)
                ├── findShortestPath.js    ← BFS による最短経路探索(純関数)
                ├── parseStageId.js        ← ステージ ID を world/number に分解(純関数)
                └── getNextStageId.js      ← 次ステージ ID を算出(純関数)
```

### 今後追加予定のディレクトリ

実装が必要になったタイミングで作成する（先回りした空フォルダは置かない）。

| 想定パス | 用途 |
|---|---|
| `frontend/src/features/battle/effects/` | フラッシュ・シェイク等の演出 |
| `frontend/src/features/stage/` | ステージ選択・進行管理 |
| `backend/` | Python サーバー(将来導入) |

### 設計の意図

| ディレクトリ | 狙い |
|---|---|
| `frontend/` をトップに分離 | 後から `backend/` を横に足すだけで済む構成 |
| `features/` で機能単位 | ファイル種別ではなく機能でまとめ見通しを良くする |
| `engine/` を UI から分離 | 純粋関数でテスト容易、将来 Python へ移植しやすい |
| `data/` を JSON で分離し `src/` に配置 | JS から `import` して同期アクセスでき、ビルド時に JSON の破損を検知できる。ステージ・カード追加はコード変更なしで行える |
| 画像・フォントを `public/` に集約 | URL で参照する資産（`<img src>` 等）の置き場。JSON からファイル名で参照でき、将来バックエンド配信に切り替えても参照形式が同じ |

## 開発者向けノート（ハマりやすいポイント）

### ピクセル風フォント（`Press Start 2P`）の視覚中央配置

このプロジェクトでは HP バー数値・カード power・CLEAR! テキスト等で `Press Start 2P` のドット絵風等幅フォントを使う。**「box は CSS 的に中央配置なのに、見た目はなぜか左寄り（または右寄り）」** という症状が出ることがあり、以下の点に注意。

#### 症状

- `getBoundingClientRect()` で要素の box 中心を測ると、親要素の中心と完全一致している
- `Range.getBoundingClientRect()` でテキスト範囲を測っても、中心は box 中心とほぼ同じ
- それでも定規でディスプレイを測ると、視覚的に明らかにずれている（数 mm〜十数 mm）

#### 原因

`Press Start 2P` は等幅フォントだが、**`!` `i` `l` `.` などのグリフは文字 advance box 内で左寄りに描画される**（縦棒やドットが左半分に集中し、右半分は空白）。CSS のレイアウト計算は **advance box ベース** なので、glyph の実際のインク位置（visual ink box）がどこにあるかは関知しない。`Range.getBoundingClientRect()` も advance box を返すため、CSS では検出できない。結果として「CLEAR!」のような末尾に `!` が来る文字列は、box 中央なのに視覚重心が左に寄って見える。

#### 対処

テキストを `<span>` でラップし、wrapper を flex で中央配置レーンにし、span 側に `padding-left` で glyph 位置を補正する。**`px` の magic number ではなく `em` 単位（フォントサイズ相対）で書く**ことで、`clamp(2rem, 6vw, 3rem)` のようなレスポンシブな font-size 変動にも自動追従する。

```jsx
<div className={styles.clearText}>
  <span className={styles.clearTextInner}>CLEAR!</span>
</div>
```

```css
.clearText {
  width: 100%;
  display: flex;
  justify-content: center;
}

.clearTextInner {
  padding-left: 0.5em;  /* glyph 位置補正（フォントサイズ相対） */
}
```

#### 実例

- `frontend/src/features/battle/VictoryClearOverlay.jsx` / `.module.css`：CLEAR! テキストの中央配置補正

#### デバッグ手順（「視覚的に左寄り」と感じたら）

1. DevTools コンソールで対象要素の `getBoundingClientRect()` を測り、親 box との中心 X が一致しているか確認
2. 一致していれば `Range.getBoundingClientRect()` でテキスト範囲も中心一致を確認
3. 両方一致しているのに視覚ズレが残るなら **glyph 位置由来**。`em` 単位の `padding-left` で補正
4. 一致していないなら CSS の中央配置設定（`justify-content` / `align-items` / `width: 100%`）を見直す
