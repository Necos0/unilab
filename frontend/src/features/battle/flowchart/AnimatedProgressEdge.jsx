import { getStraightPath } from '@xyflow/react';
import useBattleStore from '../../../stores/battleStore';
import styles from './AnimatedProgressEdge.module.css';

/**
 * 実行中にエッジ上を緑の光の点が走るカスタムエッジコンポーネント。
 *
 * React Flow の `edgeTypes` に `'animated-progress'` として登録され、
 * `FlowchartArea` の `edgesToFlowEdges` が全エッジに `type: 'animated-progress'`
 * を付与することで本コンポーネントが描画される。通常時は標準のエッジ
 * （`react-flow__edge-path` クラスで React Flow デフォルトの見た目）として
 * 表示され、`battleStore.executionStep` が自身のエッジ ID と一致したときだけ
 * SVG `<circle>` を追加レンダリングし、CSS Motion Path（`offset-path` /
 * `offset-distance`）で `getStraightPath` が返したパスに沿って円を始点から
 * 終点まで移動させる（play-button 要件 5-2, 5-4）。
 *
 * フェーズ時間 `currentPhaseMs` をストアから受け取り、inline style の
 * `animationDuration` に渡すことで「フェーズ時間ぴったりで点が始点から
 * 終点まで進む」を実現する。アニメーション自体は CSS で `0% → 100%` の
 * `offset-distance` 変化として定義され、`isActive` が `false` になると
 * `<circle>` ごと unmount されるため見えなくなる。
 *
 * 当初は SVG SMIL の `<animateMotion>` を使う想定だったが、React の
 * 再描画ライフサイクルとの相性問題で「点が動かず終点に張り付いて見える」
 * 不具合が出たため、CSS Motion Path に切り替えた。CSS animation のほうが
 * React のツリー再構成に対してロバストで、ブラウザ間の挙動も安定している。
 *
 * Args:
 *     props (object): React Flow のカスタムエッジに渡される props。
 *         id (string): エッジ ID（`stages.json` の `edges[].id` に一致）。
 *         sourceX (number): エッジ始点の x 座標。
 *         sourceY (number): エッジ始点の y 座標。
 *         targetX (number): エッジ終点の x 座標。
 *         targetY (number): エッジ終点の y 座標。
 *         markerEnd (object | string): 矢印マーカー指定（`MarkerType.ArrowClosed`）。
 *
 * Returns:
 *     JSX.Element: SVG `<path>` ＋ 実行中の `<circle>` を含むフラグメント。
 */
function AnimatedProgressEdge({ id, sourceX, sourceY, targetX, targetY, markerEnd, }) {
    const [edgePath] = getStraightPath({ sourceX, sourceY, targetX, targetY });

    const isActive = useBattleStore(
        (s) => s.executionStep?.type === 'edge' && s.executionStep?.id === id,
    );
    const phaseMs = useBattleStore((s) => s.currentPhaseMs ?? 666);

    return (
        <>
            <path
                id={id}
                className="react-flow__edge-path"
                d={edgePath}
                markerEnd={markerEnd}
            />
            {isActive && (
                <circle
                    r="4"
                    fill="#66dd6e"
                    className={styles.dot}
                    style={{
                        offsetPath: `path('${edgePath}')`,
                        animationDuration: `${phaseMs}ms`,
                    }}
                />
            )}
        </>
    );
}

export default AnimatedProgressEdge;