import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, Building2 } from "lucide-react";
import StatCard from "@/components/StatCard";

const EMPTY = { type: "", name: "", description: "", location_or_serial: "", purchase_date: "", purchase_value: "", current_condition: "good", assigned_department_id: "", assigned_department_name: "", maintenance_notes: "" };
const TYPES = ["building","land","vehicle","equipment","furniture","electronics","other"];
const CONDITIONS = ["excellent","good","fair","poor","decommissioned"];
const COND_COLOR = { excellent:"bg-green-100 text-green-700", good:"bg-blue-100 text-blue-700", fair:"bg-amber-100 text-amber-700", poor:"bg-red-100 text-red-700", decommissioned:"bg-gray-100 text-gray-700" };

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [p, d] = await Promise.all([base44.entities.Property.list("-created_date", 300), base44.entities.Department.filter({ is_active: true })]);
    setProperties(p); setDepartments(d); setLoading(false);
  }

  function openNew() { setForm(EMPTY); setEditId(null); setOpen(true); }
  function openEdit(p) { setForm({ ...p, purchase_value: String(p.purchase_value || "") }); setEditId(p.id); setOpen(true); }

  async function handleSave() {
    const dept = departments.find(d => d.id === form.assigned_department_id);
    const data = { ...form, purchase_value: parseFloat(form.purchase_value) || 0, assigned_department_name: dept?.name || "" };
    if (editId) await base44.entities.Property.update(editId, data);
    else await base44.entities.Property.create(data);
    setOpen(false); loadData();
  }

  async function handleDelete(id) {
    if (confirm("Delete this property?")) { await base44.entities.Property.delete(id); loadData(); }
  }

  const filtered = properties.filter(p => {
    const match = (p.name || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || p.type === typeFilter;
    return match && matchType;
  });

  const fmt = n => `€${Number(n||0).toLocaleString("en",{minimumFractionDigits:2})}`;
  const totalValue = properties.reduce((s,p)=>s+(p.purchase_value||0),0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Church Properties</h1><p className="text-muted-foreground text-sm">{properties.length} assets registered</p></div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />Add Property</Button>
      </div>

      <StatCard title="Total Asset Value" value={fmt(totalValue)} icon={Building2} color="green" sub={`${properties.length} assets across all departments`} />

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search properties..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {TYPES.map(t=><SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>{["Name","Type","Location/Serial","Purchase Date","Value","Condition","Department","Actions"].map(h=><th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((p,i)=>(
                <tr key={p.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3 capitalize text-muted-foreground">{p.type}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.location_or_serial||"—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.purchase_date||"—"}</td>
                  <td className="px-4 py-3 font-semibold">{fmt(p.purchase_value)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${COND_COLOR[p.current_condition]||""}`}>{p.current_condition}</span></td>
                  <td className="px-4 py-3 text-muted-foreground">{p.assigned_department_name||"—"}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={()=>openEdit(p)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={()=>handleDelete(p.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div></td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No properties found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId?"Edit":"Add"} Property</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2"><Label>Name</Label><Input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} className="mt-1" /></div>
            <div><Label>Type</Label>
              <Select value={form.type} onValueChange={v=>setForm(p=>({...p,type:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{TYPES.map(t=><SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Condition</Label>
              <Select value={form.current_condition} onValueChange={v=>setForm(p=>({...p,current_condition:v}))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CONDITIONS.map(c=><SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Purchase Date</Label><Input type="date" value={form.purchase_date} onChange={e=>setForm(p=>({...p,purchase_date:e.target.value}))} className="mt-1" /></div>
            <div><Label>Purchase Value (GHS)</Label><Input type="number" value={form.purchase_value} onChange={e=>setForm(p=>({...p,purchase_value:e.target.value}))} className="mt-1" /></div>
            <div className="col-span-2"><Label>Location / Serial Number</Label><Input value={form.location_or_serial} onChange={e=>setForm(p=>({...p,location_or_serial:e.target.value}))} className="mt-1" /></div>
            <div className="col-span-2"><Label>Department</Label>
              <Select value={form.assigned_department_id} onValueChange={v=>setForm(p=>({...p,assigned_department_id:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{departments.map(d=><SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} className="mt-1" /></div>
            <div className="col-span-2"><Label>Maintenance Notes</Label><Input value={form.maintenance_notes} onChange={e=>setForm(p=>({...p,maintenance_notes:e.target.value}))} className="mt-1" /></div>
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