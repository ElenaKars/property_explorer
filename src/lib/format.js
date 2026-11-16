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

/** "420 m" or "1.25 km" */
export function formatDistance(m) {
  return m >= 1000 ? `${twoDecimals.format(m / 1000)} km` : `${whole.format(m)} m`;
}
