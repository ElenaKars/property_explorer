const LOCALE = 'en-GB';

const whole = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const twoDecimals = new Intl.NumberFormat(LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const upToTwoDecimals = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 });

/** "8,450 m²", "12,300 m² (1.23 ha)" or "4.73 km²" */
export function formatArea(m2) {
  if (m2 >= 1_000_000) return `${upToTwoDecimals.format(m2 / 1_000_000)} km²`;
  const base = `${whole.format(m2)} m²`;
  return m2 >= 10_000 ? `${base} (${upToTwoDecimals.format(m2 / 10_000)} ha)` : base;
}

const dateTime = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

/** ISO timestamp -> "16 Nov 2026, 10:50 UTC" (null for missing/invalid input). */
export function formatTimestamp(iso) {
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return `${dateTime.format(date)} UTC`;
}

const percent = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 });

/** 0.3421 -> "34.2%" */
export function formatPercent(ratio) {
  return percent.format(ratio);
}

/** "1 building" / "12 buildings" */
export function formatCount(n, singular, plural = `${singular}s`) {
  return `${whole.format(n)} ${n === 1 ? singular : plural}`;
}

/** "420 m" or "1.25 km" */
export function formatDistance(m) {
  return m >= 1000 ? `${twoDecimals.format(m / 1000)} km` : `${whole.format(m)} m`;
}
