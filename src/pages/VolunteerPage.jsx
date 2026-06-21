import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, UserCheck } from "lucide-react";

const STATUSES = ["pending","confirmed","declined","served"];
const STATUS_COLOR = {
  pending:"bg-amber-100 text-amber-700", confirmed:"bg-blue-100 text-blue-700",
  declined:"bg-red-100 text-red-700", served:"bg-green-100 text-green-700",
};

const VOLUNTEER_ROLES = [
  "Usher","Sound Tech","Projection / Media","Worship Team","Children's Ministry",
  "Parking","Welcome Team","Security","Choir","Protocol","Prayer Team","Other",
];

const EMPTY = { member_id:"", member_name:"", event_id:"", event_name:"", event_date:"", department_id:"", department_name:"", role:"", status:"pending", notes:"", checked_in:false };

export default function VolunteerPage() {
  const { user } = useAuth();
  const role = user?.role || "member";
  const canManage = ["super_admin","pastor_admin","department_head"].includes(role);

  const [volunteers, setVolunteers] = useState([]);
  const [members, setMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [v, m, e, d] = await Promise.all([
      entities.Volunteer.list("-createdAt", 500),
      entities.Member.filter({ membership_status:"active" }),
      entities.Event.list("start_datetime", 100),
      entities.Department.filter({ is_active:true }),
    ]);
    setVolunteers(v); setMembers(m);
    setEvents(e.filter(ev => ev.start_datetime >= new Date(Date.now() - 30*24*60*60*1000).toISOString()));
    setDepartments(d); setLoading(false);
  }

  function openNew() { setForm(EMPTY); setEditId(null); setOpen(true); }
  function openEdit(v) { setForm({ ...v }); setEditId(v.id); setOpen(true); }

  async function handleSave() {
    const member = members.find(m => m.id === form.member_id);
    const event = events.find(e => e.id === form.event_id);
    const dept = departments.find(d => d.id === form.department_id);
    const data = {
      ...form,
      member_name: member ? `${member.first_name} ${member.last_name}` : form.member_name,
      event_name: event?.title || form.event_name,
      event_date: event?.start_datetime?.split("T")[0] || form.event_date,
      department_name: dept?.name || form.department_name,
    };
    if (editId) await entities.Volunteer.update(editId, data);
    else await entities.Volunteer.create(data);
    setOpen(false); loadData();
  }

  async function handleDelete(id) {
    if (!confirm("Remove this volunteer record?")) return;
    await entities.Volunteer.delete(id); loadData();
  }

  async function quickStatus(id, status) {
    await entities.Volunteer.update(id, { status }); loadData();
  }

  async function toggleCheckin(id, current) {
    await entities.Volunteer.update(id, { checked_in: !current, status: !current ? "served" : "confirmed" });
    loadData();
  }

  const ff = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filtered = volunteers.filter(v => {
    const matchSearch = (v.member_name||"").toLowerCase().includes(search.toLowerCase()) ||
      (v.role||"").toLowerCase().includes(search.toLowerCase()) ||
      (v.event_name||"").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || v.status === statusFilter;
    const matchEvent = eventFilter === "all" || v.event_id === eventFilter;
    return matchSearch && matchStatus && matchEvent;
  });

  const confirmedCount = volunteers.filter(v => v.status === "confirmed").length;
  const pendingCount = volunteers.filter(v => v.status === "pending").length;
  const servedCount = volunteers.filter(v => v.status === "served").length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UserCheck className="w-6 h-6 text-primary" /> Volunteers</h1>
          <p className="text-muted-foreground text-sm">{confirmedCount} confirmed · {pendingCount} pending · {servedCount} served</p>
        </div>
        {canManage && <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />Add Volunteer</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by member, role or event..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-52"><SelectValue placeholder="All Events" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Member","Event","Role","Department","Status","Check-in","Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((v, i) => (
                <tr key={v.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="px-4 py-3 font-medium">{v.member_name || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <p>{v.event_name || "—"}</p>
                    {v.event_date && <p className="text-xs">{v.event_date}</p>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{v.role || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{v.department_name || "—"}</td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <Select value={v.status} onValueChange={s => quickStatus(v.id, s)}>
                        <SelectTrigger className={`h-7 text-xs w-32 border-0 ${STATUS_COLOR[v.status]}`}><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    ) : (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[v.status]}`}>{v.status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage ? (
                      <button onClick={() => toggleCheckin(v.id, v.checked_in)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${v.checked_in ? "bg-green-500 border-green-500 text-white" : "border-gray-300"}`}>
                        {v.checked_in ? "✓" : ""}
                      </button>
                    ) : (
                      <span className={v.checked_in ? "text-green-600 text-xs font-medium" : "text-muted-foreground text-xs"}>{v.checked_in ? "Checked in" : "—"}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canManage && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(v)}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No volunteer records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Volunteer Record" : "Add Volunteer"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="sm:col-span-2">
              <Label>Member *</Label>
              <Select value={form.member_id} onValueChange={v => ff("member_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select member..." /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Event</Label>
              <Select value={form.event_id} onValueChange={v => ff("event_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select event..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific event</SelectItem>
                  {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title} — {e.start_datetime?.split("T")[0]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Volunteer Role</Label>
              <Select value={form.role} onValueChange={v => ff("role", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select role..." /></SelectTrigger>
                <SelectContent>{VOLUNTEER_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.department_id} onValueChange={v => ff("department_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select dept..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => ff("status", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Input value={form.notes} onChange={e => ff("notes", e.target.value)} className="mt-1" />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground" disabled={!form.member_id}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
