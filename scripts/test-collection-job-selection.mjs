import assert from "node:assert/strict";
import { selectBalancedCollectionJobs } from "../src/lib/collection-job-selection.ts";

const candidates = [
  { categoryKey: "food", id: "food-urgent", priority: 95 },
  { categoryKey: "life", id: "life-1", priority: 59 },
  { categoryKey: "life", id: "life-2", priority: 58 },
  { categoryKey: "digital", id: "digital-1", priority: 57 },
  { categoryKey: "food", id: "food-1", priority: 56 },
  { categoryKey: "digital", id: "digital-low", priority: 44 },
];

const selected = selectBalancedCollectionJobs(candidates, 4);
assert.deepEqual(
  selected.map(({ id }) => id),
  ["food-urgent", "life-1", "digital-1", "food-1"],
  "높은 우선순위를 먼저 처리하고 같은 구간에서는 카테고리를 순환해야 합니다.",
);

assert.deepEqual(selectBalancedCollectionJobs(candidates, 0), []);
console.log("balanced collection job selection tests passed");
