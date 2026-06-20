import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HandCoins, CalendarDays, User } from "lucide-react";
import { format } from "date-fns";

export default function MemberPortal() {
  const { user: authUser } = useAuth();
  const [user, setUser] = useState(null);
  const [member, setMember] = useState(null);
  const [giving, setGiving] = useState([]);
  const [events, setEvents] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const u = authUser;
    setUser(u);
    setForm({ phone: u.phone || "", profile_photo_url: u.profile_photo_url || "" });
    const [members, givingData, eventsData] = await Promise.all([
      entities.Member.filter({ email: u.email }),
      entities.Giving.list("-date", 100),
      entities.Event.filter({ is_public: true }),
    ]);
    const myMember = members.length > 0 ? members[0] : null;
    if (myMember) setMember(myMember);
    setGiving(givingData.filter(g => {
      if (myMember?.id && g.member_id) return g.member_id === myMember.id;
      return g.member_name && u.full_name &&
        g.member_name.toLowerCase().trim() === u.full_name.toLowerCase().trim();
    }).slice(0, 20));
    const now = new Date().toISOString();
    setEvents(eventsData.filter(e => e.start_datetime >= now).slice(0, 8));
  }

  async function handleSave() {
    setSaving(true);
    await entities.UserProfile.update(authUser.id, form);
    if (member) await entities.Member.update(member.id, { phone: form.phone, profile_photo_url: form.profile_photo_url });
    setSaving(false);
    setEditing(false);
    setUser(prev => ({ ...prev, ...form }));
  }

  const fmt = n => `GHS ${Number(n).toLocaleString("en", { minimumFractionDigits: 2 })}`;
  const totalGiven = giving.reduce((s, g) => s + (g.amount || 0), 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Portal</h1>
        <p className="text-muted-foreground text-sm">Your personal church dashboard.</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-xl border border-border p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-primary text-2xl font-bold">
              {user?.full_name?.[0] || "?"}
            </div>
            <div>
              <h2 className="font-semibold text-lg">{user?.full_name}</h2>
              <p className="text-muted-foreground text-sm">{user?.email}</p>
              {member && <p className="text-xs text-primary font-medium mt-0.5 capitalize">{member.department_name} · {member.membership_status}</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
            {editing ? "Cancel" : "Edit Profile"}
          </Button>
        </div>

        {editing && (
          <div className="border-t border-border pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="Phone number" className="mt-1" />
            </div>
            <div>
              <Label>Profile Photo URL</Label>
              <Input value={form.profile_photo_url} onChange={e => setForm(p => ({ ...p, profile_photo_url: e.target.value }))} placeholder="https://..." className="mt-1" />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground">
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Giving History */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><HandCoins className="w-4 h-4 text-primary" /> My Giving</h2>
            <span className="text-sm font-bold text-primary">{fmt(totalGiven)} total</span>
          </div>
          {giving.length === 0 ? <p className="text-muted-foreground text-sm">No giving records found.</p> : (
            <div className="space-y-3">
              {giving.map(g => (
                <div key={g.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium capitalize">{g.type?.replace(/_/g, " ")}</p>
                    <p className="text-muted-foreground">{g.date} · {g.payment_method}</p>
                  </div>
                  <span className="font-semibold text-primary">{fmt(g.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Events */}
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><CalendarDays className="w-4 h-4 text-primary" /> Upcoming Events</h2>
          {events.length === 0 ? <p className="text-muted-foreground text-sm">No upcoming events.</p> : (
            <div className="space-y-3">
              {events.map(e => (
                <div key={e.id} className="flex items-start gap-3 text-sm border-b border-border last:border-0 pb-3 last:pb-0">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <CalendarDays className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-muted-foreground">{e.start_datetime ? format(new Date(e.start_datetime), "EEE, MMM d · h:mm a") : ""}</p>
                    {e.location && <p className="text-muted-foreground text-xs">{e.location}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
