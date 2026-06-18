import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, Edit, Trash2, CalendarDays, MapPin, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";

const EMPTY = { title: "", description: "", department_id: "", department_name: "", start_datetime: "", end_datetime: "", location: "", event_type: "service", is_public: true };
const TYPE_COLORS = { service: "bg-green-100 text-green-700", meeting: "bg-blue-100 text-blue-700", activity: "bg-amber-100 text-amber-700", special: "bg-purple-100 text-purple-700", outreach: "bg-red-100 text-red-700", training: "bg-gray-100 text-gray-700" };

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("upcoming");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [e, d, u] = await Promise.all([
      base44.entities.Event.list("start_datetime", 300),
      base44.entities.Department.filter({ is_active: true }),
      base44.auth.me()
    ]);
    setEvents(e); setDepartments(d); setUser(u); setLoading(false);
  }

  function openNew() { setForm(EMPTY); setEditId(null); setOpen(true); }
  function openEdit(e) { setForm({ ...e }); setEditId(e.id); setOpen(true); }

  async function handleSave() {
    const dept = departments.find(d => d.id === form.department_id);
    const data = { ...form, department_name: dept?.name || "", created_by_name: user?.full_name || "" };
    if (editId) await base44.entities.Event.update(editId, data);
    else await base44.entities.Event.create(data);
    setOpen(false); loadData();
  }

  async function handleDelete(id) {
    if (confirm("Delete this event?")) { await base44.entities.Event.delete(id); loadData(); }
  }

  const now = new Date().toISOString();
  const canCreate = ["super_admin","pastor_admin","department_head"].includes(user?.role);

  const filtered = events.filter(e => {
    const matchSearch = (e.title || "").toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || (filter === "upcoming" ? e.start_datetime >= now : e.start_datetime < now);
    return matchSearch && matchFilter;
  });

  const fmtDate = dt => { try { return format(parseISO(dt), "EEE, MMM d yyyy") } catch { return dt } };
  const fmtTime = dt => { try { return format(parseISO(dt), "h:mm a") } catch { return "" } };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Events</h1><p className="text-muted-foreground text-sm">Church calendar</p></div>
        {canCreate && <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />New Event</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search events..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="past">Past</SelectItem>
            <SelectItem value="all">All Events</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {filtered.map(e => (
          <div key={e.id} className="bg-white rounded-xl border border-border p-4 shadow-sm flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex flex-col items-center justify-center flex-shrink-0">
              <span className="text-xs text-primary font-bold">{fmtDate(e.start_datetime).split(" ")[1]}</span>
              <span className="text-lg font-bold text-primary leading-none">{fmtDate(e.start_datetime).split(" ")[2]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <h3 className="font-semibold">{e.title}</h3>
                  {e.description && <p className="text-muted-foreground text-sm mt-0.5">{e.description}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize flex-shrink-0 ${TYPE_COLORS[e.event_type] || "bg-gray-100 text-gray-700"}`}>{e.event_type}</span>
              </div>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtTime(e.start_datetime)}{e.end_datetime ? ` — ${fmtTime(e.end_datetime)}` : ""}</span>
                {e.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span>}
                {e.department_name && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{e.department_name}</span>}
                {!e.is_public && <span className="text-amber-600 font-medium">Dept only</span>}
              </div>
            </div>
            {canCreate && (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Edit className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <div className="text-center py-16 text-muted-foreground">No events found.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Event</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Title</Label><Input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} className="mt-1" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Start</Label><Input type="datetime-local" value={form.start_datetime} onChange={e=>setForm(p=>({...p,start_datetime:e.target.value}))} className="mt-1" /></div>
              <div><Label>End</Label><Input type="datetime-local" value={form.end_datetime} onChange={e=>setForm(p=>({...p,end_datetime:e.target.value}))} className="mt-1" /></div>
            </div>
            <div><Label>Location</Label><Input value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))} className="mt-1" /></div>
            <div><Label>Type</Label>
              <Select value={form.event_type} onValueChange={v=>setForm(p=>({...p,event_type:v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["service","meeting","activity","special","outreach","training"].map(t=><SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Department</Label>
              <Select value={form.department_id} onValueChange={v=>setForm(p=>({...p,department_id:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All departments" /></SelectTrigger>
                <SelectContent>
                  {departments.map(d=><SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <Label>Visible to all members</Label>
              <Switch checked={!!form.is_public} onCheckedChange={v=>setForm(p=>({...p,is_public:v}))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}