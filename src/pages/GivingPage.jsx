import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Search, Edit, Trash2, HandCoins } from "lucide-react";
import StatCard from "@/components/StatCard";
import { TrendingUp } from "lucide-react";

const EMPTY = { member_id: "", member_name: "", date: "", amount: "", type: "tithe", payment_method: "cash", service_or_event: "", notes: "" };
const TYPE_LABEL = { tithe: "Tithe", offering: "Offering", special_offering: "Special Offering", thanksgiving: "Thanksgiving", building_fund: "Building Fund" };
const TYPE_COLOR = { tithe: "bg-green-100 text-green-700", offering: "bg-blue-100 text-blue-700", special_offering: "bg-purple-100 text-purple-700", thanksgiving: "bg-amber-100 text-amber-700", building_fund: "bg-red-100 text-red-700" };

export default function GivingPage() {
  const [giving, setGiving] = useState([]);
  const [members, setMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [g, m] = await Promise.all([base44.entities.Giving.list("-date", 500), base44.entities.Member.list("-created_date", 500)]);
    setGiving(g); setMembers(m); setLoading(false);
  }

  function openNew() { setForm(EMPTY); setEditId(null); setMemberSearch(""); setOpen(true); }
  function openEdit(g) { setForm({ ...g, amount: String(g.amount) }); setEditId(g.id); setMemberSearch(g.member_name || ""); setOpen(true); }

  function selectMember(m) {
    setForm(p => ({ ...p, member_id: m.id, member_name: `${m.first_name} ${m.last_name}` }));
    setMemberSearch(`${m.first_name} ${m.last_name}`);
  }

  async function handleSave() {
    const user = await base44.auth.me();
    const data = { ...form, amount: parseFloat(form.amount) || 0, recorded_by: user.full_name };
    if (editId) await base44.entities.Giving.update(editId, data);
    else await base44.entities.Giving.create(data);
    setOpen(false); loadData();
  }

  async function handleDelete(id) {
    if (confirm("Delete this record?")) { await base44.entities.Giving.delete(id); loadData(); }
  }

  const filtered = giving.filter(g => {
    const match = (g.member_name || "").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || g.type === typeFilter;
    return match && matchType;
  });

  const fmt = n => `€${Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`;
  const total = filtered.reduce((s, g) => s + (g.amount || 0), 0);
  const tithes = giving.filter(g => g.type === "tithe").reduce((s, g) => s + (g.amount || 0), 0);
  const offerings = giving.filter(g => g.type === "offering").reduce((s, g) => s + (g.amount || 0), 0);

  const filteredMembers = members.filter(m => `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase())).slice(0, 5);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Giving Records</h1><p className="text-muted-foreground text-sm">{giving.length} records</p></div>
        <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />Record Giving</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Tithes" value={fmt(tithes)} icon={HandCoins} color="green" />
        <StatCard title="Total Offerings" value={fmt(offerings)} icon={TrendingUp} color="blue" />
        <StatCard title="Filtered Total" value={fmt(total)} icon={HandCoins} color="amber" />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by member..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>{["Member","Date","Amount","Type","Method","Service/Event","Recorded By"].map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>)}<th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {filtered.map((g, i) => (
                <tr key={g.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${i%2===0?"":"bg-muted/10"}`}>
                  <td className="px-4 py-3 font-medium">{g.member_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.date}</td>
                  <td className="px-4 py-3 font-semibold text-primary">{fmt(g.amount)}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLOR[g.type]||"bg-gray-100 text-gray-700"}`}>{TYPE_LABEL[g.type]||g.type}</span></td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">{g.payment_method?.replace(/_/g," ")}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.service_or_event}</td>
                  <td className="px-4 py-3 text-muted-foreground">{g.recorded_by}</td>
                  <td className="px-4 py-3"><div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(g)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(g.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div></td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">No records found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "Record"} Giving</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="relative">
              <Label>Member</Label>
              <Input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search member..." className="mt-1" />
              {memberSearch && !form.member_id && filteredMembers.length > 0 && (
                <div className="absolute z-10 bg-white border border-border rounded-lg mt-1 w-full shadow-lg">
                  {filteredMembers.map(m => (
                    <button key={m.id} onClick={() => selectMember(m)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted">{m.first_name} {m.last_name}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm(p=>({...p,date:e.target.value}))} className="mt-1" /></div>
              <div><Label>Amount (GHS)</Label><Input type="number" value={form.amount} onChange={e => setForm(p=>({...p,amount:e.target.value}))} className="mt-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Type</Label>
                <Select value={form.type} onValueChange={v=>setForm(p=>({...p,type:v}))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(TYPE_LABEL).map(([k,v])=><SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Payment Method</Label>
                <Select value={form.payment_method} onValueChange={v=>setForm(p=>({...p,payment_method:v}))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cash","bank_transfer","mobile_money","cheque"].map(m=><SelectItem key={m} value={m}>{m.replace(/_/g," ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Service / Event</Label><Input value={form.service_or_event} onChange={e=>setForm(p=>({...p,service_or_event:e.target.value}))} className="mt-1" /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} className="mt-1" /></div>
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