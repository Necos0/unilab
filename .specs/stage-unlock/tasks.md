# タスク一覧: ステージ解放機能

## 概要

純関数 → ストア → 表示コンポーネント → 既存コンポーネント修正 → 画面オーケストレーション の順で実装する。前半は依存関係が少なく単体で完結するため並列化も可能だが、原則として下から積む。クリティカルパスは「`progressStore` → `Landmark` の購読修正 → `MapScreen` のアニメ起動」で、ここが通ればロック表示・クリック抑止・解放アニメの主動線が成立する。クリア記録の `App.jsx` 結線は最後にまとめて行い、それまでは戦闘画面右上のテストボタンで手動確認できる。

合計タスク数：11件 ｜ 想定工数：8時間

## タスク

- [x] **1. ステージ ID パース純関数の追加**
  - 内容：`"1-2"` を `{world: "1", number: 2}` に分解する `parseStageId(stageId)` を作成する。フォーマット不一致は `null` を返す。Google docstring を付ける。
  - ファイル：`frontend/src/features/map/parseStageId.js`
  - 依存：なし
  - 完了条件：`parseStageId("1-2")` が `{world: "1", number: 2}`、`parseStageId("invalid")` が `null` を返す。

- [x] **2. 次ステージ ID 算出純関数の追加**
  - 内容：`stagesData` と現 `stageId` から `{world}-{number+1}` を計算し、`stagesData.stages` に存在すれば返す、無ければ `null` を返す `getNextStageId(stagesData, stageId)` を作成する。`parseStageId` を内部で使用する。
  - ファイル：`frontend/src/features/map/getNextStageId.js`
  - 依存：タスク1
  - 完了条件：`getNextStageId(stagesData, "1-1")` が `"1-2"`、`getNextStageId(stagesData, "1-4")` が `null` を返す。

- [x] **3. progressStore の作成（クリア記録・解放アニメ状態）**
  - 内容：`clearedStageIds: []` / `pendingUnlockStageId: null` / `isUnlockAnimating: false` を持つ zustand ストアを新設。`markStageCleared(stageId)`（重複は no-op、追加と次ステージ判定）、`startUnlockAnimation()`（`isUnlockAnimating=true` ＋ `setTimeout(UNLOCK_FADE_DURATION_MS=600)` で `finishUnlockAnimation` を予約）、`finishUnlockAnimation()`（両フラグをリセット）を実装。セレクタ `isStageClearedSelector` / `isStageUnlockedSelector` / `shouldShowLockSelector` も同ファイルから export する。Google docstring を付ける。
  - ファイル：`frontend/src/stores/progressStore.js`
  - 依存：タスク2
  - 完了条件：`markStageCleared("1-1")` 後に `pendingUnlockStageId === "1-2"` になり、`startUnlockAnimation()` 600ms 後に両フラグが初期値に戻る。`markStageCleared("1-4")` で `pendingUnlockStageId` が変化しない。同じ stageId を 2 回 `markStageCleared` しても `clearedStageIds` の長さは増えない。

- [x] **4. LandmarkLockOverlay コンポーネントの作成（インライン SVG）**
  - 内容：`<g>` ルートで、半透明黒の背景矩形（`rect x=-80 y=-16 width=160 height=32 rx=4 fill="rgba(0,0,0,0.45)"`）、対角の鎖 2 本（リング `<ellipse rx=4 ry=2.5>` を 5〜6 個ずつ等間隔配置、`(-80,-16)→(80,16)` と `(-80,16)→(80,-16)`）、中央の南京錠（本体 `rect`、シャックル `path A`、鍵穴 `circle` + `rect`）を描画。Props は `isFading: boolean` のみ。`data-fading` 属性で CSS 側 opacity トランジション制御。`pointer-events: none`。Google docstring を付ける。
  - ファイル：`frontend/src/features/map/LandmarkLockOverlay.jsx`, `frontend/src/features/map/LandmarkLockOverlay.module.css`
  - 依存：なし
  - 完了条件：`<LandmarkLockOverlay isFading={false} />` を SVG 内に置くと鎖＋錠が表示され、`isFading={true}` に切り替えると 600ms かけて opacity が 0 になる。CSS の `transition-duration` が `progressStore` の `UNLOCK_FADE_DURATION_MS` と一致している。

- [x] **5. LandmarkScroll に isLocked / isFading prop を追加**
  - 内容：既存の `label` prop に加えて `isLocked` / `isFading` を受け取り、`isLocked === true` のとき `<LandmarkLockOverlay isFading={isFading} />` を子に配置する。デフォルト値は両方 `false`。テキスト・矩形描画は変更しない。docstring を更新する。
  - ファイル：`frontend/src/features/map/LandmarkScroll.jsx`
  - 依存：タスク4
  - 完了条件：`isLocked={false}` で従来通り、`isLocked={true}` で鎖＋錠が重なる。`isFading={true}` でフェードアウトする。

