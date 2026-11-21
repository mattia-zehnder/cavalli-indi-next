// Who wins race N is decided by the race number alone (everything else about
// the race – overtakes, margins, photo finishes – is still random).
//
//   1. x = 3·N² + 7·N + 707
//   2. s = sum of the digits of x
//   3. winner = (s mod 5) + 1        ← saddle number
//
// Example, race 4: 3·16 + 28 + 707 = 783 → 7+8+3 = 18 → 18 mod 5 = 3 → n° 4.
//
// Chosen because over many races every number wins ~20% of the time, the same
// number repeats back-to-back about 1 time in 5 (like real luck), and the first
// races of the night show no visible pattern.

const digitSum = (x: number) =>
  String(Math.abs(Math.trunc(x)))
    .split("")
    .reduce((a, d) => a + Number(d), 0);

/** Saddle number (1..5) of the winner of race `race`. */
export function winnerNumber(race: number): number {
  const n = Math.max(1, Math.trunc(race));
  return (digitSum(3 * n * n + 7 * n + 707) % 5) + 1;
}
