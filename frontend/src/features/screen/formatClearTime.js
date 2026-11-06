/**
 * 開始からクリアまでの経過時間を「分:秒」（1 時間以上は「時:分:秒」）に整える。
 *
 * Args:
 *     startedAt (string): 開始時刻（ISO 8601）。
 *     clearedAt (string): クリア時刻（ISO 8601）。
 *
 * Returns:
 *     string: `12:34` や `1:02:03` の形の文字列。時刻が不正なら `--:--`。
 */
function formatClearTime(startedAt, clearedAt) {
  const elapsedMs = new Date(clearedAt) - new Date(startedAt);
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return '--:--';
  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value) => String(value).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

export default formatClearTime;