- [x] **6. LandmarkDetail に isCleared prop と「クリア済み」ラベルを追加**
  - 内容：`isCleared: boolean` prop を追加。`true` のとき、難易度ラベル（`y=-halfHeight + 28`）の上（`y=-halfHeight + 12` 付近）に小さめの「クリア済み」テキストを `<text>` で描画する。緑系（`#5cb85c` 程度）で塗る。`false` のときは要素を描画しない。CSS Module 側にクラス（`.clearedLabel`）を追加。docstring を更新する。
  - ファイル：`frontend/src/features/map/LandmarkDetail.jsx`, `frontend/src/features/map/LandmarkDetail.module.css`
  - 依存：なし
  - 完了条件：`isCleared={false}` で従来通り、`isCleared={true}` で難易度の上に「クリア済み」が出る。たたかうボタンは引き続き有効。

- [x] **7. Landmark で progressStore を購読しロック表示・クリック抑止を実装**
  - 内容：`Landmark` 内で `useProgressStore` を購読。`isUnlocked` / `isCleared` / `pendingUnlockStageId` / `isUnlockAnimating` を取得。導出値 `shouldShowLock`（未解放 OR pendingUnlock 対象）、`isFading`（pendingUnlock 対象 AND アニメ中）、`isClickable`（移動中・アニメ中・未解放いずれかなら false）を計算。`handleClick` / `handleFight` の早期リターン条件にこれらを追加。`LandmarkScroll` に `isLocked={shouldShowLock}` / `isFading={isFading}` を渡し、`LandmarkDetail` に `isCleared={isCleared}` を渡す。`stageId` が無いランドマーク（経由地）はロック判定をスキップし、`isUnlockAnimating` だけクリック抑止に効かせる。docstring を更新する。
  - ファイル：`frontend/src/features/map/Landmark.jsx`
  - 依存：タスク3, 5, 6
  - 完了条件：初期状態でマップ上の `*-2` 以降のランドマークに鎖＋錠が出てクリックしても何も起きない。手動で `useProgressStore.setState({clearedStageIds:["1-1"]})` を行うと `1-2` のロックが消える。

- [x] **8. MapScreen にアニメ起動 useEffect を追加**
  - 内容：マウント時に `useProgressStore.getState().pendingUnlockStageId !== null && !isUnlockAnimating` なら `startUnlockAnimation()` を呼ぶ useEffect を 1 つ追加（依存配列は空）。既存の `initializeMap` useEffect とは独立させる。docstring を更新する。
  - ファイル：`frontend/src/features/map/MapScreen.jsx`
  - 依存：タスク3
  - 完了条件：マップ画面再マウント時、`pendingUnlockStageId` が立っていれば自動で解放アニメが起動する。手動で `pendingUnlockStageId` を立てた後マップを再表示すると、対象ランドマークのロックがフェードアウトする。

- [x] **9. BattleScreen / VictoryClearOverlay の退出経路を 2 系統に分離**
  - 内容：`BattleScreen` の props に `onClearedExitToMap(stageId)` を追加し、`VictoryClearOverlay` の「マップへ戻る」クリック時に `onClearedExitToMap(stageId)` を呼ぶよう配線する。右上 `BackToMapButton` は既存の `onExitToMap`（クリア記録なし）のままにする。`VictoryClearOverlay` 側は `onExitToMap` プロパティ名を保ったまま、`BattleScreen` が `stageId` を bind して渡す形にすればコンポーネント自体の変更を最小化できる。docstring を更新する。
  - ファイル：`frontend/src/features/battle/BattleScreen.jsx`, 必要なら `frontend/src/features/battle/VictoryClearOverlay.jsx`
  - 依存：なし
  - 完了条件：`VictoryClearOverlay` の「マップへ戻る」と右上 `BackToMapButton` で別々のコールバックが親に伝わる。

- [x] **10. App.jsx で markStageCleared を結線**
  - 内容：`App.jsx` で `onClearedExitToMap` ハンドラを新設し、`useProgressStore.getState().markStageCleared(stageId)` を呼んでから `setScreen('map')` する。既存の `onExitToMap` は `setScreen('map')` のみのままにする。docstring を更新する。
  - ファイル：`frontend/src/App.jsx`
  - 依存：タスク3, 9
  - 完了条件：勝利演出経由でマップに戻ると `clearedStageIds` に当該 `stageId` が追加され、次ステージのロックがフェードアウトする。右上テスト用ボタンでマップに戻った場合は記録されない。

- [x] **11. README.md のディレクトリ構造を更新**
  - 内容：新規追加ファイル（`progressStore.js`、`LandmarkLockOverlay.jsx` + `.module.css`、`parseStageId.js`、`getNextStageId.js`）を README.md の「ディレクトリ構造」セクションに追記する。CLAUDE.md の運用ルール（ディレクトリ追加・リネーム時は README を同コミットで更新）に従う。
  - ファイル：`README.md`
  - 依存：タスク1, 2, 3, 4
  - 完了条件：README.md の構造図に新規ファイル 5 つすべてが反映されている。実装と構造図に齟齬が無い。
