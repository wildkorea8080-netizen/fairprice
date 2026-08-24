type CollectionCandidate = {
  categoryKey: string;
  priority: number;
};

export function selectBalancedCollectionJobs<T extends CollectionCandidate>(
  candidates: T[],
  limit: number,
) {
  if (limit <= 0) return [];

  const priorityBands = new Map<number, Map<string, T[]>>();

  for (const candidate of candidates) {
    const band = Math.floor(candidate.priority / 10);
    const categoryQueues = priorityBands.get(band) ?? new Map<string, T[]>();
    const queue = categoryQueues.get(candidate.categoryKey) ?? [];
    queue.push(candidate);
    categoryQueues.set(candidate.categoryKey, queue);
    priorityBands.set(band, categoryQueues);
  }

  const selected: T[] = [];
  const sortedBands = [...priorityBands.keys()].sort((left, right) => right - left);

  for (const band of sortedBands) {
    const queues = [...(priorityBands.get(band)?.values() ?? [])];
    let round = 0;

    while (selected.length < limit && queues.some((queue) => round < queue.length)) {
      for (const queue of queues) {
        const candidate = queue[round];
        if (candidate) selected.push(candidate);
        if (selected.length === limit) return selected;
      }
      round += 1;
    }
  }

  return selected;
}
