import { create } from 'zustand';
import cutscenesData from '../data/cutscenes.json';
import parseStageId from '../features/map/parseStageId';

/**
 * 自動ガイド演出（カットシーン）の表示状態を管理する Zustand ストア。
 *
 * `cutscenes.json` に定義された「トリガー → 演出の並び（steps）」を、
 * ゲーム内イベント（`fireTrigger`）に応じて再生する。フェーズ1で再生する
 * step は2種類:
 *   - `bubble`（ロボの吹き出し）: `point`（指差し誘導の対象 ID）を持つことが
 *     あり、`RoboBubble` 側が対象 DOM 要素を指す演出を出す。さらに
 *     `nameInput`（プレイヤー名の入力フォーム）や `backdrop`（吹き出しの
 *     背後に敷く全画面の一枚絵）を持てる。
 *   - `choices`（主人公の返事の選択肢）: `{label, goto?}` の配列で、`goto` は
 *     飛び先 step の `id`。通常は `bubble` と同じ step に置き、セリフの
 *     読み上げ後に吹き出しパネルの右上へ選択ウィンドウを重ねて出す
 *     （`bubble` 無しの選択肢だけの step も可）。
 *   - `openCardHelp`（カード説明モーダル誘導）: その step に進むと
 *     `pendingCardHelpId` を立て、`BattleScreen` が `HelpWindow` を開く。
 *     吹き出しの「あいだ」に挟めるので、説明の途中で特定カードのモーダルを
 *     見せてから次の吹き出しへ続けられる。
 *   - `openSlotHelp`（マス説明モーダル誘導）: `openCardHelp` のマス版。
 *     その step に進むと `pendingSlotHelpId` を立て、`BattleScreen` が
 *     `HelpWindow` を「マス」カテゴリの該当タブで開く（例: 種類指定マス
 *     `acceptOnly`、倍率マス `multiplier`、条件マス `condition`）。
 * `playAnimation`（再生アニメ）のみを持つ step は再生対象から除外する
 * （データとしては将来フェーズ用に温存される）。
 *
 * step は1つずつ表示し、`advance()`（クリック／タップ）で次へ送る。
 * `openCardHelp` step ではモーダルが閉じる（`consumeCardHelp()`）まで待ち、
 * 閉じたら次の step へ進む。末尾まで送ると `finish()` が走り、`once` な
 * カットシーンは `id` を `seenIds` に記録して二度と出さないようにする。
 * `seenIds` は localStorage に永続化し、リロード後も再表示しない。
 *
 * 状態:
 *   - `seenIds` (string[]): 表示済みカットシーン ID（localStorage 永続）。
 *   - `activeId` (string|null): 再生中のカットシーン ID。null なら非表示。
 *   - `steps` (Array<object>): 再生中カットシーンの再生対象 step（順送り用）。
 *     各要素は `{ bubble?, point?, openCardHelp? }`。`bubble` か `openCardHelp`
 *     のどちらかを必ず持つ。
 *   - `stepIndex` (number): 現在表示中の step のインデックス。
 *   - `pendingCardHelpId` (string|null): いま開くべきカード説明モーダルの対象
 *     カード ID。`openCardHelp` step に進むと立ち、`BattleScreen` が
 *     `HelpWindow` を開く。モーダルを閉じると `consumeCardHelp()` で
 *     クリアして次の step へ進む。
 *   - `pendingSlotHelpId` (string|null): いま開くべきマス説明モーダルの対象
 *     マス種別 ID。`openSlotHelp` step に進むと立つ。閉じ方・進み方は
 *     `pendingCardHelpId` と同じ（`consumeCardHelp()` が両方を扱う）。
 *   - `isInputLocked` (boolean): 会話送りの入力（クリック／Enter）を一時的に
 *     無効化するフラグ。目覚め演出（`WakeUpOverlay`）の間、黒画面の下で
 *     再生中の会話が見えないまま送られてしまうのを防ぐ。`RoboBubble` が
 *     参照し、立っている間は早送り・送りの両方を無視する。
 *
 * 公開アクション:
 *   - `fireTrigger(event)` : イベントに一致するカットシーンを探して再生開始。
 *   - `advance()`          : 次の step へ。末尾なら `finish()`。
 *   - `chooseOption(choice)`: 選択肢を選ぶ。`goto` があれば該当 `id` の step へ。
 *   - `goToStep(index)`    : 指定 step へ移動（`openCardHelp` ならモーダルを開く）。
 *   - `finish()`           : 再生終了。`once` なら `seenIds` に記録。定義に
 *     `nextTrigger` があれば続けて `fireTrigger` し、次のカットシーンへ連鎖する
 *     （例: オープニング会話 → ステージ1への誘導ガイド）。
 *   - `consumeCardHelp()`  : モーダルを閉じた合図。次の step へ進む。
 *   - `setInputLocked(locked)`: 会話送り入力の無効化フラグを切り替える。
 *   - `resetSeen()`        : 表示済み記録を全消去（開発・テスト用）。
 */

