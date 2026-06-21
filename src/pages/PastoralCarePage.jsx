import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Heart, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";

const TYPES = ["prayer_request","visitation","counseling","follow_up","hospital_visit","bereavement","first_time_guest"];
const STATUSES = ["open","in_progress","resolved","closed"];
const PRIORITIES = ["normal","urgent"];

const TYPE_LABEL = {
  prayer_request:"Prayer Request", visitation:"Visitation", counseling:"Counseling",
  follow_up:"Follow-Up", hospital_visit:"Hospital Visit", bereavement:"Bereavement",
  first_time_guest:"First-Time Guest",
};

const STATUS_COLOR = {
  open:"bg-blue-100 text-blue-700", in_progress:"bg-amber-100 text-amber-700",
  resolved:"bg-green-100 text-green-700", closed:"bg-gray-100 text-gray-700",
};

const STATUS_ICON = {
  open: Clock, in_progress: AlertCircle, resolved: CheckCircle2, closed: CheckCircle2,
};

const EMPTY = { member_id:"", member_name:"", type:"prayer_request", date:"", description:"", status:"open", priority:"normal", assigned_name:"", is_private:false, resolution_notes:"" };

export default function PastoralCarePage() {
  const { user } = useAuth();
  const role = user?.role || "member";
  const canManage = ["super_admin","pastor_admin"].includes(role);
  const canSee = ["super_admin","pastor_admin","department_head"].includes(role);

  const [records, setRecords] = useState([]);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [recs, mems] = await Promise.all([
      entities.PastoralCare.list("-date", 500),
      entities.Member.filter({ membership_status:"active" }),
    ]);
    setRecords(recs); setMembers(mems); setLoading(false);
  }

  function openNew() {
    setForm({ ...EMPTY, date: new Date().toISOString().split("T")[0] });
    setEditId(null); setOpen(true);
  }
  function openEdit(r) { setForm({ ...r }); setEditId(r.id); setOpen(true); }

  async function handleSave() {
    const member = members.find(m => m.id === form.member_id);
    const data = { ...form, member_name: member ? `${member.first_name} ${member.last_name}` : form.member_name };
    if (editId) await entities.PastoralCare.update(editId, data);
    else await entities.PastoralCare.create(data);
    setOpen(false); loadData();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this record?")) return;
    await entities.PastoralCare.delete(id); loadData();
  }

  async function quickStatus(id, status) {
    const extra = status === "resolved" ? { resolved_date: new Date().toISOString().split("T")[0] } : {};
    await entities.PastoralCare.update(id, { status, ...extra });
    loadData();
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const filtered = records.filter(r => {
    if (r.is_private && !canManage) return false;
    const matchSearch = (r.member_name||"").toLowerCase().includes(search.toLowerCase()) ||
      r.description.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || r.type === typeFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const openCount = records.filter(r => r.status === "open").length;
  const urgentCount = records.filter(r => r.priority === "urgent" && r.status !== "closed").length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Heart className="w-6 h-6 text-primary" /> Pastoral Care</h1>
          <p className="text-muted-foreground text-sm">{openCount} open · {urgentCount} urgent</p>
        </div>
        {canSee && <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />New Record</Button>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {STATUSES.map(s => {
          const count = records.filter(r => r.status === s).length;
          const Icon = STATUS_ICON[s];
          return (
            <button key={s} onClick={() => setStatusFilter(s === statusFilter ? "all" : s)}
              className={`p-4 rounded-xl border text-left transition-all ${statusFilter === s ? "border-primary bg-primary/5" : "bg-white border-border hover:border-primary/30"}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${s === "open" ? "text-blue-500" : s === "in_progress" ? "text-amber-500" : "text-green-500"}`} />
                <span className="text-xs text-muted-foreground capitalize">{s.replace(/_/g," ")}</span>
              </div>
              <p className="text-2xl font-bold">{count}</p>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by member or description..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map(r => (
          <div key={r.id} className="bg-white rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-semibold text-sm">{r.member_name || "Anonymous"}</span>
                  <Badge className={`text-xs border-0 ${STATUS_COLOR[r.status]}`}>{r.status.replace(/_/g," ")}</Badge>
                  {r.priority === "urgent" && <Badge className="text-xs bg-red-100 text-red-700 border-0">Urgent</Badge>}
                  {r.is_private && <Badge className="text-xs bg-gray-100 text-gray-600 border-0">Private</Badge>}
                  <span className="text-xs text-muted-foreground">{TYPE_LABEL[r.type] || r.type}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{r.description}</p>
                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                  <span>{r.date}</span>
                  {r.assigned_name && <span>Assigned to: {r.assigned_name}</span>}
                  {r.resolved_date && <span>Resolved: {r.resolved_date}</span>}
                </div>
              </div>
              {canSee && (
                <div className="flex items-center gap-1 flex-shrink-0">
                  {r.status === "open" && (
                    <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => quickStatus(r.id, "in_progress")}>In Progress</Button>
                  )}
                  {r.status === "in_progress" && (
                    <Button variant="outline" size="sm" className="text-xs h-7 text-green-600 border-green-300" onClick={() => quickStatus(r.id, "resolved")}>Resolve</Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="w-4 h-4" /></Button>
                  {canManage && <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-8">No pastoral care records found.</p>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Record" : "New Pastoral Care Record"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div>
              <Label>Member</Label>
              <Select value={form.member_id} onValueChange={v => f("member_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select member..." /></SelectTrigger>
                <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={e => f("date", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={v => f("type", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => f("priority", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => f("status", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned To</Label>
              <Input value={form.assigned_name} onChange={e => f("assigned_name", e.target.value)} placeholder="Pastor / staff name" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Description / Notes *</Label>
              <textarea value={form.description} onChange={e => f("description", e.target.value)} rows={3}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            {form.status === "resolved" && (
              <div className="sm:col-span-2">
                <Label>Resolution Notes</Label>
                <textarea value={form.resolution_notes} onChange={e => f("resolution_notes", e.target.value)} rows={2}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="checkbox" id="is_private" checked={form.is_private} onChange={e => f("is_private", e.target.checked)} className="rounded" />
              <Label htmlFor="is_private" className="cursor-pointer">Private (pastoral team only)</Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground" disabled={!form.date || !form.description}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
