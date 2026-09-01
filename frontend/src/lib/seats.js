/** Fishbone clusters — keep in sync with backend/policy.py */
export const SEAT_CLUSTERS = [
  [1, 2, 3, 4, 5, 6],
  [7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18],
  [19, 20, 21, 22, 23],
  [24, 25, 26, 27, 28, 29],
  [30, 31, 32, 33, 34, 35],
  [36, 37, 38, 39, 40],
  [41, 42, 43, 44, 45],
  [46, 47, 48, 49, 50],
  [51, 52, 53, 54, 55],
];

export function clusterOf(id) {
  if (id <= 6) return 1;
  if (id <= 12) return 2;
  if (id <= 18) return 3;
  if (id <= 23) return 4;
  if (id <= 29) return 5;
  if (id <= 35) return 6;
  if (id <= 40) return 10;
  if (id <= 45) return 9;
  if (id <= 50) return 8;
  return 7;
}

export function clusterSeatIds(id) {
  return SEAT_CLUSTERS.find((c) => c.includes(id)) || [];
}

export function findConsecutiveBlock(clusterSeatIds, clickedId, count, isAllowed = () => true) {
  if (count < 1) return null;
  const ids = [...clusterSeatIds].filter(isAllowed).sort((a, b) => a - b);
  const windows = [];
  for (let i = 0; i <= ids.length - count; i += 1) {
    const window = ids.slice(i, i + count);
    if (window[window.length - 1] - window[0] !== count - 1) continue;
    if (window.includes(clickedId)) windows.push(window);
  }
  return windows.find((w) => w[0] === clickedId) || windows[0] || null;
}
