import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Megaphone, Pin, AlertTriangle, Info } from "lucide-react";
import { format } from "date-fns";

const AUDIENCES = ["all","members","staff","department"];
const PRIORITIES = ["normal","info","urgent"];

const PRIORITY_STYLE = {
  normal:"bg-blue-100 text-blue-700", info:"bg-gray-100 text-gray-700", urgent:"bg-red-100 text-red-700",
};

const PRIORITY_ICON = { normal: Megaphone, info: Info, urgent: AlertTriangle };

const AUDIENCE_LABEL = { all:"Everyone", members:"Members Only", staff:"Staff Only", department:"Department" };

const EMPTY = { title:"", content:"", audience:"all", department_id:"", department_name:"", publish_date:"", expiry_date:"", is_pinned:false, priority:"normal", is_active:true, published_by:"" };

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const role = user?.role || "member";
  const canManage = ["super_admin","pastor_admin","department_head"].includes(role);

  const [announcements, setAnnouncements] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [audienceFilter, setAudienceFilter] = useState("all_filter");
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [a, d] = await Promise.all([
      entities.Announcement.list("-createdAt", 200),
      entities.Department.filter({ is_active:true }),
    ]);
    setAnnouncements(a); setDepartments(d); setLoading(false);
  }

  function openNew() {
    setForm({ ...EMPTY, publish_date: new Date().toISOString().split("T")[0], published_by: user?.full_name || "" });
    setEditId(null); setOpen(true);
  }
  function openEdit(a) { setForm({ ...a }); setEditId(a.id); setOpen(true); }

  async function handleSave() {
    const dept = departments.find(d => d.id === form.department_id);
    const data = { ...form, department_name: dept?.name || "" };
    if (editId) await entities.Announcement.update(editId, data);
    else await entities.Announcement.create(data);
    setOpen(false); loadData();
  }

  async function handleDelete(id) {
    if (!confirm("Delete this announcement?")) return;
    await entities.Announcement.delete(id); loadData();
  }

  async function togglePin(a) {
    await entities.Announcement.update(a.id, { is_pinned: !a.is_pinned }); loadData();
  }

  async function toggleActive(a) {
    await entities.Announcement.update(a.id, { is_active: !a.is_active }); loadData();
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const today = new Date().toISOString().split("T")[0];

  const filtered = announcements.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.content.toLowerCase().includes(search.toLowerCase());
    const matchAud = audienceFilter === "all_filter" || a.audience === audienceFilter;
    return matchSearch && matchAud;
  });

  const pinned = filtered.filter(a => a.is_pinned && a.is_active);
  const active = filtered.filter(a => !a.is_pinned && a.is_active && (!a.expiry_date || a.expiry_date >= today));
  const expired = filtered.filter(a => !a.is_active || (a.expiry_date && a.expiry_date < today && !a.is_pinned));

  function AnnouncementCard({ a }) {
    const PIcon = PRIORITY_ICON[a.priority] || Megaphone;
    const isExpired = a.expiry_date && a.expiry_date < today;
    return (
      <div className={`bg-white rounded-xl border shadow-sm p-5 space-y-2 ${a.is_pinned ? "border-primary/40 ring-1 ring-primary/20" : "border-border"} ${!a.is_active || isExpired ? "opacity-60" : ""}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`mt-0.5 p-1.5 rounded-lg ${PRIORITY_STYLE[a.priority]}`}>
              <PIcon className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground">{a.title}</h3>
                {a.is_pinned && <Pin className="w-3.5 h-3.5 text-primary" />}
                <Badge className={`text-xs border-0 ${PRIORITY_STYLE[a.priority]}`}>{a.priority}</Badge>
                <Badge variant="outline" className="text-xs">{AUDIENCE_LABEL[a.audience]}</Badge>
                {a.audience === "department" && a.department_name && (
                  <Badge variant="outline" className="text-xs text-primary">{a.department_name}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-line">{a.content}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                {a.published_by && <span>By {a.published_by}</span>}
                {a.publish_date && <span>{format(new Date(a.publish_date), "MMM d, yyyy")}</span>}
                {a.expiry_date && <span>Expires {format(new Date(a.expiry_date), "MMM d, yyyy")}</span>}
                {isExpired && <Badge className="text-xs bg-gray-100 text-gray-500 border-0">Expired</Badge>}
              </div>
            </div>
          </div>
          {canManage && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button variant="ghost" size="icon" title={a.is_pinned ? "Unpin" : "Pin"} onClick={() => togglePin(a)}>
                <Pin className={`w-4 h-4 ${a.is_pinned ? "text-primary" : "text-muted-foreground"}`} />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Edit className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Megaphone className="w-6 h-6 text-primary" /> Announcements</h1>
          <p className="text-muted-foreground text-sm">{active.length + pinned.length} active · {pinned.length} pinned</p>
        </div>
        {canManage && <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />New Announcement</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search announcements..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={audienceFilter} onValueChange={setAudienceFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Audience" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all_filter">All Audiences</SelectItem>
            {AUDIENCES.map(a => <SelectItem key={a} value={a}>{AUDIENCE_LABEL[a]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {pinned.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-2"><Pin className="w-3.5 h-3.5" /> Pinned</h2>
          {pinned.map(a => <AnnouncementCard key={a.id} a={a} />)}
        </div>
      )}

      {active.length > 0 && (
        <div className="space-y-3">
          {pinned.length > 0 && <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Recent</h2>}
          {active.map(a => <AnnouncementCard key={a.id} a={a} />)}
        </div>
      )}

      {active.length === 0 && pinned.length === 0 && (
        <p className="text-center text-muted-foreground py-8">No announcements found.</p>
      )}

      {expired.length > 0 && canManage && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">Show {expired.length} expired / inactive</summary>
          <div className="space-y-3 mt-3">
            {expired.map(a => <AnnouncementCard key={a.id} a={a} />)}
          </div>
        </details>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Announcement" : "New Announcement"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="sm:col-span-2">
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => f("title", e.target.value)} className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Content *</Label>
              <textarea value={form.content} onChange={e => f("content", e.target.value)} rows={4}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
            <div>
              <Label>Audience</Label>
              <Select value={form.audience} onValueChange={v => f("audience", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{AUDIENCES.map(a => <SelectItem key={a} value={a}>{AUDIENCE_LABEL[a]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.audience === "department" && (
              <div>
                <Label>Department</Label>
                <Select value={form.department_id} onValueChange={v => f("department_id", v)}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => f("priority", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Published By</Label>
              <Input value={form.published_by} onChange={e => f("published_by", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Publish Date</Label>
              <Input type="date" value={form.publish_date} onChange={e => f("publish_date", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Expiry Date</Label>
              <Input type="date" value={form.expiry_date} onChange={e => f("expiry_date", e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_pinned} onChange={e => f("is_pinned", e.target.checked)} className="rounded" />
                Pin to top
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={e => f("is_active", e.target.checked)} className="rounded" />
                Active
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground" disabled={!form.title || !form.content}>Publish</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
