# タスク一覧: 攻撃カード処理（ダメージ計算と演出）

## 概要

`battleStore` の拡張を最初に行い、敵 HP と `damageEvents` の状態基盤を整える。次に共通の `HpBar` のトランジションを 0.25s に揃える（プレイヤー側にも将来効くが現時点では挙動変化なし）。その後、演出系の独立コンポーネント（`EnemySprite` のフラッシュ・新規 `DamageFloater`）を並行に組む。最後に `BattleScreen` でこれらを敵エリアに統合し、敵 HP の数値併記も配置する。動作確認は最後に手動で行う。

タスク 1 完了で「実行のたびに HP が `maxHp` に戻り、ダメージ適用で減算される」状態がストアレベルで成立し、ブラウザのコンソール経由で確認可能になる。タスク 2〜4 で 3 種の演出パーツが個別に動く。タスク 5 で全部が画面上で同時に走る完成状態に到達する。

合計タスク数：6 件 ｜ 想定工数：約 3.5 時間

## タスク

- [ ] **1. `battleStore` に敵 HP 状態と関連アクションを追加する**
  - 内容:
    - モジュールトップで `enemiesData` を import：`import enemiesData from '../data/enemies.json';`
    - 状態を 3 つ追加（初期値）：
      - `currentEnemyHp: 0`
      - `maxEnemyHp: 0`
      - `damageEvents: []`
      - `_damageCounter: 0`（ビュー非購読の内部カウンタ）
    - `initializeBattle(stage)` を拡張：`enemiesData.enemies.find((e) => e.id === stage.enemyId)` から `maxHp` を取得し、`maxEnemyHp` と `currentEnemyHp` の両方にセット、`damageEvents = []` に初期化（既存の `handCards` / `slotAssignments` / `activeInstanceId` 初期化はそのまま）
    - `startExecution(stage)` の `beginSequence` 冒頭の `set({ isExecuting: true, currentPhaseMs: phaseMs })` を以下に変更：
      ```js
      set((s) => ({
        isExecuting: true,
        currentPhaseMs: phaseMs,
        currentEnemyHp: s.maxEnemyHp,   // 要件 3-1: HP リセット
        damageEvents: [],                // 残骸クリア
      }));
      ```
    - `startExecution` の `phases.forEach` 内のコールバックに、ダメージ適用ロジックを追加：
      ```js
      phases.forEach((phase, i) => {
        setTimeout(() => {
          set({ executionStep: phase });
          if (phase.type === 'node') {
            const card = get().slotAssignments[phase.id];
            if (card && card.id === 'attack' && card.power > 0) {
              get().applyDamage(card.power);
            }
          }
        }, i * phaseMs);
      });
      ```
    - 完了タイマーは無変更（`currentEnemyHp` には触れない＝結果値を保持、要件 3-2）
    - 新規アクション `applyDamage(amount)`：
      ```js
      applyDamage: (amount) => set((state) => {
        const next = Math.max(0, state.currentEnemyHp - amount);
        const id = `d-${state._damageCounter}`;
        return {
          currentEnemyHp: next,
          damageEvents: [...state.damageEvents, { id, amount }],
          _damageCounter: state._damageCounter + 1,
        };
      });
      ```
    - 新規アクション `dismissDamageEvent(id)`：
      ```js
      dismissDamageEvent: (id) => set((state) => ({
        damageEvents: state.damageEvents.filter((e) => e.id !== id),
      }));
      ```
    - 全クラス／関数に Google 形式の日本語 docstring を付与（既存の他アクションと一貫させる）。store 全体の上部 docstring にも追加した state とアクションを記載
  - ファイル: `frontend/src/stores/battleStore.js`
  - 依存: なし
  - 完了条件:
    - `npm run lint` がパスする
    - ブラウザコンソールで戦闘画面マウント後 `useBattleStore.getState()` を実行 → `currentEnemyHp` と `maxEnemyHp` が `30`（slime の maxHp）になっている
    - 続けて `useBattleStore.getState().applyDamage(12)` を実行 → `currentEnemyHp` が `18`、`damageEvents` に 1 件 push される
    - 続けて `useBattleStore.getState().applyDamage(100)` を実行 → `currentEnemyHp` が `0` にクランプされる
    - 続けて `useBattleStore.getState().dismissDamageEvent('d-0')` を実行 → `damageEvents` から該当要素が消える
  - 対応要件: 1-1, 1-2, 1-3, 2-1, 2-2, 2-3, 3-1, 3-2, 3-3

