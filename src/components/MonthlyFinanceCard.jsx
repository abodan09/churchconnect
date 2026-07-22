// Expanded dashboard card: a month's total plus a per-week breakdown.
// Weeks are Sun–Sat calendar weeks clamped to the month (see lib/finance.js),
// so the rows always add up to the headline total.
export default function MonthlyFinanceCard({ title, total, weeks = [], monthLabel, icon: Icon, color = "green", fmt }) {
  const colors = {
    green: "bg-primary/10 text-primary",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <div className="bg-white rounded-xl border border-border p-5 shadow-sm flex flex-col">
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide truncate">{title}</p>
            {monthLabel && (
              <span className="text-[11px] text-muted-foreground font-medium whitespace-nowrap flex-shrink-0">{monthLabel}</span>
            )}
          </div>
          <p className="text-2xl font-bold text-foreground mt-0.5 tabular-nums leading-tight break-words">{fmt(total)}</p>
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border space-y-1.5">
        {weeks.map((w) => (
          <div key={w.index} className="flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground truncate">
              Week {w.index}
              <span className="text-muted-foreground/70"> · {w.label}</span>
            </span>
            <span className="font-medium tabular-nums text-foreground whitespace-nowrap">{fmt(w.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
