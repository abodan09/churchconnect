import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";
import { format, subDays, startOfWeek, startOfMonth, parseISO, differenceInDays } from "date-fns";
import { Users, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import StatCard from "@/components/StatCard";
import { BillingShow, UpgradePrompt } from "@/lib/billing";

export default function AttendanceAnalyticsPage() {
  const [attendance, setAttendance] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("monthly"); // weekly | monthly

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [a, m] = await Promise.all([
      entities.Attendance.list("-event_date", 2000),
      entities.Member.filter({ membership_status: "active" }),
    ]);
    setAttendance(a);
    setMembers(m);
    setLoading(false);
  }

  // --- Weekly chart data (last 8 weeks) ---
  const weeklyData = (() => {
    const weeks = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(subDays(new Date(), i * 7));
      const weekEnd = subDays(startOfWeek(subDays(new Date(), (i - 1) * 7)), 1);
      const label = format(weekStart, "MMM d");
      const count = attendance.filter(a => {
        if (!a.event_date) return false;
        const d = parseISO(a.event_date.split("T")[0]);
        return d >= weekStart && d <= weekEnd;
      }).length;
      weeks.push({ label, count });
    }
    return weeks;
  })();

  // --- Monthly chart data (last 6 months) ---
  const monthlyData = (() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = format(d, "MMM yyyy");
      const m = d.getMonth();
      const y = d.getFullYear();
      const count = attendance.filter(a => {
        if (!a.event_date) return false;
        const ad = new Date(a.event_date);
        return ad.getMonth() === m && ad.getFullYear() === y;
      }).length;
      months.push({ label, count });
    }
    return months;
  })();

  // --- Consistent participants (attended 3+ times) ---
  const memberAttendanceCount = {};
  attendance.forEach(a => {
    if (a.member_id) memberAttendanceCount[a.member_id] = (memberAttendanceCount[a.member_id] || 0) + 1;
  });
  const memberNameMap = {};
  attendance.forEach(a => { if (a.member_id && a.member_name) memberNameMap[a.member_id] = a.member_name; });

  const consistent = Object.entries(memberAttendanceCount)
    .filter(([, c]) => c >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([id, count]) => ({ id, name: memberNameMap[id] || id, count }));

  // --- Inactive members (no attendance in 30+ days) ---
  const lastAttendance = {};
  attendance.forEach(a => {
    if (!a.member_id || !a.event_date) return;
    const d = new Date(a.event_date);
    if (!lastAttendance[a.member_id] || d > lastAttendance[a.member_id]) {
      lastAttendance[a.member_id] = d;
    }
  });

  const today = new Date();
  const inactive = members.filter(m => {
    const last = lastAttendance[m.id];
    if (!last) return true; // never attended
    return differenceInDays(today, last) > 30;
  }).map(m => ({
    id: m.id,
    name: `${m.first_name} ${m.last_name}`,
    department: m.department_name || "—",
    lastSeen: lastAttendance[m.id] ? format(lastAttendance[m.id], "MMM d, yyyy") : "Never",
    daysInactive: lastAttendance[m.id] ? differenceInDays(today, lastAttendance[m.id]) : null,
  }));

  const chartData = view === "weekly" ? weeklyData : monthlyData;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  // BillingShow with feature check — declarative feature gate (Clerk B2B billing)
  return (
    <BillingShow
      when={{ feature: 'attendance_analytics' }}
      fallback={<UpgradePrompt feature="attendance_analytics" message="Attendance Analytics requires the Starter plan or above." />}
    >
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Attendance Analytics</h1>
        <p className="text-muted-foreground text-sm">Trends, consistent participants, and inactive members</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Check-ins" value={attendance.length} icon={CheckCircle} color="green" />
        <StatCard title="Consistent Members" value={consistent.length} icon={TrendingUp} color="blue" />
        <StatCard title="Inactive (30+ days)" value={inactive.length} icon={AlertTriangle} color="red" />
      </div>

      {/* Attendance Trend Chart */}
      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold">Attendance Trend</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setView("weekly")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "weekly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >Weekly</button>
            <button
              onClick={() => setView("monthly")}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === "monthly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
            >Monthly</button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" name="Check-ins" fill="hsl(152,41%,30%)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Consistent Participants */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Consistent Participants</h2>
          <p className="text-xs text-muted-foreground mb-3">Members who attended 3 or more times</p>
          {consistent.length === 0 ? (
            <p className="text-muted-foreground text-sm">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {consistent.map((m, i) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-bold text-muted-foreground">{i + 1}.</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.name}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{m.count} times</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inactive Members */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-destructive" />Inactive Members (30+ days)</h2>
          <p className="text-xs text-muted-foreground mb-3">{inactive.length} active members haven't attended recently</p>
          {inactive.length === 0 ? (
            <p className="text-muted-foreground text-sm">All members are active! 🎉</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {inactive.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-red-50 border border-red-100">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.department} · Last seen: {m.lastSeen}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 whitespace-nowrap">
                    {m.daysInactive != null ? `${m.daysInactive}d ago` : "Never"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
    </BillingShow>
  );
}
