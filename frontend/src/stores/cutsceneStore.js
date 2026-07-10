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
 *     あり、`RoboBubble` 側が対象 DOM 要素を指す演出を出す。
 *   - `openCardHelp`（カード説明モーダル誘導）: その step に進むと
 *     `pendingCardHelpId` を立て、`BattleScreen` が `HelpWindow` を開く。
 *     吹き出しの「あいだ」に挟めるので、説明の途中で特定カードのモーダルを
 *     見せてから次の吹き出しへ続けられる。
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
 *
 * 公開アクション:
 *   - `fireTrigger(event)` : イベントに一致するカットシーンを探して再生開始。
 *   - `advance()`          : 次の step へ。末尾なら `finish()`。
 *   - `goToStep(index)`    : 指定 step へ移動（`openCardHelp` ならモーダルを開く）。
 *   - `finish()`           : 再生終了。`once` なら `seenIds` に記録。
 *   - `consumeCardHelp()`  : モーダルを閉じた合図。次の step へ進む。
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

const useCutsceneStore = create((set, get) => ({
  seenIds: loadSeenIds(),
  activeId: null,
  steps: [],
  stepIndex: 0,
  pendingCardHelpId: null,

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
        typeof step.openCardHelp === 'string' ||
        typeof step.waitForArrival === 'string' ||
        typeof step.waitForBattle === 'string',
    );
    const hasBubble = steps.some((step) => typeof step.bubble === 'string');
    if (!hasBubble) {
      return;
    }
    const isOnce = def.once !== false;
    if (isOnce && get().seenIds.includes(id)) {
      return;
    }
    const firstStep = steps[0];
    set({
      activeId: id,
      steps,
      stepIndex: 0,
      pendingCardHelpId:
        firstStep && typeof firstStep.openCardHelp === 'string'
          ? firstStep.openCardHelp
          : null,
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
   * 指定インデックスの step へ移動する。末尾を超える場合は `finish()`。
   *
   * 移動先が `openCardHelp` step なら `pendingCardHelpId` を立てて
   * カード説明モーダルを開かせ、`bubble` step なら `pendingCardHelpId` を
   * null に戻す。`advance()` と `consumeCardHelp()` の共通の遷移処理。
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
    const step = steps[index];
    set({
      stepIndex: index,
      pendingCardHelpId:
        typeof step.openCardHelp === 'string' ? step.openCardHelp : null,
    });
  },

  /**
   * 再生を終了し、表示状態をリセットする。
   *
   * 再生していたカットシーン ID を `seenIds` に追加して localStorage に
   * 永続化する（`once: false` のものも、フェーズ1では同様に記録する。
   * 繰り返し表示が要るものはトリガー側で再発火させる設計）。
   */
  finish: () => {
    const { activeId, seenIds } = get();
    if (!activeId) {
      return;
    }
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
    });
  },

  /**
   * カード説明モーダルを閉じた合図。`pendingCardHelpId` をクリアし、いま
   * 開いていたモーダルがカットシーンの `openCardHelp` step によるものなら
   * 次の step へ進める。
   *
   * `BattleScreen` がモーダルを閉じるときに呼ぶ。再生中で現在 step が
   * `openCardHelp` の場合だけ `advance` 相当の遷移を行い、それ以外（手動で
   * 開いたヘルプ等）は単に `pendingCardHelpId` を null に戻すだけにする。
   */
  consumeCardHelp: () => {
    const { activeId, steps, stepIndex } = get();
    const current = steps[stepIndex];
    if (activeId && current && typeof current.openCardHelp === 'string') {
      get().goToStep(stepIndex + 1);
    } else {
      set({ pendingCardHelpId: null });
    }
  },

  /**
   * 表示済み記録（`seenIds`）を全消去する。開発・テスト用。
   *
   * localStorage の保存値も空配列で上書きし、すべてのガイドを「未表示」に
   * 戻す。
   */
  resetSeen: () => {
    saveSeenIds([]);
    set({ seenIds: [] });
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
   * できない）カットシーンは対象外で未視聴のまま。再生中があれば閉じる。
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
          return false;
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
    });
  },
}));

export default useCutsceneStore;
