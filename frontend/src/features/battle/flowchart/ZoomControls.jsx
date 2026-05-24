import { Panel, useReactFlow } from '@xyflow/react';
import useBattleStore from '../../../stores/battleStore';
import styles from './ZoomControls.module.css';

/**
 * 拡大状態のフローチャートをビューズーム（拡大／縮小）する +/− ボタン。
 *
 * `battleStore.isExpanded` が `true` のときだけ、フロー領域の右下に「+」「−」
 * の 2 ボタンを表示する（縮小状態はノード範囲を自動フィットさせる俯瞰モード
 * でユーザーズームの概念がないため `null` を返す）。トラックパッドのピンチ
 * ズーム（`FlowchartArea` の `zoomOnPinch={isExpanded}`）を**マウス操作でも
 * 行えるようにする補完 UI** で、本番環境でマウス利用を想定したカード
 * ドラッグ運用と両立させる狙い。
 *
 * `useReactFlow` の `zoomIn` / `zoomOut` を 150ms アニメーション付きで呼ぶ。
 * 拡縮ステップ（既定 1.2 倍）は `<ReactFlow>` の `minZoom` / `maxZoom`
 * （0.1〜5）にクランプされるため、端でこれ以上押しても破綻しない。`<Panel>`
 * を使うことで `<ReactFlow>` の子コンテキスト内に居ながらフロー領域基準の
 * 絶対配置（`bottom-right`）が得られ、右上の既存コントロール群（拡大トグル・
 * リセット・実行）と衝突しない。
 *
 * 名前が似ている `ZoomButton` は実体が「拡大／縮小トグル」（`isExpanded` を
 * 切り替える）で別物。本コンポーネントが実際のビューズーム +/− を担う。
 *
 * Returns:
 *     JSX.Element | null: 拡大状態なら +/− ボタンの `<Panel>`、それ以外は `null`。
 */
function ZoomControls() {
  const isExpanded = useBattleStore((s) => s.isExpanded);
  const { zoomIn, zoomOut } = useReactFlow();

  if (!isExpanded) return null;

  return (
    <Panel position="bottom-right" className={styles.panel}>
      <button
        type="button"
        className={styles.button}
        onClick={() => zoomIn({ duration: 150 })}
        aria-label="フローチャートをズームイン"
      >
        +
      </button>
      <button
        type="button"
        className={styles.button}
        onClick={() => zoomOut({ duration: 150 })}
        aria-label="フローチャートをズームアウト"
      >
        -
      </button>
    </Panel>
  );
}

export default ZoomControls;