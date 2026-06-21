import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { HandCoins, CalendarDays, User, Megaphone, Heart, Users, AlertTriangle, Info, Pin } from "lucide-react";
import { format } from "date-fns";

const PRIORITY_ICON = { urgent: AlertTriangle, info: Info, normal: Megaphone };
const PRIORITY_STYLE = { normal:"bg-blue-100 text-blue-700", info:"bg-gray-100 text-gray-700", urgent:"bg-red-100 text-red-700" };

export default function MemberPortal() {
  const { user: authUser } = useAuth();
  const [member, setMember] = useState(null);
  const [giving, setGiving] = useState([]);
  const [events, setEvents] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [milestones, setMilestones] = useState({});
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const [prayerOpen, setPrayerOpen] = useState(false);
  const [prayerForm, setPrayerForm] = useState({ description:"", is_private:false });
  const [prayerSaving, setPrayerSaving] = useState(false);
  const [prayerSent, setPrayerSent] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    const u = authUser;
    if (!u) return;
    setForm({ phone: u.phone || "", profile_photo_url: u.profile_photo_url || "" });

    const [members, givingData, eventsData, announcementsData, groupMemberships] = await Promise.all([
      entities.Member.filter({ email: u.email }),
      entities.Giving.list("-date", 100),
      entities.Event.filter({ is_public: true }),
      entities.Announcement.list("-createdAt", 20),
      entities.SmallGroupMember.filter({ is_active: true }),
    ]);

    const myMember = members.length > 0 ? members[0] : null;
    if (myMember) {
      setMember(myMember);
      setMilestones({
        baptism_date: myMember.baptism_date,
        membership_class_date: myMember.membership_class_date,
        confirmation_date: myMember.confirmation_date,
      });
    }

    setGiving(givingData.filter(g => {
      if (myMember?.id && g.member_id) return g.member_id === myMember.id;
      return g.member_name && u.full_name &&
        g.member_name.toLowerCase().trim() === u.full_name.toLowerCase().trim();
    }).slice(0, 20));

    const now = new Date().toISOString();
    setEvents(eventsData.filter(e => e.start_datetime >= now).slice(0, 8));

    const today = new Date().toISOString().split("T")[0];
    setAnnouncements(announcementsData.filter(a =>
      a.is_active &&
      (!a.expiry_date || a.expiry_date >= today) &&
      (a.audience === "all" || a.audience === "members")
    ).slice(0, 10));

    if (myMember) {
      const myMemberships = groupMemberships.filter(gm => gm.member_id === myMember.id);
      if (myMemberships.length > 0) {
        const groupIds = myMemberships.map(gm => gm.group_id);
        const allGroups = await entities.SmallGroup.list("-createdAt", 200);
        setMyGroups(allGroups.filter(g => groupIds.includes(g.id)));
      }
    }
  }

  async function handleSave() {
    setSaving(true);
    await entities.UserProfile.update(authUser.id, form);
    if (member) await entities.Member.update(member.id, { phone: form.phone, profile_photo_url: form.profile_photo_url });
    setSaving(false);
    setEditing(false);
  }

  async function submitPrayer() {
    if (!prayerForm.description.trim()) return;
    setPrayerSaving(true);
    await entities.PastoralCare.create({
      member_id: member?.id || "",
      member_name: authUser?.full_name || "",
      type: "prayer_request",
      date: new Date().toISOString().split("T")[0],
      description: prayerForm.description,
      status: "open",
      priority: "normal",
      is_private: prayerForm.is_private,
      submitted_by: authUser?.full_name || "",
    });
    setPrayerSaving(false);
    setPrayerSent(true);
    setPrayerForm({ description:"", is_private:false });
    setTimeout(() => { setPrayerOpen(false); setPrayerSent(false); }, 2000);
  }

  const fmt = n => `GHS ${Number(n).toLocaleString("en", { minimumFractionDigits: 2 })}`;
  const totalGiven = giving.reduce((s, g) => s + (g.amount || 0), 0);

  const hasMilestones = milestones.baptism_date || milestones.membership_class_date || milestones.confirmation_date;

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
              {authUser?.full_name?.[0] || "?"}
            </div>
            <div>
              <h2 className="font-semibold text-lg">{authUser?.full_name}</h2>
              <p className="text-muted-foreground text-sm">{authUser?.email}</p>
              {member && <p className="text-xs text-primary font-medium mt-0.5 capitalize">{member.department_name || "No department"} · {member.membership_status}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPrayerOpen(true)} className="gap-1.5 text-xs">
              <Heart className="w-3.5 h-3.5 text-red-400" /> Prayer Request
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing(!editing)}>
              {editing ? "Cancel" : "Edit Profile"}
            </Button>
          </div>
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

        {/* Spiritual Milestones */}
        {hasMilestones && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Spiritual Journey</p>
            <div className="flex flex-wrap gap-3">
              {milestones.baptism_date && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="text-base">✝</span>
                  <span>Baptised <span className="font-medium text-foreground">{format(new Date(milestones.baptism_date), "MMM d, yyyy")}</span></span>
                </div>
              )}
              {milestones.membership_class_date && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="text-base">🎓</span>
                  <span>Membership Class <span className="font-medium text-foreground">{format(new Date(milestones.membership_class_date), "MMM d, yyyy")}</span></span>
                </div>
              )}
              {milestones.confirmation_date && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="text-base">⭐</span>
                  <span>Confirmed <span className="font-medium text-foreground">{format(new Date(milestones.confirmation_date), "MMM d, yyyy")}</span></span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
          <h2 className="font-semibold flex items-center gap-2 mb-4"><Megaphone className="w-4 h-4 text-primary" /> Announcements</h2>
          <div className="space-y-3">
            {announcements.map(a => {
              const PIcon = PRIORITY_ICON[a.priority] || Megaphone;
              return (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={`mt-0.5 p-1.5 rounded-lg ${PRIORITY_STYLE[a.priority]}`}>
                    <PIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{a.title}</p>
                      {a.is_pinned && <Pin className="w-3 h-3 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{a.content}</p>
                    {a.publish_date && <p className="text-xs text-muted-foreground mt-1">{format(new Date(a.publish_date), "MMM d, yyyy")}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

        {/* My Small Groups */}
        {myGroups.length > 0 && (
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm lg:col-span-2">
            <h2 className="font-semibold flex items-center gap-2 mb-4"><Users className="w-4 h-4 text-primary" /> My Small Groups</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myGroups.map(g => (
                <div key={g.id} className="p-4 rounded-lg border border-border bg-muted/20">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5">{g.type?.replace(/_/g," ")}</p>
                  {g.meeting_day && <p className="text-xs text-muted-foreground mt-1">{g.meeting_day}{g.meeting_time ? ` at ${g.meeting_time}` : ""}</p>}
                  {g.location && <p className="text-xs text-muted-foreground">{g.location}</p>}
                  {g.leader_name && <p className="text-xs text-primary mt-1">Leader: {g.leader_name}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Prayer Request Dialog */}
      <Dialog open={prayerOpen} onOpenChange={setPrayerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Heart className="w-5 h-5 text-red-400" /> Submit Prayer Request</DialogTitle></DialogHeader>
          {prayerSent ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-2xl">🙏</p>
              <p className="font-medium">Prayer request submitted.</p>
              <p className="text-sm text-muted-foreground">Our pastoral team will be praying for you.</p>
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              <div>
                <Label>Your Request</Label>
                <textarea value={prayerForm.description} onChange={e => setPrayerForm(p => ({ ...p, description:e.target.value }))} rows={4} placeholder="Share what's on your heart..."
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={prayerForm.is_private} onChange={e => setPrayerForm(p => ({ ...p, is_private:e.target.checked }))} className="rounded" />
                Keep private (only pastors can see this)
              </label>
              <Button onClick={submitPrayer} disabled={prayerSaving || !prayerForm.description.trim()} className="w-full bg-primary text-primary-foreground">
                {prayerSaving ? "Submitting..." : "Submit Prayer Request"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
