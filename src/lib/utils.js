import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Tailwind-aware className combiner.
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Currency formatter driven by church settings.
export function formatCurrency(amount, settings) {
  const symbol = settings?.currency_symbol || '€';
  const locale = settings?.language || 'en';
  return `${symbol}${Number(amount || 0).toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
