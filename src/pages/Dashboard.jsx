import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { entities } from "@/api/client";
import StatCard from "@/components/StatCard";
import MonthlyFinanceCard from "@/components/MonthlyFinanceCard";
import { Button } from "@/components/ui/button";
import { useChurchSettings } from "@/lib/ChurchSettingsContext";
import { weeklyBreakdown, MONTHS, MONTHS_SHORT } from "@/lib/finance";
import { generateFinancialReportPDF } from "@/lib/financeReport";
import { Users, HandCoins, Receipt, CalendarDays, TrendingUp, Coins, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useOutletContext() || {};
  const navigate = useNavigate();
  const { fmt, settings } = useChurchSettings() || {};
  const formatMoney = fmt || ((n) => `€${Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`);

  const now = new Date();
  const [selMonth, setSelMonth] = useState(now.getMonth());
  const [selYear, setSelYear] = useState(now.getFullYear());

  const [memberCount, setMemberCount] = useState(0);
  const [monthGiving, setMonthGiving] = useState([]);
  const [monthExp, setMonthExp] = useState([]);
  const [birthdayMembers, setBirthdayMembers] = useState([]);
  const [recentGiving, setRecentGiving] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [monthBusy, setMonthBusy] = useState(false);

  useEffect(() => {
    const role = user?.role === "admin" ? "super_admin" : (user?.role || "member");
    const deptId = user?.data?.department_id;
    if (role === "member" && !deptId) { navigate("/portal"); return; }
    if (!["super_admin", "pastor_admin", "finance_officer"].includes(role) && deptId) {
      navigate("/dept-dashboard");
      return;
    }
    initLoad();
  }, [user]);

  // Reload the finance cards when the user navigates to a different month.
  // The first render is handled by initLoad(), so skip it here.
  const firstMonth = useRef(true);
  useEffect(() => {
    if (firstMonth.current) { firstMonth.current = false; return; }
    (async () => {
      setMonthBusy(true);
      await loadMonth(selMonth, selYear);
      setMonthBusy(false);
    })();
  }, [selMonth, selYear]);

  async function initLoad() {
    setLoading(true);
    await Promise.all([loadGlobal(), loadMonth(selMonth, selYear)]);
    setLoading(false);
  }

  async function loadGlobal() {
    try {
      const [members, events, recent] = await Promise.all([
        entities.Member.list("-created_date", 1000),
        entities.Event.list("start_datetime", 20),
        entities.Giving.list("-date", 5),
      ]);
      const nowIso = new Date().toISOString();
      const currentMonth = new Date().getMonth() + 1;
      const parseDob = (str) => { try { const d = new Date(str); return isNaN(d) ? null : d; } catch { return null; } };
      const bdays = members.filter(m => {
        if (!m.date_of_birth) return false;
        const dob = parseDob(m.date_of_birth);
        return dob && (dob.getMonth() + 1) === currentMonth;
      }).sort((a, b) => {
        const dayA = parseDob(a.date_of_birth)?.getDate() ?? 0;
        const dayB = parseDob(b.date_of_birth)?.getDate() ?? 0;
        return dayA - dayB;
      });
      setBirthdayMembers(bdays);
      setMemberCount(members.length);
      setRecentGiving(recent);
      setUpcomingEvents(events.filter(e => e.start_datetime >= nowIso).slice(0, 5));
    } catch (err) {
      console.error('Dashboard loadGlobal failed:', err);
    }
  }

  // Load only the selected month's records (server-side prefix filter), so a
  // church with any volume of history always sees complete monthly totals.
  // A sequence guard drops out-of-order responses when the user clicks quickly.
  const loadSeq = useRef(0);
  async function loadMonth(month, year) {
    const seq = ++loadSeq.current;
    const prefix = `${year}-${String(month + 1).padStart(2, "0")}`;
    try {
      const [g, e] = await Promise.all([
        entities.Giving.filter({ date_startsWith: prefix, sort: "-date", limit: 10000 }),
        entities.Expenditure.filter({ date_startsWith: prefix, sort: "-date", limit: 10000 }),
      ]);
      if (seq !== loadSeq.current) return;
      setMonthGiving(g);
      setMonthExp(e);
    } catch (err) {
      if (seq !== loadSeq.current) return;
      console.error('Dashboard loadMonth failed:', err);
      setMonthGiving([]);
      setMonthExp([]);
    }
  }

  // Per-month weekly breakdowns for the selected month.
  const { tithes, offerings, others, expenses } = useMemo(() => {
    const tithesRecords = monthGiving.filter(g => g.type === "tithe");
    const offeringsRecords = monthGiving.filter(g => g.type === "offering");
    const othersRecords = monthGiving.filter(g => g.type !== "tithe" && g.type !== "offering");
    const approvedExpRecords = monthExp.filter(e => e.approval_status === "approved");
    return {
      tithes: weeklyBreakdown(tithesRecords, selYear, selMonth),
      offerings: weeklyBreakdown(offeringsRecords, selYear, selMonth),
      others: weeklyBreakdown(othersRecords, selYear, selMonth),
      expenses: weeklyBreakdown(approvedExpRecords, selYear, selMonth),
    };
  }, [monthGiving, monthExp, selMonth, selYear]);

  function shiftMonth(delta) {
    let m = selMonth + delta;
    let y = selYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setSelMonth(m);
    setSelYear(y);
  }

  const isCurrentMonth = selYear === now.getFullYear() && selMonth === now.getMonth();
  const monthBadge = `${MONTHS_SHORT[selMonth]} ${selYear}`;

  function handleDownload() {
    generateFinancialReportPDF({
      monthIdx: selMonth,
      year: selYear,
      giving: monthGiving,
      expenditures: monthExp,
      fmt: formatMoney,
      churchName: settings?.church_name,
      splitOthers: true,
    });
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Welcome back — here's your church at a glance.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-white px-1 py-1 shadow-sm">
            <button
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-foreground px-2 text-center min-w-[128px] flex items-center justify-center gap-2">
              {MONTHS[selMonth]} {selYear}
              {monthBusy && <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />}
            </span>
            <button
              onClick={() => shiftMonth(1)}
              disabled={isCurrentMonth}
              aria-label="Next month"
              className="p-1.5 rounded-md hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <Button onClick={handleDownload} className="gap-2 bg-primary text-primary-foreground">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>
      </div>

      <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 items-start transition-opacity ${monthBusy ? "opacity-60" : ""}`}>
        <StatCard title="Total Members" value={memberCount} icon={Users} color="green" />
        <MonthlyFinanceCard title="Total Tithes" total={tithes.total} weeks={tithes.weeks} monthLabel={monthBadge} icon={HandCoins} color="amber" fmt={formatMoney} />
        <MonthlyFinanceCard title="Total Offerings" total={offerings.total} weeks={offerings.weeks} monthLabel={monthBadge} icon={TrendingUp} color="blue" fmt={formatMoney} />
        <MonthlyFinanceCard title="Other Inflow" total={others.total} weeks={others.weeks} monthLabel={monthBadge} icon={Coins} color="purple" fmt={formatMoney} />
        <MonthlyFinanceCard title="Approved Expenses" total={expenses.total} weeks={expenses.weeks} monthLabel={monthBadge} icon={Receipt} color="red" fmt={formatMoney} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4">Recent Giving</h2>
          {recentGiving.length === 0 ? <p className="text-muted-foreground text-sm">No records yet.</p> : (
            <div className="space-y-3">
              {recentGiving.map(g => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium">{g.member_name || "Unknown"}</p>
                    <p className="text-muted-foreground capitalize">{g.type?.replace(/_/g, " ")} · {g.date}</p>
                  </div>
                  <span className="font-semibold text-primary">{formatMoney(g.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="font-semibold text-foreground mb-4">Upcoming Events</h2>
          {upcomingEvents.length === 0 ? <p className="text-muted-foreground text-sm">No upcoming events.</p> : (
            <div className="space-y-3">
              {upcomingEvents.map(e => (
                <div key={e.id} className="flex items-start gap-3 text-sm">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-muted-foreground">{e.start_datetime ? format(new Date(e.start_datetime), "MMM d, yyyy · h:mm a") : ""}</p>
                    {e.location && <p className="text-muted-foreground">{e.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-border p-5 shadow-sm lg:col-span-2">
          <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">🎂 Upcoming Birthdays — {format(new Date(), "MMMM yyyy")}</h2>
          <p className="text-xs text-muted-foreground mb-4">Members with birthdays this month</p>
          {birthdayMembers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No birthdays this month.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {birthdayMembers.map(m => {
                const dob = new Date(m.date_of_birth);
                const today = new Date();
                const birthday = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
                const isToday = birthday.toDateString() === today.toDateString();
                const isPast = birthday < today && !isToday;
                return (
                  <div key={m.id} className={`flex items-center gap-3 p-3 rounded-lg border ${
                    isToday ? "border-amber-300 bg-amber-50" : isPast ? "border-border bg-muted/20" : "border-border bg-white"
                  }`}>
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-base">
                      {isToday ? "🎉" : "🎂"}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{m.first_name} {m.last_name}</p>
                      <p className="text-xs text-muted-foreground">{format(dob, "MMMM d")} {isToday && <span className="text-amber-600 font-semibold">· Today!</span>}</p>
                      {m.department_name && <p className="text-xs text-primary">{m.department_name}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
