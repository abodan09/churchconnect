import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, Mic2, Video, Play } from "lucide-react";

const EMPTY = { title: "", description: "", preacher: "", date: "", department_id: "", department_name: "", media_type: "audio", file_url: "", thumbnail_url: "", duration_minutes: "", tags: "" };

export default function SermonsPage() {
  const [sermons, setSermons] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [user, setUser] = useState(null);
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [s, d, u] = await Promise.all([
      base44.entities.Sermon.list("-date", 200),
      base44.entities.Department.filter({ is_active: true, media_upload_enabled: true }),
      base44.auth.me()
    ]);
    setSermons(s); setDepartments(d); setUser(u); setLoading(false);
  }

  function openNew() { setForm(EMPTY); setEditId(null); setOpen(true); }
  function openEdit(s) { setForm({ ...s, duration_minutes: String(s.duration_minutes || "") }); setEditId(s.id); setOpen(true); }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(p => ({ ...p, file_url }));
    setUploading(false);
  }

  async function handleSave() {
    const dept = departments.find(d => d.id === form.department_id);
    const data = { ...form, duration_minutes: parseFloat(form.duration_minutes) || 0, department_name: dept?.name || "" };
    if (editId) await base44.entities.Sermon.update(editId, data);
    else await base44.entities.Sermon.create(data);
    setOpen(false); loadData();
  }

  async function handleDelete(id) {
    if (confirm("Delete this sermon?")) { await base44.entities.Sermon.delete(id); loadData(); }
  }

  const filtered = sermons.filter(s => {
    const match = (s.title || "").toLowerCase().includes(search.toLowerCase()) || (s.preacher || "").toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || s.department_id === deptFilter;
    return match && matchDept;
  });

  // Determine which media types are allowed for selected dept
  const selectedDept = departments.find(d => d.id === form.department_id);
  const allowedTypes = selectedDept?.allowed_media_types || "both";

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Sermons</h1><p className="text-muted-foreground text-sm">{sermons.length} sermons</p></div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />Upload Sermon</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search sermons..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(s => (
          <div key={s.id} className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${s.media_type === "audio" ? "bg-purple-100" : "bg-blue-100"}`}>
                {s.media_type === "audio" ? <Mic2 className="w-5 h-5 text-purple-600" /> : <Video className="w-5 h-5 text-blue-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.preacher} · {s.date}</p>
                {s.department_name && <p className="text-xs text-primary mt-0.5">{s.department_name}</p>}
                {s.duration_minutes > 0 && <p className="text-xs text-muted-foreground">{s.duration_minutes} min</p>}
              </div>
            </div>
            {s.file_url && (
              <div className="mt-3">
                {s.media_type === "audio"
                  ? <audio controls src={s.file_url} className="w-full h-8" />
                  : <a href={s.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs text-primary hover:underline"><Play className="w-3 h-3" />Play Video</a>
                }
              </div>
            )}
            <div className="flex gap-1 mt-3 justify-end">
              <Button variant="ghost" size="icon" onClick={() => openEdit(s)}><Edit className="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-3 text-center py-16 text-muted-foreground">No sermons found.</div>}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Upload"} Sermon</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div><Label>Title</Label><Input value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} className="mt-1" /></div>
            <div><Label>Preacher</Label><Input value={form.preacher} onChange={e=>setForm(p=>({...p,preacher:e.target.value}))} className="mt-1" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="mt-1" /></div>
              <div><Label>Duration (min)</Label><Input type="number" value={form.duration_minutes} onChange={e=>setForm(p=>({...p,duration_minutes:e.target.value}))} className="mt-1" /></div>
            </div>
            <div><Label>Department</Label>
              <Select value={form.department_id} onValueChange={v=>setForm(p=>({...p,department_id:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select department..." /></SelectTrigger>
                <SelectContent>{departments.map(d=><SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Media Type</Label>
              <Select value={form.media_type} onValueChange={v=>setForm(p=>({...p,media_type:v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(allowedTypes === "audio" || allowedTypes === "both") && <SelectItem value="audio">Audio</SelectItem>}
                  {(allowedTypes === "video" || allowedTypes === "both") && <SelectItem value="video">Video</SelectItem>}
                  {allowedTypes === "none" && <SelectItem value="audio">Audio</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Upload File</Label>
              <Input type="file" accept={form.media_type === "audio" ? "audio/*" : "video/*"} onChange={handleFileUpload} className="mt-1" disabled={uploading} />
              {uploading && <p className="text-xs text-primary mt-1">Uploading...</p>}
              {form.file_url && <p className="text-xs text-green-600 mt-1 truncate">Uploaded: {form.file_url}</p>}
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} className="mt-1" /></div>
            <div><Label>Tags</Label><Input value={form.tags} onChange={e=>setForm(p=>({...p,tags:e.target.value}))} placeholder="faith, worship, ..." className="mt-1" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground" disabled={uploading}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}