- [ ] **2. `HpBar.module.css` のトランジションを 0.25s 連続値に変更する**
  - 内容:
    - `.fill` の `transition: width 120ms steps(8, end);` を `transition: width 0.25s ease-out;` に置換
    - 既存コメントは無し。共有コンポーネントなのでプレイヤー側にも適用される旨を 1 行コメントで残す（任意）
  - ファイル: `frontend/src/components/HpBar.module.css`
  - 依存: なし
  - 完了条件:
    - `npm run lint`（CSS は対象外なので実質ビルドが通れば OK）
    - 戦闘画面で `useBattleStore.getState().applyDamage(12)` を手動で実行すると、敵 HP バーの幅が約 0.25 秒かけて滑らかに縮む
  - 対応要件: 7-1, 7-2

- [ ] **3. `EnemySprite` にフラッシュ演出を組み込む**
  - 内容:
    - 状態追加: `const [flashKey, setFlashKey] = useState(null);`
    - ストアから `damageEvents` 末尾の id を購読:
      ```jsx
      const lastDamageId = useBattleStore(
        (s) => s.damageEvents[s.damageEvents.length - 1]?.id ?? null
      );
      ```
    - `useEffect`：`lastDamageId` が変化して非 null なら `setFlashKey(lastDamageId)`
      ```jsx
      useEffect(() => {
        if (lastDamageId) setFlashKey(lastDamageId);
      }, [lastDamageId]);
      ```
    - `<img>` の className を `${styles.sprite} ${flashKey ? styles.flashing : ''}` に変更し、`onAnimationEnd={() => setFlashKey(null)}` を追加
    - `EnemySprite.module.css` に追加:
      ```css
      .flashing {
        animation: enemyFlash 0.25s ease-out 1;
      }

      @keyframes enemyFlash {
        0%   { filter: brightness(1)   saturate(1); }
        35%  { filter: brightness(2.2) saturate(0.2); }
        100% { filter: brightness(1)   saturate(1); }
      }
      ```
    - `EnemySprite.jsx` の上部 docstring に「ダメージイベント受信時に短時間フラッシュする」旨を 1 文追加
  - ファイル:
    - `frontend/src/features/battle/enemy/EnemySprite.jsx`
    - `frontend/src/features/battle/enemy/EnemySprite.module.css`
  - 依存: タスク 1
  - 完了条件:
    - `npm run lint` がパスする
    - 戦闘画面でコンソールから `useBattleStore.getState().applyDamage(5)` を実行すると敵スプライトが 0.25 秒間白く明滅する
    - 連続して 2 回コールしても 2 回明滅する（2 回目もアニメーションが再起動する）
    - フラッシュ中も idle アニメーションのフレーム切り替えが止まらない
  - 対応要件: 5-1, 5-2, 5-3

- [ ] **4. `DamageFloater` コンポーネントを新規作成する**
  - 内容:
    - 新規ファイル `DamageFloater.jsx`：
      ```jsx
      function DamageFloater() {
        const damageEvents = useBattleStore((s) => s.damageEvents);
        const dismiss = useBattleStore((s) => s.dismissDamageEvent);

        return (
          <div className={styles.layer}>
            {damageEvents.map((e) => (
              <span
                key={e.id}
                className={styles.number}
                onAnimationEnd={() => dismiss(e.id)}
              >
                -{e.amount}
              </span>
            ))}
          </div>
        );
      }
      export default DamageFloater;
      ```
    - 新規 CSS `DamageFloater.module.css`：
      ```css
      .layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .number {
        position: absolute;
        font-family: 'Press Start 2P', 'Courier New', Courier, monospace;
        font-size: 1.5rem;
        color: #ff5d5d;
        text-shadow: 0 0 4px #000, 0 2px 0 #000;
        animation: damageFloat 0.8s ease-out forwards;
      }

      @keyframes damageFloat {
        0%   { transform: translateY(0)     scale(1.0); opacity: 1; }
        20%  { transform: translateY(-12px) scale(1.15); opacity: 1; }
        100% { transform: translateY(-48px) scale(1.0); opacity: 0; }
      }
      ```
    - 全関数に Google 形式の日本語 docstring（コンポーネントの責務、`damageEvents` を購読して `<span>` 列をマップする旨、`onAnimationEnd` で自己 dismiss する旨）
  - ファイル:
    - `frontend/src/features/battle/enemy/DamageFloater.jsx`（新規）
    - `frontend/src/features/battle/enemy/DamageFloater.module.css`（新規）
  - 依存: タスク 1
  - 完了条件:
    - `npm run lint` がパスする
    - import 単体ではビルドエラーが出ない（`BattleScreen` への組み込みはタスク 5）
  - 対応要件: 6-1, 6-2, 6-3

