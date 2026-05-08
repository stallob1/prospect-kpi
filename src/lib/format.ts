export function formatCents(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function formatCentsOptional(cents: number | null | undefined, currency = "USD") {
  if (cents == null || Number.isNaN(cents)) return "—";
  return formatCents(cents, currency);
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

export function formatNumberOptional(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return formatNumber(n);
}

export function formatPercent(rate: number | null | undefined, digits = 1) {
  if (rate == null || Number.isNaN(rate)) return "—";
  return `${(rate * 100).toFixed(digits)}%`;
}
