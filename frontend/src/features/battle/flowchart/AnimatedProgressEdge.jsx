import { getStraightPath, getSmoothStepPath } from '@xyflow/react';
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
 * デフォルトのエッジ見た目は `.basePath` を常時付与して上書きする：
 * `stroke: #6a6a78`（プロジェクト共通の暗めグレー、空きスロット枠線と同色）と
 * `stroke-width: 2`（React Flow 既定の `1px` から倍）で、通過後の白いネオン光
 * （`.traversed`）とのコントラストをはっきり付ける。React Flow デフォルトの
 * 明るめグレー（`#b1b1b7`）だと細く明るすぎて、通過時の光の変化が認識しづらかった。
 * 矢印マーカー（`MarkerType.ArrowClosed`）の色は `FlowchartArea.edgesToFlowEdges`
 * 側で同じ `#6a6a78` を渡してデフォルト状態のエッジ／矢印の見た目を統一している。
 *
 * 通過済みエッジの可視化（`battle-fail-retry` 要件 1-1, 1-2, 1-5）：
 * `battleStore.traversedEdgeIds` を購読し、自身の `id` が含まれていれば
 * `<path>` の className 配列に CSS Modules の `.traversed` クラスを足す。
 * `react-flow__edge-path` クラス（React Flow がストローク幅・ヒット判定
 * 等で参照する基本クラス）と `.basePath`（デフォルトの太さ・色）は常に保持し、
 * 追加クラスとして `.traversed` を上乗せする形を取ることで、CSS の同特異性
 * ルールの順序勝ちで `.traversed` の `stroke` ／ `filter` がデフォルト値を上書き
 * する。`.traversed` は `stroke` を白系に、`filter: drop-shadow(...)` で淡い発光を
 * 加え、「実行が通った経路」が白いネオン光のように残るエフェクトを作る。
 * 通過軌跡は `initializeBattle` または `retryFromFail` が呼ばれるまで残り、
 * 失敗時にプレイヤーが「どの経路を通ったか」を振り返れる。
 *
 * 矢印マーカーの色追従：通過済み状態では矢印の三角部分も白（`#f5f5ff`）に
 * 変える必要があるが、React Flow が `markerEnd: { type: ArrowClosed, color }`
 * から自動生成する `<marker>` は `<defs>` 内の独立要素で、CSS class 経由では
 * 色が届かない。さらに別 `<svg>` に置いた `<defs>` への `marker-end="url(#id)"`
 * 参照は marker 仕様の都合でブラウザ実装が安定しない。これらを回避するため、
 * 本コンポーネント内で自前の白マーカー `<defs>` をエッジごとに同じ React Flow
 * SVG 内にレンダし、`isTraversed` のときだけ `markerEnd` を
 * `url(#arrow-traversed-${id})` に切り替える。マーカー ID はエッジ id を含めて
 * ユニーク化することで複数エッジ間の id 衝突を回避。マーカーパラメータ
 * （`viewBox="-10 -10 20 20"` ／ `markerWidth/Height="12.5"` ／ `refX/Y="0"` ／
 * `polyline points="-5,-4 0,0 -5,4 -5,-4"` ／ `orient="auto-start-reverse"` ／
 * `markerUnits="strokeWidth"`）は React Flow デフォルトの `ArrowClosed` と完全
 * 一致させ、デフォルト時（React Flow 自動生成のグレー）と通過時（自前の白）で
 * サイズ・位置・向きが揃うようにしている。`drop-shadow` の発光が矢印まで
 * 安定して伸びるかはブラウザ依存だが、色変化があれば「経路が通った」のフィード
 * バックとしては十分機能する。
 *
 * 緑の進行アイコン（`<circle>`）は `executionStep` が自身の id と一致する
 * 瞬間にのみマウントされる従来挙動を維持しており、`.traversed` の filter は
 * `<path>` 専用なので進行アイコンの描画には干渉しない。
 *
 * Args:
 *     props (object): React Flow のカスタムエッジに渡される props。
 *         id (string): エッジ ID（`stages.json` の `edges[].id` に一致）。
 *         sourceX (number): エッジ始点の x 座標。
 *         sourceY (number): エッジ始点の y 座標。
 *         targetX (number): エッジ終点の x 座標。
 *         targetY (number): エッジ終点の y 座標。
 *         markerEnd (object | string): 矢印マーカー指定(`MarkerType.ArrowClosed`)。
 *
 * Returns:
 *     JSX.Element: SVG `<path>` ＋ 実行中の `<circle>` を含むフラグメント。
 */
function AnimatedProgressEdge({ 
    id, 
    sourceX, sourceY, targetX, targetY, 
    sourcePosition, targetPosition,
    sourceHandleId, targetHandleId,
    markerEnd, 
}) {
    const shouldUseStep = sourceHandleId === 'false' || targetHandleId === 'bottom';
    const [edgePath] = shouldUseStep 
        ? getSmoothStepPath({ 
            sourceX, sourceY, sourcePosition,
            targetX, targetY, targetPosition,
            borderRadius: 5,
        })
        : getStraightPath({ sourceX, sourceY, targetX, targetY });

    const isActive = useBattleStore(
        (s) => s.executionStep?.type === 'edge' && s.executionStep?.id === id,
    );
    const phaseMs = useBattleStore((s) => s.currentPhaseMs ?? 666);
    const isTraversed = useBattleStore((s) => s.traversedEdgeIds.includes(id));

    const pathClassName = [
        'react-flow__edge-path',
        styles.basePath,
        isTraversed && styles.traversed,
    ]
        .filter(Boolean)
        .join(' ');

    const traversedMarkerId = `arrow-traversed-${id}`;

    return (
        <>
            <defs>                                                            
                <marker                                                       
                    id={traversedMarkerId}
                    className="react-flow__arrowhead"                         
                    markerWidth="12.5"
                    markerHeight="12.5"
                    viewBox="-10 -10 20 20"                                   
                    markerUnits="strokeWidth"
                    orient="auto-start-reverse"                               
                    refX="0"
                    refY="0"                                                  
                >
                    <polyline                                                 
                        style={{ stroke: '#f5f5ff', fill: '#f5f5ff' }}
                        strokeLinecap="round"
                        strokeLinejoin="round"                                
                        points="-5,-4 0,0 -5,4 -5,-4"
                    />                                                        
                </marker>
              </defs>
            <path
                id={id}
                className={pathClassName}
                d={edgePath}
                markerEnd={isTraversed ? `url(#${traversedMarkerId})` : markerEnd}
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