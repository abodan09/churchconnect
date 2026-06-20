import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import StatCard from "@/components/StatCard";
import { Receipt } from "lucide-react";

const EMPTY = { date: "", category: "", description: "", amount: "", department_id: "", department_name: "", notes: "", receipt_url: "" };
const CATS = ["utilities","salaries","maintenance","outreach","events","equipment","welfare","administration","other"];
const STATUS_COLOR = { pending: "bg-amber-100 text-amber-700", approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-700" };

export default function ExpenditurePage() {
  const { user } = useAuth();
  const [expenditures, setExpenditures] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [e, d] = await Promise.all([entities.Expenditure.list("-date", 500), entities.Department.filter({ is_active: true })]);
    setExpenditures(e); setDepartments(d); setLoading(false);
  }

  function openNew() { setForm(EMPTY); setEditId(null); setOpen(true); }
  function openEdit(e) { setForm({ ...e, amount: String(e.amount) }); setEditId(e.id); setOpen(true); }

  async function handleSave() {
    const dept = departments.find(d => d.id === form.department_id);
    const data = { ...form, amount: parseFloat(form.amount) || 0, department_name: dept?.name || form.department_name };
    if (editId) await entities.Expenditure.update(editId, data);
    else await entities.Expenditure.create({ ...data, approval_status: "pending" });
    setOpen(false); loadData();
  }

  async function handleApprove(id, status) {
    if (!canApprove) return;
    await entities.Expenditure.update(id, { approval_status: status, approved_by: user?.full_name, approved_date: new Date().toISOString().split("T")[0] });
    loadData();
  }

  async function handleDelete(id) {
    if (!["super_admin", "pastor_admin"].includes(user?.data?.role)) return;
    if (confirm("Delete this record?")) { await entities.Expenditure.delete(id); loadData(); }
  }

  const canApprove = ["super_admin","pastor_admin","department_head"].includes(user?.data?.role);

  const filtered = expenditures.filter(e => {
    const match = (e.description || "").toLowerCase().includes(search.toLowerCase()) || (e.category || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || e.approval_status === statusFilter;
    return match && matchStatus;
  });

  const fmt = n => `€${Number(n||0).toLocaleString("en",{minimumFractionDigits:2})}`;
  const approved = expenditures.filter(e=>e.approval_status==="approved").reduce((s,e)=>s+(e.amount||0),0);
  const pending = expenditures.filter(e=>e.approval_status==="pending").reduce((s,e)=>s+(e.amount||0),0);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Expenditures</h1><p className="text-muted-foreground text-sm">{expenditures.length} records</p></div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />Add Expenditure</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard title="Approved Total" value={fmt(approved)} icon={Receipt} color="green" />
        <StatCard title="Pending Approval" value={fmt(pending)} icon={Receipt} color="amber" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>{["Date","Category","Description","Amount","Department","Status","Approved By","Actions"].map(h=><th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((e,i)=>(
                <tr key={e.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                  <td className="px-4 py-3 text-muted-foreground">{e.date}</td>
                  <td className="px-4 py-3 capitalize">{e.category}</td>
                  <td className="px-4 py-3 font-medium">{e.description}</td>
                  <td className="px-4 py-3 font-semibold text-destructive">{fmt(e.amount)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.department_name||"—"}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[e.approval_status]||""}`}>{e.approval_status}</span></td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{e.approved_by||"—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {canApprove && e.approval_status==="pending" && <>
                        <Button variant="ghost" size="icon" title="Approve" onClick={()=>handleApprove(e.id,"approved")}><CheckCircle className="w-4 h-4 text-green-600" /></Button>
                        <Button variant="ghost" size="icon" title="Reject" onClick={()=>handleApprove(e.id,"rejected")}><XCircle className="w-4 h-4 text-destructive" /></Button>
                      </>}
                      <Button variant="ghost" size="icon" onClick={()=>openEdit(e)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={()=>handleDelete(e.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length===0&&<tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId?"Edit":"Add"} Expenditure</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div><Label>Date</Label><Input type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))} className="mt-1" /></div>
            <div><Label>Amount (GHS)</Label><Input type="number" value={form.amount} onChange={e=>setForm(p=>({...p,amount:e.target.value}))} className="mt-1" /></div>
            <div className="col-span-2"><Label>Description</Label><Input value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} className="mt-1" /></div>
            <div><Label>Category</Label>
              <Select value={form.category} onValueChange={v=>setForm(p=>({...p,category:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{CATS.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Department</Label>
              <Select value={form.department_id} onValueChange={v=>setForm(p=>({...p,department_id:v}))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>{departments.map(d=><SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Receipt URL</Label><Input value={form.receipt_url} onChange={e=>setForm(p=>({...p,receipt_url:e.target.value}))} className="mt-1" /></div>
            <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="mt-1" /></div>
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