- [ ] **5. `BattleScreen` に敵 HP 数値表示と `DamageFloater` を統合する**
  - 内容:
    - `BattleScreen.jsx`：
      - `import DamageFloater from './enemy/DamageFloater';` を追加
      - 既存ローカル変数 `enemy` / `enemyMaxHp` の代わりにストアから直接購読：
        ```jsx
        const currentEnemyHp = useBattleStore((s) => s.currentEnemyHp);
        const maxEnemyHp = useBattleStore((s) => s.maxEnemyHp);
        ```
      - 不要になった `import enemiesData from '../../data/enemies.json';` を削除（store 側に移ったため。`stage.enemyId` の参照は EnemySprite に残るので削除不要）
      - `enemyArea` の中身を以下に置き換え：
        ```jsx
        <div className={styles.enemyArea}>
          <EnemySprite enemyId={stage.enemyId} state="idle" />
          <div className={styles.hpBox}>
            <HpBar currentHp={currentEnemyHp} maxHp={maxEnemyHp} />
            <span className={styles.hpText}>
              {currentEnemyHp}/{maxEnemyHp}
            </span>
          </div>
          <DamageFloater />
        </div>
        ```
      - 上部 docstring の上段説明を「敵スプライト ＋ 敵 HP バー（数値併記） ＋ ダメージ数字フロート層」に更新
    - `BattleScreen.module.css`：
      - `.enemyArea` に `position: relative;` を追加（`DamageFloater` の絶対配置の基準点にするため、要件 8-4）
  - ファイル:
    - `frontend/src/features/battle/BattleScreen.jsx`
    - `frontend/src/features/battle/BattleScreen.module.css`
  - 依存: タスク 1, タスク 4
  - 完了条件:
    - `npm run lint` がパスし、`npm run build` がパスする
    - 画面マウント直後に敵 HP バーの右に `30/30` が表示される
    - 既存のレイアウト（敵エリアの高さ・スプライト位置・拡大トグル時のレイアウト変化）が崩れていない
  - 対応要件: 4-1, 4-2, 4-3, 8-4

- [ ] **6. ブラウザで動作確認を行う**
  - 内容（自己レビューチェックリスト）:
    1. **初期表示**: 戦闘画面に入った直後、敵 HP バーが満タン、`30/30` 表示
    2. **単発ヒット**: `slot-1` だけに `attack:12`（手札の 1 枚目）を置き、他スロットには別の attack を埋めて実行 → スロット 1 のハイライト時にフラッシュ・`-12`・バー減少が**同時**に走る
    3. **連続ヒット**: `attack:12 / attack:5 / attack:7` を順に並べて実行 → 順番に演出、終了後 `6/30` で停止
    4. **オーバーキル**: `attack:12` を 3 つ並べて実行 → クランプされて `0/30` で停止
    5. **再実行で HP 復帰**: 4 のあと再度実行 → 開始時に `30/30` に戻り、再び 0 へ
    6. **リセットボタン**: HP が削れた状態でリセットボタン → HP は `0/30` のまま動かない、手札・スロットは初期化される
    7. **非 attack カード**: `slot-2` に `guard:12` を置いて実行 → スロット 2 のハイライトは出るが、HP は変化しない・フラッシュなし・数字なし
    8. **拡大時実行**: 拡大状態で実行ボタン → 縮小トランジション後にシーケンス開始、HP バー数値・フラッシュ・ダメージ数字が崩れず動く
    9. **ドラッグの非干渉**: 通常状態（実行外）でカードをドラッグしても HP は変化しない
  - 依存: タスク 1〜5 すべて
  - 完了条件: 上記 9 項目すべてが期待通りに動く。期待外れがあれば該当タスクへ戻って修正

## 補足

- タスク 1 の `_damageCounter` は内部状態なので、コンソール検証時に直接見える必要はない。`damageEvents` の `id` がユニークになっていれば OK
- タスク 2 のトランジション変更は共有 `HpBar` への変更だが、現状プレイヤー HP は変動しないため副作用は無い。プレイヤー側に変動が入る将来仕様でも同じスタイルで動くはず
- タスク 3 の `flashKey` パターンは「`onAnimationEnd` で null に戻し、次の `lastDamageId` 変化で再付与」で連続発火を成立させる。`key` 属性によるリマウント方式は `<img>` の再読み込みを起こすので採用しない
- タスク 4 と 5 は順序固定（4 → 5）。タスク 4 で作ったコンポーネントをタスク 5 で import するため
