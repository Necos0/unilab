import { useCallback, useEffect, useRef, useState } from 'react';

/*
 * この時間（ミリ秒）より前のクリアは、あとから一覧に入ってきてもお祝い
 * しない。回線が長く切れていて、つながり直したときにまとめて届いた
 * 古いクリアで演出が続かないようにするため。
 */
const CELEBRATE_WITHIN_MS = 10 * 60 * 1000;

/**
 * 新しくクリアした人を「お祝い待ちの列」に並べるカスタムフック。
 *
 * 最初の取得（`isLoaded` が true になった時点）で一覧にいた人は
 * 「もう知っている人」として覚えるだけで、お祝いしない。そのあと一覧に
 * 増えた人のうち、クリアして `CELEBRATE_WITHIN_MS` 以内の人を列の
 * 最後に足す。同時に何人もクリアしたときは、1 人ずつ順番にお祝いする。
 *
 * Args:
 *     clears (Array<{id: string, nickname: string, started_at: string,
 *         cleared_at: string}>): 今日クリアした人の一覧。
 *     isLoaded (boolean): 最初の取得が終わったか。
 *
 * Returns:
 *     {current: ({id: string, nickname: string, started_at: string,
 *         cleared_at: string} | null),
 *      enqueue: function, dequeue: function}: いまお祝いしている人
 *         （いなければ null）、列に 1 人足す関数（テスト表示用）、
 *         いまの人のお祝いを終えて次へ進める関数。
 */
function useClearCelebrationQueue(clears, isLoaded) {
  const seenIdsRef = useRef(null);
  const [queue, setQueue] = useState([]);

  useEffect(() => {
    if (!isLoaded) return;
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(clears.map((clear) => clear.id));
      return;
    }
    const seenIds = seenIdsRef.current;
    const newClears = clears.filter((clear) => !seenIds.has(clear.id));
    if (newClears.length === 0) return;
    newClears.forEach((clear) => seenIds.add(clear.id));
    const now = Date.now();
    const recentClears = newClears.filter(
      (clear) => now - new Date(clear.cleared_at).getTime() <= CELEBRATE_WITHIN_MS,
    );
    if (recentClears.length === 0) return;
    setQueue((prev) => [...prev, ...recentClears]);
  }, [clears, isLoaded]);

  const enqueue = useCallback((clear) => {
    setQueue((prev) => [...prev, clear]);
  }, []);

  const dequeue = useCallback(() => {
    setQueue((prev) => prev.slice(1));
  }, []);

  return { current: queue[0] ?? null, enqueue, dequeue };
}

export default useClearCelebrationQueue;
