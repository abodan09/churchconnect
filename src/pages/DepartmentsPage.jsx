import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Layers, Mic2, Video, Music } from "lucide-react";
import { useOutletContext } from "react-router-dom";

const EMPTY = { name: "", description: "", head_name: "", media_upload_enabled: false, allowed_media_types: "none", is_active: true };
const MEDIA_OPTS = [{ value: "audio", label: "Audio only" }, { value: "video", label: "Video only" }, { value: "both", label: "Audio and Video" }];

export default function DepartmentsPage() {
  const { user } = useOutletContext() || {};
  const [departments, setDepartments] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = user?.role === "super_admin" || user?.role === "admin";

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const d = await base44.entities.Department.list("-created_date", 200);
    setDepartments(d); setLoading(false);
  }

  function openNew() { setForm(EMPTY); setEditId(null); setOpen(true); }
  function openEdit(d) { setForm({ ...d }); setEditId(d.id); setOpen(true); }

  async function handleSave() {
    if (editId) await base44.entities.Department.update(editId, form);
    else await base44.entities.Department.create(form);
    setOpen(false); loadData();
  }

  async function handleDelete(id) {
    if (confirm("Delete this department? This cannot be undone.")) {
      await base44.entities.Department.delete(id); loadData();
    }
  }

  async function toggleActive(dept) {
    await base44.entities.Department.update(dept.id, { is_active: !dept.is_active });
    loadData();
  }

  async function toggleMedia(dept) {
    const enabled = !dept.media_upload_enabled;
    await base44.entities.Department.update(dept.id, {
      media_upload_enabled: enabled,
      allowed_media_types: enabled ? (dept.allowed_media_types === "none" ? "both" : dept.allowed_media_types) : "none"
    });
    loadData();
  }

  async function updateMediaType(deptId, v) {
    await base44.entities.Department.update(deptId, { allowed_media_types: v });
    loadData();
  }

  const MEDIA_ICON = { audio: Mic2, video: Video, both: Music, none: Layers };
  const MEDIA_COLOR = { audio: "text-purple-600", video: "text-blue-600", both: "text-green-600", none: "text-muted-foreground" };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Departments</h1><p className="text-muted-foreground text-sm">{departments.length} departments</p></div>
        {isSuperAdmin && <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />New Department</Button>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {departments.map(dept => {
          const MediaIcon = MEDIA_ICON[dept.allowed_media_types] || Layers;
          return (
            <div key={dept.id} className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{dept.name}</h3>
                  {dept.description && <p className="text-muted-foreground text-sm mt-0.5">{dept.description}</p>}
                  {dept.head_name && <p className="text-xs text-primary mt-1 font-medium">Head: {dept.head_name}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${dept.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {dept.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="border-t border-border pt-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MediaIcon className={`w-4 h-4 ${MEDIA_COLOR[dept.allowed_media_types]}`} />
                    Sermon Upload
                  </div>
                  {isSuperAdmin && <Switch checked={!!dept.media_upload_enabled} onCheckedChange={() => toggleMedia(dept)} />}
                </div>
                {dept.media_upload_enabled ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Type:</span>
                    {isSuperAdmin ? (
                      <Select value={dept.allowed_media_types} onValueChange={v => updateMediaType(dept.id, v)}>
                        <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MEDIA_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs capitalize text-primary font-medium">{dept.allowed_media_types}</span>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Media upload disabled</p>
                )}
              </div>

              {isSuperAdmin && (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openEdit(dept)}><Edit className="w-3.5 h-3.5 mr-1" />Edit</Button>
                  <Button variant="outline" size="sm" onClick={() => toggleActive(dept)} className={dept.is_active ? "text-amber-600 border-amber-200" : "text-green-600 border-green-200"}>
                    {dept.is_active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(dept.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              )}
            </div>
          );
        })}
        {departments.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">No departments yet. {isSuperAdmin && "Create one above."}</div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Department</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div><Label>Department Name</Label><Input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="mt-1" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} className="mt-1" /></div>
            <div><Label>Department Head Name</Label><Input value={form.head_name} onChange={e=>setForm(p=>({...p,head_name:e.target.value}))} className="mt-1" /></div>
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <Label>Enable Sermon Upload</Label>
              <Switch checked={!!form.media_upload_enabled} onCheckedChange={v=>setForm(p=>({...p,media_upload_enabled:v,allowed_media_types:v?p.allowed_media_types||"both":"none"}))} />
            </div>
            {form.media_upload_enabled && (
              <div><Label>Allowed Media Types</Label>
                <Select value={form.allowed_media_types} onValueChange={v=>setForm(p=>({...p,allowed_media_types:v}))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MEDIA_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <Label>Active</Label>
              <Switch checked={!!form.is_active} onCheckedChange={v=>setForm(p=>({...p,is_active:v}))} />
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