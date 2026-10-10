import { useEffect, useRef, useState } from 'react';
import styles from './DragonShadowOverlay.module.css';

/*
 * 影の画像。上から見た「翼を広げたドラゴン」の黒いシルエット（頭は右向き、
 * 黒＋アルファの PNG）。4-4 のボススプライトとは別物の専用アセットで、
 * 正体（2-4 のゴールデンバード）を特定できない大まかな形にしてある。
 */
const SHADOW_SRC = '/sprites/effects/dragon_shadow.png';

/*
 * 影がマップを横切り終えて親へ完了を知らせるまでの時間（ms）。
 * DragonShadowOverlay.module.css の `dragonShadowFly`（2000ms）＋余韻 400ms。
 * CSS 側を変えたらここも合わせること。
 */
const SHADOW_TOTAL_MS = 2400;

/**
 * 画像 URL を `new Image()` でブラウザのキャッシュに載せる。
 *
 * 欠損画像があっても演出全体を止めないよう、エラー時も resolve する。
 *
 * Args:
 *     src (string): 画像の公開 URL。
 *
 * Returns:
 *     Promise<void>: ロード完了またはエラーで resolve する。
 */
function preloadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

/**
 * 「ドラゴンの影」がマップを左から右へ横切る演出（1-4 クリア後にマップへ
 * 戻った直後のカットシーン）。
 *
 * カットシーン `map-stage1-shadow` の `dragonShadow` step に進んだ間だけ、
 * 親（`MapScreen`）がマップの描画矩形（`.canvas`）を覆う層として条件付きで
 * マウントする。翼を広げたドラゴンのシルエット画像（`SHADOW_SRC`）を、
 * 翼をはばたかせる縦方向の伸縮アニメ付きでマップ左外から右外へ飛び去らせる。
 * 同時にマップ全体をうっすら暗くして「大きな何かが頭上を通り過ぎた」感じを
 * 出す。影の大きさはマップ矩形の高さに対する割合（CSS 側）で決め、画面
 * 中央の半分ほどを覆う。
 *
 * 影の画像はマップ画面では読み込まれていないため、マウント時に先読みして
 * から飛ばし始める（途中で画像が現れるチラつきを防ぐ）。読み込み完了から
 * `SHADOW_TOTAL_MS` 後に `onEnd` を 1 回だけ呼び、親はそれを受けてカット
 * シーンを次の吹き出し（「なんだ、今の影は！？」）へ進める。
 *
 * 演出中は `pointer-events: auto` の全面層として、下のランドマークや
 * ボタンの操作をブロックする（影を見せきる前に移動されないようにする）。
 *
 * Args:
 *     props (object): React プロパティ。
 *         onEnd (function): 演出完了時に呼ぶ関数（引数なし）。
 *
 * Returns:
 *     JSX.Element: 親の矩形全体を覆う演出層。
 */
function DragonShadowOverlay({ onEnd }) {
  const [isReady, setIsReady] = useState(false);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  /* 画像を先読みしてから飛ばし始める。アンマウント後の setState は抑止する。 */
  useEffect(() => {
    let cancelled = false;
    preloadImage(SHADOW_SRC).then(() => {
      if (!cancelled) {
        setIsReady(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /* 飛行アニメ開始から `SHADOW_TOTAL_MS` 後に完了を知らせる。 */
  useEffect(() => {
    if (!isReady) return undefined;
    const timerId = setTimeout(() => onEndRef.current?.(), SHADOW_TOTAL_MS);
    return () => clearTimeout(timerId);
  }, [isReady]);

  return (
    <div className={styles.overlay} aria-hidden="true">
      {isReady && (
        <>
          <div className={styles.veil} />
          <div className={styles.flight}>
            <div className={styles.flap}>
              <img className={styles.shadow} src={SHADOW_SRC} alt="" draggable={false} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default DragonShadowOverlay;
