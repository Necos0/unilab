import { useEffect, useState } from 'react';
import {
  fetchTodayClears,
  getTodayStart,
  subscribeClears,
} from '../services/clearRecordApi.js';

/*
 * 念のための定期再取得の間隔（ミリ秒）。Realtime の取りこぼしと、
 * 日付が変わったときの「今日」のリセットをこれで拾う。
 */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * 今日クリアしたプレイヤーの一覧を、リアルタイムに追いかけるフック。
 *
 * マウント時に一覧を取得し、以降は Realtime でクリアを受け取って末尾へ
 * 足す。購読が（再）接続したときと一定間隔ごとにも取り直し、切断中の
 * 取りこぼしや日付の切り替わりを反映する。
 *
 * Returns:
 *     {clears: Array<{id: string, nickname: string, started_at: string,
 *         cleared_at: string}>,
 *      hasError: boolean}: クリアの早い順の一覧と、取得に失敗しているか。
 */
function useTodayClears() {
  const [clears, setClears] = useState([]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isActive = true;

    const refresh = async () => {
      try {
        const rows = await fetchTodayClears();
        if (!isActive) return;
        setClears(rows);
        setHasError(false);
      } catch (error) {
        console.error('[clearScreen] fetch failed', error);
        if (isActive) setHasError(true);
      }
    };

    const handleClear = (row) => {
      if (new Date(row.cleared_at) < getTodayStart()) return;
      setClears((prev) =>
        prev.some((item) => item.id === row.id)
          ? prev
          : [
              ...prev,
              {
                id: row.id,
                nickname: row.nickname,
                started_at: row.started_at,
                cleared_at: row.cleared_at,
              },
            ],
      );
    };

    const handleStatus = (status) => {
      if (status === 'SUBSCRIBED') refresh();
    };

    refresh();
    const unsubscribe = subscribeClears(handleClear, handleStatus);
    const timerId = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      isActive = false;
      unsubscribe();
      clearInterval(timerId);
    };
  }, []);

  return { clears, hasError };
}

export default useTodayClears;
