import { create } from 'zustand';
import cutscenesData from '../data/cutscenes.json';

/**
 * 自動ガイド演出（カットシーン）の表示状態を管理する Zustand ストア。
 *
 * `cutscenes.json` に定義された「トリガー → 演出の並び（steps）」を、
 * ゲーム内イベント（`fireTrigger`）に応じて再生する。フェーズ1では演出
 * 種類のうち **ロボの吹き出し（`bubble`）だけ** を扱い、`point`（指差し
 * 誘導）・`playAnimation`（再生アニメ）を持つ step は表示対象から除外する
 * （データとしては将来フェーズ用に温存される）。
 *
 * 吹き出しは1つずつ表示し、`advance()`（クリック／タップ）で次へ送る。
 * 末尾まで送ると `finish()` が走り、`once` なカットシームは `id` を
 * `seenIds` に記録して二度と出さないようにする。`seenIds` は localStorage
 * に永続化し、リロード後も再表示しない。
 *
 * 状態:
 *   - `seenIds` (string[]): 表示済みカットシーン ID（localStorage 永続）。
 *   - `activeId` (string|null): 再生中のカットシーン ID。null なら非表示。
 *   - `bubbles` (string[]): 再生中カットシーンの吹き出し文言（順送り用）。
 *   - `stepIndex` (number): 現在表示中の吹き出しのインデックス。
 *
 * 公開アクション:
 *   - `fireTrigger(event)` : イベントに一致するカットシーンを探して再生開始。
 *   - `advance()`          : 次の吹き出しへ。末尾なら `finish()`。
 *   - `finish()`           : 再生終了。`once` なら `seenIds` に記録。
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
  bubbles: [],
  stepIndex: 0,

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
    const bubbles = def.steps
      .filter((step) => typeof step.bubble === 'string')
      .map((step) => step.bubble);
    if (bubbles.length === 0) {
      return;
    }
    const isOnce = def.once !== false;
    if (isOnce && get().seenIds.includes(id)) {
      return;
    }
    set({ activeId: id, bubbles, stepIndex: 0 });
  },

  /**
   * 次の吹き出しへ進める。末尾を超える場合は `finish()` で再生終了する。
   *
   * 再生中でない（`activeId` が null）ときは no-op。
   */
  advance: () => {
    const { activeId, bubbles, stepIndex } = get();
    if (!activeId) {
      return;
    }
    const nextIndex = stepIndex + 1;
    if (nextIndex < bubbles.length) {
      set({ stepIndex: nextIndex });
    } else {
      get().finish();
    }
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
    set({ activeId: null, bubbles: [], stepIndex: 0, seenIds: nextSeen });
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
    set({ seenIds: allIds, activeId: null, bubbles: [], stepIndex: 0 });
  },
}));

export default useCutsceneStore;
