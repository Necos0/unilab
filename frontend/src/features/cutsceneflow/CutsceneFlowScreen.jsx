import { useMemo } from 'react';
import buildCutsceneFlow, {
  STAGE_TIMINGS,
  MAP_ENTER_TIMING,
} from './buildCutsceneFlow.js';
import styles from './CutsceneFlowScreen.module.css';

/**
 * 「漢字《よみ》」記法のルビ注記を取り除いて素のテキストに戻す。
 *
 * カットシーンのセリフはプレイヤー向けにふりがなを `《》` で持つが、
 * 開発用ビューでは一覧性を優先して注記を落とす（例: `行《い》く` → `行く`）。
 *
 * Args:
 *     text (string): ルビ注記を含みうるセリフ。
 *
 * Returns:
 *     string: `《...》` を除去したテキスト。
 */
function stripRuby(text) {
  return (text ?? '').replace(/《[^》]*》/g, '');
}

/**
 * カットシーン 1 件のステップ列を読みやすい文字列に整形する。
 *
 * `bubble` ステップはルビを外したセリフ、`playAnimation` ステップは
 * `🎬 アニメ名(パラメータ)` の形にして配列で返す。ビュー側はこれを
 * 番号付きで縦に並べる。
 *
 * Args:
 *     steps (Array<object>): カットシーン定義の `steps`。
 *
 * Returns:
 *     Array<{kind: 'bubble'|'anim', text: string, point: ?string}>:
 *         整形済みステップ。
 */
function formatSteps(steps) {
  return (steps ?? []).map((step) => {
    if (step.playAnimation) {
      const params = step.params ? `（${Object.entries(step.params)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')}）` : '';
      return { kind: 'anim', text: `🎬 ${step.playAnimation}${params}`, point: null };
    }
    return { kind: 'bubble', text: stripRuby(step.bubble), point: step.point ?? null };
  });
}

/**
 * カットシーン 1 件分の中身（ID・解放バッジ・ステップ一覧）を描くカード。
 *
 * Args:
 *     props (object): React プロパティ。
 *         cutscene (object): `buildCutsceneFlow` が割り当てたカットシーン定義
 *             （`id` / `steps` / `isWorldUnlock` を含む）。
 *
 * Returns:
 *     JSX.Element: カットシーンの詳細カード。
 */
function CutsceneCard({ cutscene }) {
  const steps = formatSteps(cutscene.steps);
  return (
    <div className={styles.cutsceneCard}>
      <div className={styles.cutsceneId}>
        <span className={styles.idTag}>{cutscene.id}</span>
        {cutscene.category && (
          <span className={styles.categoryTag}>{cutscene.category}</span>
        )}
        {cutscene.isWorldUnlock && (
          <span className={styles.unlockTag}>ワールド解放アニメ</span>
        )}
      </div>
      <ol className={styles.steps}>
        {steps.map((step, i) => (
          <li
            key={i}
            className={step.kind === 'anim' ? styles.animStep : styles.bubbleStep}
          >
            <span className={styles.stepText}>{step.text}</span>
            {step.point && <span className={styles.pointTag}>→ {step.point}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * 差し込み口（タイミング）1 行を描く。カットシーンが付いていれば強調表示し、
 * 無ければ淡色で「カットシーンなし」と示す。
 *
 * Args:
 *     props (object): React プロパティ。
 *         timing ({label, desc}): タイミング定義。
 *         cutscene (?object): 割り当てられたカットシーン。無ければ `null`。
 *
 * Returns:
 *     JSX.Element: タイミング 1 行。
 */
function TimingRow({ timing, cutscene }) {
  return (
    <li className={cutscene ? styles.timingActive : styles.timingEmpty}>
      <div className={styles.timingHead}>
        <span className={styles.dot} aria-hidden="true" />
        <span className={styles.timingLabel}>{timing.label}</span>
        <span className={styles.timingDesc}>{timing.desc}</span>
      </div>
      {cutscene ? (
        <CutsceneCard cutscene={cutscene} />
      ) : (
        <div className={styles.noCutscene}>カットシーンなし</div>
      )}
    </li>
  );
}

/**
 * 開発者向けのカットシーン・フロー画面。
 *
 * `cutscenes.json` と `stages.json` を突き合わせ、「どのタイミングで
 * どのカットシーンが表示されるか」を時系列フローチャートとして縦に並べて
 * 見せる。並びは「ワールドのマップ入場 → 各ステージ（到着・バトル開始・
 * 敗北・撃破・退出）」の順で、上から下へ進むほどゲーム内で後に起きる。
 * カットシーンが割り当たっているタイミングは色付きカードで強調し、無い
 * タイミングは淡色で「カットシーンなし」と示すことで、空き枠（今後追加
 * できる場所）も一目で分かる。
 *
 * この画面はゲーム本編ではなく開発確認用。`App` のグローバル `C` キーで
 * 開き、「戻る」ボタン（`onExit`）で元の画面へ戻る。プレイヤーには見せない
 * ため UI 文言にふりがなは振らない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onExit (function): 「戻る」ボタン押下時に呼ぶ関数（引数なし）。
 *
 * Returns:
 *     JSX.Element: カットシーン・フロー画面全体を表す `<section>` 要素。
 */
function CutsceneFlowScreen({ onExit }) {
  const flow = useMemo(() => buildCutsceneFlow(), []);
  const totalCutscenes = useMemo(
    () =>
      flow.reduce(
        (sum, world) =>
          sum +
          (world.mapEnter ? 1 : 0) +
          world.stages.reduce(
            (acc, stage) => acc + stage.timings.filter((t) => t.cutscene).length,
            0,
          ),
        0,
      ),
    [flow],
  );

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerText}>
          <h1 className={styles.title}>カットシーン フロー（開発用）</h1>
          <p className={styles.subtitle}>
            上から下が時系列。色付きの枠にカットシーンが入る（全 {totalCutscenes} 件）。
          </p>
        </div>
        <button type="button" className={styles.exitButton} onClick={onExit}>
          戻る（C で開閉）
        </button>
      </header>

      <div className={styles.scroll}>
        <div className={styles.startNode}>ゲーム開始</div>
        {flow.map((world) => (
          <div key={world.world} className={styles.world}>
            <div className={styles.connector} aria-hidden="true" />
            <div className={styles.worldHeader}>ワールド {world.world}</div>

            <ul className={styles.timings}>
              <TimingRow timing={MAP_ENTER_TIMING} cutscene={world.mapEnter} />
            </ul>

            {world.stages.map((stage) => (
              <div key={stage.stageId} className={styles.stageCard}>
                <div className={styles.connector} aria-hidden="true" />
                <div className={styles.stageHeader}>
                  <span className={styles.stageId}>{stage.stageId}</span>
                  {stage.enemyId && (
                    <span className={styles.enemyTag}>敵: {stage.enemyId}</span>
                  )}
                </div>
                <ul className={styles.timings}>
                  {stage.timings.map(({ timing, cutscene }) => (
                    <TimingRow key={timing.type} timing={timing} cutscene={cutscene} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
        <div className={styles.connector} aria-hidden="true" />
        <div className={styles.endNode}>おわり</div>
      </div>
    </section>
  );
}

export default CutsceneFlowScreen;
