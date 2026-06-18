import { useState, useEffect } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import StatCard from "@/components/StatCard";
import { Users, HandCoins, Receipt, Building2, CalendarDays, TrendingUp } from "lucide-react";
import { format } from "date-fns";

export default function Dashboard() {
  const { user } = useOutletContext() || {};
  const navigate = useNavigate();
  const [stats, setStats] = useState({ members: 0, totalTithes: 0, totalOfferings: 0, totalExpenses: 0 });
  const [birthdayMembers, setBirthdayMembers] = useState([]);
  const [recentGiving, setRecentGiving] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const role = user?.role === "admin" ? "super_admin" : (user?.role || "member");
    if (role === "member") { navigate("/portal"); return; }
    loadData();
  }, [user]);

  async function loadData() {
    setLoading(true);
    const [members, giving, expenditures, events] = await Promise.all([
      base44.entities.Member.list("-created_date", 1000),
      base44.entities.Giving.list("-date", 1000),
      base44.entities.Expenditure.list("-date", 1000),
      base44.entities.Event.list("start_datetime", 20),
    ]);
    const now = new Date().toISOString();
    // Upcoming birthdays this month
    const currentMonth = new Date().getMonth() + 1;
    const bdays = members.filter(m => {
      if (!m.date_of_birth) return false;
      const month = parseInt(m.date_of_birth.split("-")[1], 10);
      return month === currentMonth;
    }).sort((a, b) => {
      const dayA = parseInt(a.date_of_birth.split("-")[2], 10);
      const dayB = parseInt(b.date_of_birth.split("-")[2], 10);
      return dayA - dayB;
    });
    setBirthdayMembers(bdays);
    const totalTithes = giving.filter(g => g.type === "tithe").reduce((s, g) => s + (g.amount || 0), 0);
    const totalOfferings = giving.filter(g => g.type !== "tithe").reduce((s, g) => s + (g.amount || 0), 0);
    const totalExpenses = expenditures.filter(e => e.approval_status === "approved").reduce((s, e) => s + (e.amount || 0), 0);
    setStats({ members: members.length, totalTithes, totalOfferings, totalExpenses });
    setRecentGiving(giving.slice(0, 5));
    setUpcomingEvents(events.filter(e => e.start_datetime >= now).slice(0, 5));
    setLoading(false);
  }

  const fmt = n => `€${Number(n).toLocaleString("en", { minimumFractionDigits: 2 })}`;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome back — here's your church at a glance.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard title="Total Members" value={stats.members} icon={Users} color="green" />
        <StatCard title="Total Tithes" value={fmt(stats.totalTithes)} icon={HandCoins} color="amber" />
        <StatCard title="Total Offerings" value={fmt(stats.totalOfferings)} icon={TrendingUp} color="blue" />
        <StatCard title="Approved Expenses" value={fmt(stats.totalExpenses)} icon={Receipt} color="red" />
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
                  <span className="font-semibold text-primary">{fmt(g.amount)}</span>
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