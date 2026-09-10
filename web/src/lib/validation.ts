export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new Error(`Invalid ${field}.`);
}

export function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function requireText(value: unknown, field: string, max = 200): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${field}.`);
}

export function requireOptionalText(value: unknown, field: string, max = 200): void {
  if (value === undefined || value === null || value === "") return;
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${field}.`);
}

export function requireOneOf<T extends string>(value: unknown, field: string, allowed: readonly T[]): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`Invalid ${field}.`);
}

export function requireMoney(value: unknown, field: string, allowZero = false): asserts value is string {
  if (typeof value !== "string" || !/^\d{1,10}(\.\d{1,2})?$/.test(value) || (!allowZero && Number(value) === 0)) {
    throw new Error(`Invalid ${field}: use a ${allowZero ? "non-negative" : "positive"} amount with at most two decimal places.`);
  }
}
