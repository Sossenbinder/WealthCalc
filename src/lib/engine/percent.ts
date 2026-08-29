/** A percentage as the user types it: 7 means 7 %. */
export type Percent = number;

/** 7 -> 0.07 */
export function toDecimal(percent: Percent): number {
  return percent / 100;
}

/** 0.07 -> 7 */
export function fromDecimal(decimal: number): Percent {
  return decimal * 100;
}
