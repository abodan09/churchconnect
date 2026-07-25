import { useState, useEffect } from "react";
import { entities, uploadReceipt, getReceiptUrl } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, CheckCircle, XCircle, Paperclip, Eye } from "lucide-react";
import StatCard from "@/components/StatCard";
import { Receipt } from "lucide-react";

const EMPTY = { date: "", category: "", description: "", amount: "", department_id: "", department_name: "", notes: "", receipt_url: "", receipt_key: "" };
const FINANCE_ROLES = ["finance_officer", "pastor_admin", "super_admin"];
// Must match the cloud presign allowlist (api/r2-presign.js RECEIPT_TYPES + RECEIPT_MAX)
// so an unsupported/oversize file is rejected here instead of silently failing to sync.
const RECEIPT_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "application/pdf"]);
const RECEIPT_MAX = 25 * 1024 * 1024;
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
  const [uploading, setUploading] = useState(false);
  const [receiptDirty, setReceiptDirty] = useState(false); // freshly uploaded, not yet saved

  const canReceipts = FINANCE_ROLES.includes(user?.data?.role);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [e, d] = await Promise.all([entities.Expenditure.list("-date", 500), entities.Department.filter({ is_active: true })]);
    setExpenditures(e); setDepartments(d); setLoading(false);
  }

  function openNew() { setForm(EMPTY); setEditId(null); setReceiptDirty(false); setOpen(true); }
  function openEdit(e) { setForm({ ...e, amount: String(e.amount) }); setEditId(e.id); setReceiptDirty(false); setOpen(true); }

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

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after a rejection
    if (!file) return;
    // Validate up front so an unsupported/oversize file is never staged then silently
    // dropped on sync (the cloud presign would 415/413 it).
    const type = file.type || "";
    if (!RECEIPT_MIME.has(type)) { alert("Unsupported file. Attach a photo (JPG/PNG/WEBP/GIF/HEIC) or a PDF."); return; }
    if (file.size > RECEIPT_MAX) { alert("Receipt is too large (max 25 MB)."); return; }
    setUploading(true);
    try {
      const r = await uploadReceipt(file);
      // web → { receipt_key }; desktop → { receipt_staging_url } (key minted on sync)
      setForm(p => ({ ...p, receipt_key: r.receipt_key || "", receipt_url: r.receipt_staging_url || "" }));
      setReceiptDirty(true);
    } catch (err) {
      alert(err?.message || "Receipt upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleViewReceipt(row) {
    if (!canReceipts) return;
    // Open the tab synchronously (inside the user gesture) so the async URL
    // resolution below can't get the popup blocked, then navigate it. Can't pass
    // "noopener" here (that returns null), so sever the opener manually instead.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
    try {
      const url = await getReceiptUrl(row);
      if (!url) { if (tab) tab.close(); alert("No receipt attached."); return; }
      if (tab) tab.location = url; else window.location.href = url;
    } catch (err) {
      if (tab) tab.close();
      alert(err?.message || "Could not open the receipt.");
    }
  }
  const hasReceipt = (r) => !!(r?.receipt_key || r?.receipt_url);

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
                      {canReceipts && hasReceipt(e) && <Button variant="ghost" size="icon" title="View receipt" onClick={()=>handleViewReceipt(e)}><Eye className="w-4 h-4 text-blue-600" /></Button>}
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
            <div className="col-span-2">
              <Label>Receipt {!canReceipts && <span className="text-xs text-muted-foreground font-normal">(finance access only)</span>}</Label>
              {canReceipts ? (
                <div className="mt-1 flex items-center gap-2">
                  <input id="receipt-file" type="file" accept="image/*,application/pdf" className="hidden" onChange={handleReceiptUpload} />
                  <Button type="button" variant="outline" size="sm" className="gap-2" disabled={uploading} onClick={()=>document.getElementById("receipt-file")?.click()}>
                    <Paperclip className="w-4 h-4" />{uploading ? "Uploading…" : (hasReceipt(form) ? "Replace receipt" : "Attach receipt")}
                  </Button>
                  {hasReceipt(form) && !receiptDirty && (
                    <Button type="button" variant="ghost" size="sm" className="gap-2" onClick={()=>handleViewReceipt(form)}>
                      <Eye className="w-4 h-4" />View
                    </Button>
                  )}
                  {hasReceipt(form) && (
                    <span className="text-xs text-green-600">{receiptDirty ? "attached — save to view" : "attached"}</span>
                  )}
                </div>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">{hasReceipt(form) ? "A receipt is attached." : "No receipt."}</p>
              )}
            </div>
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