const STORAGE_KEY = 'unilab.cutscene.seenIds';

/**
 * localStorage から表示済みカットシーン ID の配列を読み込む。
 *
 * 値が無い・壊れている・localStorage が使えない（SSR やプライベート
 * モード等）場合は空配列を返し、例外で初期化が止まらないようにする。
 *
 * Returns:
 *     string[]: 表示済みカットシーン ID の配列。
 */
function loadSeenIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 表示済みカットシーン ID の配列を localStorage へ保存する。
 *
 * localStorage が使えない環境では黙って無視する（永続化できなくても
 * セッション中の表示制御は `seenIds` の state で機能するため）。
 *
 * Args:
 *     ids (string[]): 保存する ID 配列。
 */
function saveSeenIds(ids) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* 永続化不可でも致命的ではないので無視する */
  }
}

/**
 * イベントに `trigger` が一致するカットシーン定義を `cutscenes.json` から探す。
 *
 * `type` が一致し、定義側が持つ `stageId` / `screen` がイベントの値と
 * 一致するものを先頭から1件返す。定義側に存在しないパラメータは判定に
 * 使わない（例: `openScreen` トリガーは `stageId` を見ない）。
 *
 * Args:
 *     event (object): 発火イベント。`{ type, stageId?, screen? }`。
 *
 * Returns:
 *     {id: string, def: object} | null: 一致したカットシーン。無ければ null。
 */
function findCutscene(event) {
  for (const [id, def] of Object.entries(cutscenesData)) {
    const trigger = def.trigger;
    if (!trigger || trigger.type !== event.type) {
      continue;
    }
    if (trigger.stageId !== undefined && trigger.stageId !== event.stageId) {
      continue;
    }
    if (trigger.screen !== undefined && trigger.screen !== event.screen) {
      continue;
    }
    return { id, def };
  }
  return null;
}

/**
 * step が持つヘルプモーダル誘導を `pending*HelpId` の組へ変換する。
 *
 * `openCardHelp`（カード説明）と `openSlotHelp`（マス説明）のどちらを
 * 持つかに応じて対応する ID を立て、持たない側（および両方持たない step）
 * は null にする。`fireTrigger` の初期化と `goToStep` の遷移で共通に使う。
 *
 * Args:
 *     step (object|undefined): 対象の step。undefined も許容する。
 *
 * Returns:
 *     {pendingCardHelpId: string|null, pendingSlotHelpId: string|null}:
 *         その step で開くべきヘルプモーダルの対象 ID の組。
 */
function helpIdsFromStep(step) {
  return {
    pendingCardHelpId:
      typeof step?.openCardHelp === 'string' ? step.openCardHelp : null,
    pendingSlotHelpId:
      typeof step?.openSlotHelp === 'string' ? step.openSlotHelp : null,
  };
}

