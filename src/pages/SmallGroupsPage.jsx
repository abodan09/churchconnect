import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Edit, Trash2, Users, UserPlus, X } from "lucide-react";

const GROUP_TYPES = ["bible_study","prayer","outreach","youth","women","men","couples","family","general"];
const FREQUENCIES = ["weekly","biweekly","monthly","irregular"];
const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

const EMPTY_GROUP = { name:"", type:"bible_study", description:"", leader_name:"", co_leader_name:"", meeting_day:"", meeting_time:"", meeting_frequency:"weekly", location:"", max_capacity:"", is_open:true, is_active:true, notes:"" };

const TYPE_COLOR = {
  bible_study:"bg-blue-100 text-blue-700", prayer:"bg-purple-100 text-purple-700",
  outreach:"bg-green-100 text-green-700", youth:"bg-orange-100 text-orange-700",
  women:"bg-pink-100 text-pink-700", men:"bg-indigo-100 text-indigo-700",
  couples:"bg-rose-100 text-rose-700", family:"bg-amber-100 text-amber-700",
  general:"bg-gray-100 text-gray-700",
};

export default function SmallGroupsPage() {
  const { user } = useAuth();
  const role = user?.role || "member";
  const canManage = ["super_admin","pastor_admin","department_head"].includes(role);

  const [groups, setGroups] = useState([]);
  const [members, setMembers] = useState([]);
  const [groupMembers, setGroupMembers] = useState([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const [groupOpen, setGroupOpen] = useState(false);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);
  const [editGroupId, setEditGroupId] = useState(null);

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [addMemberForm, setAddMemberForm] = useState({ member_id:"", role:"member", joined_date:"" });

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [g, m, gm] = await Promise.all([
      entities.SmallGroup.list("-createdAt", 500),
      entities.Member.filter({ membership_status:"active" }),
      entities.SmallGroupMember.filter({ is_active:true }),
    ]);
    setGroups(g); setMembers(m); setGroupMembers(gm);
    setLoading(false);
  }

  function openNewGroup() { setGroupForm(EMPTY_GROUP); setEditGroupId(null); setGroupOpen(true); }
  function openEditGroup(g) { setGroupForm({ ...g, max_capacity: g.max_capacity ?? "" }); setEditGroupId(g.id); setGroupOpen(true); }

  async function saveGroup() {
    const data = { ...groupForm, max_capacity: groupForm.max_capacity ? Number(groupForm.max_capacity) : null };
    if (editGroupId) await entities.SmallGroup.update(editGroupId, data);
    else await entities.SmallGroup.create(data);
    setGroupOpen(false); loadData();
  }

  async function deleteGroup(id) {
    if (!confirm("Delete this small group?")) return;
    await entities.SmallGroup.delete(id);
    loadData();
  }

  function openManageMembers(group) { setSelectedGroup(group); setAddMemberForm({ member_id:"", role:"member", joined_date:"" }); setMemberModalOpen(true); }

  async function addMemberToGroup() {
    const member = members.find(m => m.id === addMemberForm.member_id);
    if (!member) return;
    await entities.SmallGroupMember.create({
      group_id: selectedGroup.id, group_name: selectedGroup.name,
      member_id: member.id, member_name: `${member.first_name} ${member.last_name}`,
      role: addMemberForm.role, joined_date: addMemberForm.joined_date || new Date().toISOString().split("T")[0],
    });
    setAddMemberForm({ member_id:"", role:"member", joined_date:"" });
    loadData();
  }

  async function removeMemberFromGroup(gmId) {
    if (!confirm("Remove this member from the group?")) return;
    await entities.SmallGroupMember.update(gmId, { is_active: false });
    loadData();
  }

  const gf = (k, v) => setGroupForm(p => ({ ...p, [k]: v }));

  const filtered = groups.filter(g => {
    const matchSearch = g.name.toLowerCase().includes(search.toLowerCase()) || (g.leader_name||"").toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || g.type === typeFilter;
    return matchSearch && matchType;
  });

  const membersOfSelected = selectedGroup ? groupMembers.filter(gm => gm.group_id === selectedGroup.id) : [];
  const memberCountMap = {};
  groupMembers.forEach(gm => { memberCountMap[gm.group_id] = (memberCountMap[gm.group_id] || 0) + 1; });

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Small Groups</h1>
          <p className="text-muted-foreground text-sm">{groups.filter(g => g.is_active).length} active groups · {groupMembers.length} total enrollments</p>
        </div>
        {canManage && <Button onClick={openNewGroup} className="bg-primary text-primary-foreground gap-2"><Plus className="w-4 h-4" />New Group</Button>}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search groups..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {GROUP_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map(g => (
          <div key={g.id} className={`bg-white rounded-xl border border-border shadow-sm p-5 space-y-3 ${!g.is_active ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-foreground">{g.name}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${TYPE_COLOR[g.type] || "bg-gray-100 text-gray-700"}`}>
                  {g.type?.replace(/_/g," ")}
                </span>
              </div>
              {!g.is_active && <Badge variant="outline" className="text-xs">Inactive</Badge>}
            </div>

            {g.description && <p className="text-sm text-muted-foreground line-clamp-2">{g.description}</p>}

            <div className="text-sm space-y-1 text-muted-foreground">
              {g.leader_name && <p><span className="font-medium text-foreground">Leader:</span> {g.leader_name}</p>}
              {g.meeting_day && <p><span className="font-medium text-foreground">Meets:</span> {g.meeting_day}{g.meeting_time ? ` at ${g.meeting_time}` : ""} ({g.meeting_frequency})</p>}
              {g.location && <p><span className="font-medium text-foreground">Location:</span> {g.location}</p>}
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="w-4 h-4" />
                <span>{memberCountMap[g.id] || 0}{g.max_capacity ? ` / ${g.max_capacity}` : ""} members</span>
                {g.is_open && <Badge className="text-xs bg-green-100 text-green-700 border-0">Open</Badge>}
              </div>
              {canManage && (
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" title="Manage Members" onClick={() => openManageMembers(g)}>
                    <UserPlus className="w-4 h-4 text-primary" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEditGroup(g)}><Edit className="w-4 h-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteGroup(g.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">No small groups found.</div>
        )}
      </div>

      {/* Group CRUD Dialog */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editGroupId ? "Edit Group" : "New Small Group"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            <div className="sm:col-span-2">
              <Label>Group Name *</Label>
              <Input value={groupForm.name} onChange={e => gf("name", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={groupForm.type} onValueChange={v => gf("type", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{GROUP_TYPES.map(t => <SelectItem key={t} value={t}>{t.replace(/_/g," ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meeting Frequency</Label>
              <Select value={groupForm.meeting_frequency} onValueChange={v => gf("meeting_frequency", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{FREQUENCIES.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Leader Name</Label>
              <Input value={groupForm.leader_name} onChange={e => gf("leader_name", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Co-Leader Name</Label>
              <Input value={groupForm.co_leader_name} onChange={e => gf("co_leader_name", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Meeting Day</Label>
              <Select value={groupForm.meeting_day} onValueChange={v => gf("meeting_day", v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select day..." /></SelectTrigger>
                <SelectContent>{DAYS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meeting Time</Label>
              <Input value={groupForm.meeting_time} onChange={e => gf("meeting_time", e.target.value)} placeholder="e.g. 6:00 PM" className="mt-1" />
            </div>
            <div>
              <Label>Location</Label>
              <Input value={groupForm.location} onChange={e => gf("location", e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Max Capacity</Label>
              <Input value={groupForm.max_capacity} onChange={e => gf("max_capacity", e.target.value)} type="number" min="1" className="mt-1" />
            </div>
            <div className="sm:col-span-2">
              <Label>Description</Label>
              <Input value={groupForm.description} onChange={e => gf("description", e.target.value)} className="mt-1" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={groupForm.is_active} onChange={e => gf("is_active", e.target.checked)} className="rounded" />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={groupForm.is_open} onChange={e => gf("is_open", e.target.checked)} className="rounded" />
                Open for new members
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setGroupOpen(false)}>Cancel</Button>
            <Button onClick={saveGroup} className="bg-primary text-primary-foreground">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manage Members Dialog */}
      <Dialog open={memberModalOpen} onOpenChange={setMemberModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Members — {selectedGroup?.name}</DialogTitle></DialogHeader>
          <Tabs defaultValue="current">
            <TabsList className="w-full"><TabsTrigger value="current" className="flex-1">Current Members</TabsTrigger><TabsTrigger value="add" className="flex-1">Add Member</TabsTrigger></TabsList>
            <TabsContent value="current" className="space-y-2 mt-3">
              {membersOfSelected.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">No members yet.</p>
              ) : (
                membersOfSelected.map(gm => (
                  <div key={gm.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{gm.member_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{gm.role} · Joined {gm.joined_date || "—"}</p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => removeMemberFromGroup(gm.id)}><X className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))
              )}
            </TabsContent>
            <TabsContent value="add" className="space-y-4 mt-3">
              <div>
                <Label>Member</Label>
                <Select value={addMemberForm.member_id} onValueChange={v => setAddMemberForm(p => ({ ...p, member_id:v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select member..." /></SelectTrigger>
                  <SelectContent>{members.map(m => <SelectItem key={m.id} value={m.id}>{m.first_name} {m.last_name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Role in Group</Label>
                <Select value={addMemberForm.role} onValueChange={v => setAddMemberForm(p => ({ ...p, role:v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="leader">Leader</SelectItem>
                    <SelectItem value="co_leader">Co-Leader</SelectItem>
                    <SelectItem value="member">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Joined Date</Label>
                <Input type="date" value={addMemberForm.joined_date} onChange={e => setAddMemberForm(p => ({ ...p, joined_date:e.target.value }))} className="mt-1" />
              </div>
              <Button onClick={addMemberToGroup} className="w-full bg-primary text-primary-foreground" disabled={!addMemberForm.member_id}>Add to Group</Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
