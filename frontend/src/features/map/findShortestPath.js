/**
 * 道のネットワーク（無向グラフ）上で、`start` から `goal` までの
 * エッジ数最小の経路を BFS で求める純関数。
 *
 * すべてのエッジを等しい重み 1 として扱うため、優先度付きキューを
 * 用いるダイクストラ法ではなく BFS で十分かつ正しい結果が得られる
 * （要件 4-3「経由するランドマーク数が最小になる経路」）。
 *
 * Args:
 *     adjacency (Map<string, string[]>): 隣接リスト。
 *         キーがノード ID、値が隣接ノード ID の配列。
 *     start (string): 始点ノード ID。
 *     goal (string): 終点ノード ID。
 *
 * Returns:
 *     string[] | null: 始点から終点までのノード ID の配列
 *         （`[start, ..., goal]`）。到達不可なら `null`。
 *         `start === goal` の場合は `[start]` を返す。
 */
function findShortestPath(adjacency, start, goal) {
  if (start === goal) {
    return [start];
  }

  const previous = new Map();
  previous.set(start, null);
  const queue = [start];

  while (queue.length > 0) {
    const node = queue.shift();
    if (node === goal) {
      break;
    }
    const neighbors = adjacency.get(node) ?? [];
    for (const neighbor of neighbors) {
      if (!previous.has(neighbor)) {
        previous.set(neighbor, node);
        queue.push(neighbor);
      }
    }
  }

  if (!previous.has(goal)) {
    return null;
  }

  const path = [];
  let cursor = goal;
  while (cursor !== null) {
    path.unshift(cursor);
    cursor = previous.get(cursor);
  }
  return path;
}

export default findShortestPath;
