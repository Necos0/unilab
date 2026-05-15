import { useEffect, useState } from 'react';

/**
 * スプライトアニメーションのフレーム進行を管理するカスタムフック。
 *
 * `setInterval` により `frameDurationMs` ごとに現在フレーム index を
 * インクリメントする。`loop` が true のときは最終フレームから先頭へ
 * 戻り、false のときは最終フレームで停止する。設定（`frameCount` /
 * `frameDurationMs` / `loop`）が変わった場合は、先頭フレームに戻して
 * タイマーを張り直す。先頭へのリセットはレンダーフェーズで行う
 * React 公式の "reset state when props change" パターンで、
 * `useEffect` 内で setState を呼ぶことによる連鎖レンダーを避ける。
 * アンマウント時および再実行時は `clearInterval` で後始末を行う。
 *
 * Args:
 *     config (object): アニメーション設定。
 *         frameCount (number): 総フレーム数（1 以上）。
 *         frameDurationMs (number): 1 フレームの表示時間(ms)。
 *         loop (boolean): ループ再生するか。
 *
 * Returns:
 *     object: `{ frameIndex: number }`。現在表示すべきフレーム index。
 */
export function useSpriteAnimation({ frameCount, frameDurationMs, loop }) {
  const [frameIndex, setFrameIndex] = useState(0);
  const [prevConfig, setPrevConfig] = useState({ frameCount, frameDurationMs, loop });

  if (
    prevConfig.frameCount !== frameCount ||
    prevConfig.frameDurationMs !== frameDurationMs ||
    prevConfig.loop !== loop
  ) {
    setPrevConfig({ frameCount, frameDurationMs, loop });
    setFrameIndex(0);
  }

  useEffect(() => {
    if (frameCount <= 1) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      setFrameIndex((prev) => {
        const next = prev + 1;
        if (next >= frameCount) {
          return loop ? 0 : frameCount - 1;
        }
        return next;
      });
    }, frameDurationMs);

    return () => clearInterval(intervalId);
  }, [frameCount, frameDurationMs, loop]);

  return { frameIndex };
}
