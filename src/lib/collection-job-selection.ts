type CollectionCandidate = {
  categoryKey: string;
  createdAt?: Date;
  priority: number;
};

const MAX_AGING_BOOST = 30;

export function getEffectiveCollectionPriority(
  candidate: CollectionCandidate,
  now = new Date(),
) {
  if (!candidate.createdAt) return candidate.priority;
  const waitingHours = Math.max(
    0,
    Math.floor((now.getTime() - candidate.createdAt.getTime()) / 3_600_000),
  );
  return Math.min(candidate.priority + Math.min(waitingHours, MAX_AGING_BOOST), 100);
}

export function selectBalancedCollectionJobs<T extends CollectionCandidate>(
  candidates: T[],
  limit: number,
  now = new Date(),
) {
  if (limit <= 0) return [];

  const priorityBands = new Map<number, Map<string, T[]>>();

  for (const candidate of candidates) {
    const band = Math.floor(getEffectiveCollectionPriority(candidate, now) / 10);
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
