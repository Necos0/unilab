import { useEffect, useRef, useState } from 'react';
import styles from './WorldUnlockCutscene.module.css';
import useMapStore from '../../stores/mapStore';
import useProgressStore, {
  UNLOCK_FADE_DURATION_MS,
} from '../../stores/progressStore';
import mapsData from '../../data/maps.json';

const OVERWORLD_MAP_ID = 'map_0';

/* 黒フェードの片道時間。`MapSwitchTransition` と揃える。 */
const FADE_MS = 300;

/*
 * 開放アニメを見せきってから暗転に入るまでの余韻。南京錠破壊
 * （`UNLOCK_FADE_DURATION_MS`）が終わって「解放済みの巻物」を一拍見せる。
 */
const POST_HOLD_MS = 500;

/*
 * 各フェーズに割り当てる黒オーバーレイのクラス。`coverIn` / `coverOut` で
 * 黒く覆い、`revealOverworld` / `revealOriginal` で透明に戻す。`hold` の間は
 * 透明のまま開放アニメを見せる。
 */
const PHASE_CLASS = {
  coverIn: 'fadeIn',
  revealOverworld: 'fadeOut',
  hold: 'transparent',
  coverOut: 'fadeIn',
  revealOriginal: 'fadeOut',
};

/**
 * ワールドの最終ステージ（1-4 / 2-4 / 3-4）クリア後に自動再生される、
 * 次ワールド解放のカットシーン。
 *
 * 「暗転 → 全体マップ → 次ワールド領域の開放アニメ → 暗転 → 今いるステージ
 * へ戻る」を、ロボの吹き出し無しで全自動に進行させる。画面全体を覆う黒
 * オーバーレイを `setTimeout` のフェーズ列で開閉し、暗転中に裏側で
 * `mapStore.switchMap` によりマップを差し替えることで、唐突な切替を隠す。
 *
 * フェーズ進行（括弧内は累積時間の目安）:
 *   1. `coverIn`        : 黒く暗転（0〜300ms）
 *   2. `revealOverworld`: 全体マップ（`map_0`）へ切替えて暗転を晴らす（〜600ms）
 *   3. `hold`           : `startWorldUnlockAnimation` で該当領域の南京錠破壊を
 *                          発火し、アニメ＋余韻を見せる（〜600ms+1500ms+500ms）
 *   4. `coverOut`       : `commitWorldUnlock` で解放を確定し再び暗転
 *   5. `revealOriginal` : 開始時のマップ（今いる領域）へ戻して暗転を晴らす
 *   6. 完了             : `onEnd` を呼ぶ（親が `pendingWorldUnlock` を消す）
 *
 * 戻り先マップ（「今いるステージ」）と勇者の立ち位置は、マウント時点の
 * `currentMapId` / `currentLocation` を `returnMapIdRef` / `returnLocationRef`
 * に退避して使う。クリア直後はプレイ中の領域マップ・撃破したステージの
 * ランドマークのままなので、その場所へ戻す（`switchMap` の既定挙動＝入り口
 * への再配置を上書きする）。黒オーバーレイは終始 `pointer-events: auto` で
 * 操作をブロックする。
 *
 * 解放対象ワールドはストアの `pendingWorldUnlock` を `startWorldUnlockAnimation`
 * が参照するため、本コンポーネントは番号を prop で受け取らない。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onEnd (function): カットシーン完了時に呼ぶ関数（引数なし）。
 *
 * Returns:
 *     JSX.Element: 黒フェード用オーバーレイ要素。
 */
function WorldUnlockCutscene({ onEnd }) {
  const [phase, setPhase] = useState('coverIn');
  const onEndRef = useRef(onEnd);
  const returnMapIdRef = useRef(useMapStore.getState().currentMapId);
  const returnLocationRef = useRef(useMapStore.getState().currentLocation);

  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    let cancelled = false;
    const timers = [];
    const wait = (ms, fn) => {
      timers.push(setTimeout(() => {
        if (!cancelled) {
          fn();
        }
      }, ms));
    };

    const {
      startWorldUnlockAnimation,
      commitWorldUnlock,
    } = useProgressStore.getState();
    const { switchMap } = useMapStore.getState();

    // 1. 暗転完了 → 全体マップへ切替えて暗転を晴らす。
    wait(FADE_MS, () => {
      switchMap(OVERWORLD_MAP_ID, mapsData.maps[OVERWORLD_MAP_ID]);
      setPhase('revealOverworld');

      // 2. 全体マップ表示完了 → 開放アニメ発火。アニメ＋余韻を待つ。
      wait(FADE_MS, () => {
        startWorldUnlockAnimation();
        setPhase('hold');

        // 3. アニメ完了 → 解放確定して再び暗転。
        wait(UNLOCK_FADE_DURATION_MS + POST_HOLD_MS, () => {
          commitWorldUnlock();
          setPhase('coverOut');

          // 4. 暗転完了 → 元のマップへ戻して暗転を晴らす。
          wait(FADE_MS, () => {
            switchMap(
              returnMapIdRef.current,
              mapsData.maps[returnMapIdRef.current],
              returnLocationRef.current,
            );
            setPhase('revealOriginal');

            // 5. 復帰完了 → カットシーン終了。
            wait(FADE_MS, () => {
              onEndRef.current?.();
            });
          });
        });
      });
    });

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  const className = [styles.overlay, styles[PHASE_CLASS[phase]]].join(' ');
  return <div className={className} aria-hidden="true" />;
}

export default WorldUnlockCutscene;