const useCutsceneStore = create((set, get) => ({
  seenIds: loadSeenIds(),
  activeId: null,
  steps: [],
  stepIndex: 0,
  pendingCardHelpId: null,
  pendingSlotHelpId: null,
  isInputLocked: false,

  /**
   * 会話送り入力（クリック／Enter）の無効化フラグを切り替える。
   *
   * 目覚め演出（`WakeUpOverlay`）の開始時に `App` が true を、演出完了時に
   * false をセットする。立っている間、`RoboBubble` は早送り・送りの入力を
   * すべて無視する（黒画面の下で会話が見えないまま進むのを防ぐ）。
   *
   * Args:
   *     locked (boolean): true で入力を無効化、false で解除。
   */
  setInputLocked: (locked) => {
    set({ isInputLocked: locked });
  },

  /**
   * イベントに一致するカットシーンを探し、条件を満たせば再生を開始する。
   *
   * 次のいずれかに当てはまる場合は何もしない（no-op）:
   *   - すでに別のカットシーンを再生中（`activeId` が非 null）
   *   - 一致するカットシーンが無い
   *   - フェーズ1で表示できる吹き出し（`bubble` step）が1つも無い
   *     （`playAnimation` のみの開放演出など）。`seenIds` には記録せず、
   *     将来フェーズで再生できるよう温存する
   *   - `once`（デフォルト true）かつ既に表示済み
   *
   * 再生対象の step は `bubble` と `openCardHelp` の2種類だけを取り出す。
   * 先頭 step（通常は吹き出し）からスタートし、`goToStep(0)` 相当の初期化で
   * 先頭が `openCardHelp` ならその時点でモーダルを開く。
   *
   * Args:
   *     event (object): 発火イベント。`{ type, stageId?, screen? }`。
   */
  fireTrigger: (event) => {
    if (get().activeId) {
      return;
    }
    const found = findCutscene(event);
    if (!found) {
      return;
    }
    const { id, def } = found;
    const steps = def.steps.filter(
      (step) =>
        typeof step.bubble === 'string' ||
        Array.isArray(step.choices) ||
        typeof step.openCardHelp === 'string' ||
        typeof step.openSlotHelp === 'string' ||
        typeof step.waitForArrival === 'string' ||
        typeof step.waitForBattle === 'string' ||
        /*
         * 盤面変身 step（最終ボス第二形態）。吹き出しを持たず、`BattleScreen`
         * がこの step に進んだのを検知してフローチャート・手札の変身演出＋
         * 差し替えを行い、完了後に advance で次の吹き出しへ進める。
         */
        step.boardTransform === true ||
        /*
         * ボス復活再開 step（フェイクアウト会話の末尾）。吹き出しを持たず、
         * `BattleScreen` がこの step で `resumeReviveSequence`（白フラッシュ
         * 〜第二形態復活）を呼んで会話を終了させる。
         */
        step.reviveBoss === true,
    );
    const hasBubble = steps.some((step) => typeof step.bubble === 'string');
    if (!hasBubble) {
      return;
    }
    const isOnce = def.once !== false;
    if (isOnce && get().seenIds.includes(id)) {
      return;
    }
    set({
      activeId: id,
      steps,
      stepIndex: 0,
      ...helpIdsFromStep(steps[0]),
    });
  },

  /**
   * 現在の step から次の step へ進める。
   *
   * 再生中でない（`activeId` が null）ときは no-op。`openCardHelp` step の
   * 上ではロボの吹き出しが隠れていてクリックで送れないため、ここは主に
   * 吹き出しのクリック／タップ送りから呼ばれる。
   */
  advance: () => {
    if (!get().activeId) {
      return;
    }
    get().goToStep(get().stepIndex + 1);
  },

  /**
   * 現在 step の選択肢（`choices` の1要素）を選んで先へ進める。
   *
   * 選択肢が `goto`（飛び先 step の `id`）を持つ場合は該当 step へジャンプ
   * する（分岐・ループ用。例: 「いやだ」→ 説得の step へ）。`goto` が無い、
   * または該当 `id` が見つからない場合は `advance()` と同じく次の step へ
   * 進む。再生中でないときは no-op。
   *
   * Args:
   *     choice (object): 選ばれた選択肢。`{label: string, goto?: string}`。
   */
  chooseOption: (choice) => {
    const { activeId, steps } = get();
    if (!activeId) {
      return;
    }
    if (choice && typeof choice.goto === 'string') {
      const index = steps.findIndex((step) => step.id === choice.goto);
      if (index >= 0) {
        get().goToStep(index);
        return;
      }
    }
    get().advance();
  },

  /**
   * 指定インデックスの step へ移動する。末尾を超える場合は `finish()`。
   *
   * 移動先が `openCardHelp` / `openSlotHelp` step なら対応する
   * `pendingCardHelpId` / `pendingSlotHelpId` を立てて説明モーダルを開かせ、
   * `bubble` step ならどちらも null に戻す。`advance()` と
   * `consumeCardHelp()` の共通の遷移処理。
   *
   * Args:
   *     index (number): 移動先の step インデックス。
   */
  goToStep: (index) => {
    const { steps } = get();
    if (index >= steps.length) {
      get().finish();
      return;
    }
    set({
      stepIndex: index,
      ...helpIdsFromStep(steps[index]),
    });
  },

  /**
   * 再生を終了し、表示状態をリセットする。
   *
   * 再生していたカットシーン ID を `seenIds` に追加して localStorage に
   * 永続化する（`once: false` のものも、フェーズ1では同様に記録する。
   * 繰り返し表示が要るものはトリガー側で再発火させる設計）。
   *
   * 定義に `nextTrigger`（`{type, stageId?}`）がある場合は、終了処理の後に
   * そのイベントを `fireTrigger` し、次のカットシーンへ間を空けずに連鎖する
   * （例: `opening-wake` → `enterMapArea` でステージ1への誘導ガイドへ）。
   */
  finish: () => {
    const { activeId, seenIds } = get();
    if (!activeId) {
      return;
    }
    const nextTrigger = cutscenesData[activeId]?.nextTrigger ?? null;
    const nextSeen = seenIds.includes(activeId)
      ? seenIds
      : [...seenIds, activeId];
    saveSeenIds(nextSeen);
    set({
      activeId: null,
      steps: [],
      stepIndex: 0,
      seenIds: nextSeen,
      pendingCardHelpId: null,
      pendingSlotHelpId: null,
    });
    if (nextTrigger) {
      get().fireTrigger(nextTrigger);
    }
  },

  /**
   * カード・マス説明モーダルを閉じた合図。`pendingCardHelpId` /
   * `pendingSlotHelpId` をクリアし、いま開いていたモーダルがカットシーンの
   * `openCardHelp` / `openSlotHelp` step によるものなら次の step へ進める。
   *
   * `BattleScreen` がモーダルを閉じるときに呼ぶ。再生中で現在 step が
   * `openCardHelp` / `openSlotHelp` の場合だけ `advance` 相当の遷移を行い、
   * それ以外（手動で開いたヘルプ等）は単に両 ID を null に戻すだけにする。
   */
  consumeCardHelp: () => {
    const { activeId, steps, stepIndex } = get();
    const current = steps[stepIndex];
    if (
      activeId &&
      current &&
      (typeof current.openCardHelp === 'string' ||
        typeof current.openSlotHelp === 'string')
    ) {
      get().goToStep(stepIndex + 1);
    } else {
      set({ pendingCardHelpId: null, pendingSlotHelpId: null });
    }
  },

  /**
   * 表示済み記録（`seenIds`）を全消去する。開発・テスト用。
   *
   * localStorage の保存値も空配列で上書きし、すべてのガイドを「未表示」に
   * 戻す。再生中のカットシーンがあれば併せて打ち切る（リセット後に古い
   * 再生状態が残って、最初からのやり直しを妨げないようにする）。
   */
  resetSeen: () => {
    saveSeenIds([]);
    set({
      seenIds: [],
      activeId: null,
      steps: [],
      stepIndex: 0,
      pendingCardHelpId: null,
      pendingSlotHelpId: null,
      /* 目覚め演出の途中で R リセットされた場合に備え、入力ロックも解除する
         （`WakeUpOverlay` が onEnd を呼ばずに外れると解除の機会が無いため） */
      isInputLocked: false,
    });
  },

  /**
   * すべてのカットシーンを「視聴済み」にする。開発・テスト用。
   *
   * `cutscenes.json` の全 ID を `seenIds` に入れて localStorage に永続化し、
   * 以降どのトリガーが発火してもガイドが出ないようにする。再生中の
   * カットシーンがあれば即座に閉じる。
   */
  markAllSeen: () => {
    const allIds = Object.keys(cutscenesData);
    saveSeenIds(allIds);
    set({
      seenIds: allIds,
      activeId: null,
      steps: [],
      stepIndex: 0,
      pendingCardHelpId: null,
      pendingSlotHelpId: null,
      isInputLocked: false,
    });
  },

  /**
   * 指定ステージに「到達済み」になるよう、それより前のステージで発生する
   * カットシーンだけを視聴済みにする。開発・テスト用。
   *
   * 各カットシーンの `trigger.stageId` を `targetStageId` とワールド・番号で
   * 比較し、`targetStageId` より前（前ワールド、または同ワールドで番号が
   * 小さい）のものだけを `seenIds` にまとめて上書き保存する。`targetStageId`
   * 以降（同ステージを含む）のカットシーンは未視聴のまま残し、選んだ地点から
   * テストで再生できるようにする。`trigger.stageId` を持たない（またはパース
   * できない）カットシーン（オープニングの目覚め会話 `opening-wake` など）は
   * 「どのステージよりも前に出るもの」とみなして常に視聴済みに含める。
   * これを未視聴のまま残すと、自己紹介（`revealRoboName`）を含む
   * `opening-wake` が視聴済みにならず、スキップ後の全会話でロボの名前
   * プレートが「???」のままになってしまう（`RoboBubble` は「自己紹介を
   * 含むカットシーンを視聴済みか」で名前の表示を判定するため）。
   * 再生中があれば閉じる。
   * `setProgressUpToStage`（progressStore）と対で「到達ステージ選択」を構成する。
   *
   * Args:
   *     targetStageId (string): 「ここに到達した」基準ステージ ID。
   */
  markSeenBeforeStage: (targetStageId) => {
    const target = parseStageId(targetStageId);
    if (!target) {
      return;
    }
    const targetWorld = Number(target.world);
    const seen = Object.entries(cutscenesData)
      .filter(([, def]) => {
        const stageId = def.trigger?.stageId;
        const parsed = stageId ? parseStageId(stageId) : null;
        if (!parsed) {
          /* stageId 無し＝オープニング等、どのステージよりも前。常に視聴済み */
          return true;
        }
        const world = Number(parsed.world);
        return (
          world < targetWorld ||
          (world === targetWorld && parsed.number < target.number)
        );
      })
      .map(([id]) => id);
    saveSeenIds(seen);
    set({
      seenIds: seen,
      activeId: null,
      steps: [],
      stepIndex: 0,
      pendingCardHelpId: null,
      pendingSlotHelpId: null,
      isInputLocked: false,
    });
  },
}));

export default useCutsceneStore;
