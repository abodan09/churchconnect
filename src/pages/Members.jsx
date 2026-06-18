import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, UserCheck } from "lucide-react";

const EMPTY = { first_name: "", last_name: "", email: "", phone: "", address: "", department_id: "", department_name: "", join_date: "", membership_status: "active", gender: "", occupation: "", notes: "" };
const STATUS_COLOR = { active: "bg-green-100 text-green-700", inactive: "bg-red-100 text-red-700", visitor: "bg-amber-100 text-amber-700" };

export default function Members() {
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [m, d] = await Promise.all([base44.entities.Member.list("-created_date", 500), base44.entities.Department.filter({ is_active: true })]);
    setMembers(m); setDepartments(d); setLoading(false);
  }

  function openNew() { setForm(EMPTY); setEditId(null); setOpen(true); }
  function openEdit(m) { setForm({ ...m }); setEditId(m.id); setOpen(true); }

  async function handleSave() {
    const dept = departments.find(d => d.id === form.department_id);
    const data = { ...form, department_name: dept?.name || "" };
    if (editId) await base44.entities.Member.update(editId, data);
    else await base44.entities.Member.create(data);
    setOpen(false); loadData();
  }

  async function handleDelete(id) {
    if (confirm("Delete this member?")) { await base44.entities.Member.delete(id); loadData(); }
  }

  const filtered = members.filter(m => {
    const name = `${m.first_name} ${m.last_name}`.toLowerCase();
    const matchSearch = name.includes(search.toLowerCase()) || (m.email || "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || m.membership_status === statusFilter;
    const matchDept = deptFilter === "all" || m.department_id === deptFilter;
    return matchSearch && matchStatus && matchDept;
  });

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-muted-foreground text-sm">{members.length} total members</p>
        </div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />Add Member</Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="visitor">Visitor</SelectItem>
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Name", "Email", "Phone", "Department", "Status", "Joined", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                  <td className="px-4 py-3 font-medium">{m.first_name} {m.last_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.phone}</td>
                  <td className="px-4 py-3 text-muted-foreground">{m.department_name || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[m.membership_status] || "bg-gray-100 text-gray-700"}`}>{m.membership_status}</span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.join_date}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No members found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit Member" : "Add Member"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {[["first_name","First Name"],["last_name","Last Name"],["email","Email"],["phone","Phone"],["address","Address"],["occupation","Occupation"],["join_date","Join Date"],["notes","Notes"]].map(([k, label]) => (
              <div key={k} className={k === "address" || k === "notes" ? "sm:col-span-2" : ""}>
                <Label>{label}</Label>
                <Input value={form[k] || ""} onChange={e => f(k, e.target.value)} type={k === "join_date" ? "date" : "text"} className="mt-1" />
              </div>
            ))}
            <div>
              <Label>Status</Label>
              <Select value={form.membership_status} onValueChange={v => f("membership_status", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="visitor">Visitor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Department</Label>
              <Select value={form.department_id} onValueChange={v => f("department_id", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gender</Label>
              <Select value={form.gender} onValueChange={v => f("gender", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground">Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}