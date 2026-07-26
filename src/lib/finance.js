// Finance date + aggregation helpers — shared by the Dashboard and Financial Reports.
// Pure functions only (no React, no I/O) so they are trivial to reason about and test.

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

// Today's date as a LOCAL "YYYY-MM-DD" string (avoids the UTC-shift of
// new Date().toISOString() near midnight in positive-offset timezones).
export function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// A currency formatter safe for jsPDF's core (Latin-1 only) fonts. If the
// church's currency symbol has any character outside Latin-1 (e.g. the cedi ₵
// or naira ₦), fall back to the ISO code ("GHS 100.00") so the PDF renders
// correctly; otherwise keep the symbol ("€100.00").
export function makePdfMoneyFormatter(settings) {
  const symbol = settings?.currency_symbol || "€";
  const code = settings?.currency_code || "";
  const locale = settings?.language || "en";
  const latin1Safe = /^[\x00-\xFF]*$/.test(symbol);
  const prefix = latin1Safe ? symbol : (code ? code + " " : "");
  return (n) => `${prefix}${Number(n || 0).toLocaleString(locale, { minimumFractionDigits: 2 })}`;
}

// Parse a stored date string ("YYYY-MM-DD" or a full ISO string) into a
// LOCAL-midnight Date. `new Date("2026-07-15")` parses as UTC midnight, which
// rolls back a day in negative timezones and would drop records into the wrong
// week; parsing the parts by hand keeps the calendar date intact.
export function parseLocalDate(str) {
  if (!str) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(str));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// True when `str`'s calendar date falls in the given month (0-based) and year.
export function isInMonth(str, monthIdx, year) {
  const d = parseLocalDate(str);
  return !!d && d.getMonth() === monthIdx && d.getFullYear() === year;
}

// True when `str`'s calendar date falls within [fromStr, toStr] inclusive
// (both "YYYY-MM-DD"). Same local-midnight parsing as isInMonth, so a record
// never shifts across the range boundary in negative timezones.
export function isInRange(str, fromStr, toStr) {
  const d = parseLocalDate(str);
  const from = parseLocalDate(fromStr);
  const to = parseLocalDate(toStr);
  return !!d && !!from && !!to && d >= from && d <= to;
}

// First day of the current month as a local "YYYY-MM-DD" string.
export function firstOfMonthLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

// Sun–Sat calendar weeks that overlap the month, each clamped to the month so
// the weekly rows always sum exactly to the monthly total. The first and last
// rows may be partial weeks. Returns [{ index, start, end, label }] where label
// is e.g. "Jul 1–4" (or "Jul 6" for a single-day trailing week).
export function getMonthWeeks(year, monthIdx) {
  const lastDay = new Date(year, monthIdx + 1, 0).getDate();
  const weeks = [];
  let dayNum = 1;
  let index = 1;
  while (dayNum <= lastDay) {
    const start = new Date(year, monthIdx, dayNum);
    const daysUntilSat = 6 - start.getDay(); // 0=Sun … 6=Sat
    const endDay = Math.min(dayNum + daysUntilSat, lastDay);
    weeks.push({
      index,
      start,
      end: new Date(year, monthIdx, endDay),
      label: `${MONTHS_SHORT[monthIdx]} ${dayNum}${endDay !== dayNum ? `–${endDay}` : ""}`,
    });
    dayNum = endDay + 1;
    index += 1;
  }
  return weeks;
}

// Sum the `amount` of records whose date lands within [start, end] inclusive.
function sumInRange(records, start, end) {
  return records.reduce((total, r) => {
    const d = parseLocalDate(r.date);
    if (d && d >= start && d <= end) return total + (Number(r.amount) || 0);
    return total;
  }, 0);
}

// Weekly breakdown for a set of records within a month.
// Returns { total, weeks: [{ index, label, amount }] }. Because the weeks
// partition the month exactly, `total` equals the strict calendar-month total.
export function weeklyBreakdown(records, year, monthIdx) {
  const weeks = getMonthWeeks(year, monthIdx).map((w) => ({
    index: w.index,
    label: w.label,
    amount: sumInRange(records, w.start, w.end),
  }));
  const total = weeks.reduce((s, w) => s + w.amount, 0);
  return { total, weeks };
}
