import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Layers, Mic2, Video, Music, Users, UserCog, X } from "lucide-react";
import { useOutletContext } from "react-router-dom";

const EMPTY = {
  name: "", description: "", head_name: "", head_user_id: "", color: "#6366f1",
  media_upload_enabled: false, allowed_media_types: "none", is_active: true, allowed_features: "",
};

const MEDIA_OPTS = [
  { value: "audio", label: "Audio only" },
  { value: "video", label: "Video only" },
  { value: "both", label: "Audio and Video" },
];

const ALL_FEATURES = [
  { key: "members", label: "Members" },
  { key: "giving", label: "Giving" },
  { key: "expenditures", label: "Expenditures" },
  { key: "properties", label: "Properties" },
  { key: "sermons", label: "Sermons" },
  { key: "events", label: "Events" },
  { key: "attendance", label: "Attendance" },
  { key: "attendance-analytics", label: "Attendance Analytics" },
  { key: "volunteers", label: "Volunteers" },
  { key: "small-groups", label: "Small Groups" },
  { key: "pastoral-care", label: "Pastoral Care" },
  { key: "announcements", label: "Announcements" },
  { key: "reports", label: "Financial Reports" },
];

const DEFAULT_FEATURES = "events,attendance,sermons,announcements,small-groups,volunteers";

const COLORS = ["#6366f1","#8b5cf6","#ec4899","#ef4444","#f97316","#eab308","#22c55e","#14b8a6","#3b82f6","#64748b"];

export default function DepartmentsPage() {
  const { user } = useOutletContext() || {};
  const [departments, setDepartments] = useState([]);
  const [staffUsers, setStaffUsers] = useState([]);    // UserProfile records with role != member
  const [allMembers, setAllMembers] = useState([]);
  const [deptMembers, setDeptMembers] = useState([]);  // members for selected dept in member tab
  const [open, setOpen] = useState(false);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editId, setEditId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [addMemberId, setAddMemberId] = useState("");

  const isSuperAdmin = ["super_admin"].includes(user?.role);
  const canManage = ["super_admin", "pastor_admin"].includes(user?.role);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [d, m] = await Promise.all([
      entities.Department.list("-createdAt", 200),
      entities.Member.list("-createdAt", 1000),
    ]);
    setDepartments(d);
    setAllMembers(m);
    setLoading(false);
  }

  function openNew() {
    setForm({ ...EMPTY, allowed_features: DEFAULT_FEATURES });
    setEditId(null);
    setOpen(true);
  }

  function openEdit(d) {
    setForm({
      name: d.name || "",
      description: d.description || "",
      head_name: d.head_name || "",
      head_user_id: d.head_user_id || "",
      color: d.color || "#6366f1",
      media_upload_enabled: !!d.media_upload_enabled,
      allowed_media_types: d.allowed_media_types || "none",
      is_active: d.is_active !== false,
      allowed_features: d.allowed_features || DEFAULT_FEATURES,
    });
    setEditId(d.id);
    setOpen(true);
  }

  async function handleSave() {
    if (editId) await entities.Department.update(editId, form);
    else await entities.Department.create(form);

    // If a head user was selected, update their UserProfile
    if (form.head_user_id) {
      try {
        const profiles = await entities.UserProfile.filter({ clerkId: form.head_user_id });
        const deptId = editId || ""; // will be set after creation
        if (profiles.length) {
          await entities.UserProfile.update(profiles[0].id, { role: "department_head", departmentId: deptId });
        }
      } catch {}
    }

    setOpen(false);
    loadData();
  }

  async function handleDelete(id) {
    if (confirm("Delete this department? This cannot be undone.")) {
      await entities.Department.delete(id);
      loadData();
    }
  }

  async function toggleActive(dept) {
    await entities.Department.update(dept.id, { is_active: !dept.is_active });
    loadData();
  }

  function openManageMembers(dept) {
    setSelectedDept(dept);
    setDeptMembers(allMembers.filter(m => m.department_id === dept.id));
    setAddMemberId("");
    setMemberModalOpen(true);
  }

  async function addMemberToDept() {
    const member = allMembers.find(m => m.id === addMemberId);
    if (!member || !selectedDept) return;
    await entities.Member.update(member.id, {
      department_id: selectedDept.id,
      department_name: selectedDept.name,
    });
    setAddMemberId("");
    const updated = await entities.Member.list("-createdAt", 1000);
    setAllMembers(updated);
    setDeptMembers(updated.filter(m => m.department_id === selectedDept.id));
  }

  async function removeMemberFromDept(memberId) {
    await entities.Member.update(memberId, { department_id: null, department_name: "" });
    const updated = await entities.Member.list("-createdAt", 1000);
    setAllMembers(updated);
    setDeptMembers(updated.filter(m => m.department_id === selectedDept?.id));
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  function toggleFeature(key) {
    const current = (form.allowed_features || "").split(",").filter(Boolean);
    const next = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    f("allowed_features", next.join(","));
  }

  const selectedFeatures = (form.allowed_features || "").split(",").filter(Boolean);

  const MEDIA_ICON = { audio: Mic2, video: Video, both: Music, none: Layers };
  const MEDIA_COLOR = { audio: "text-purple-600", video: "text-blue-600", both: "text-green-600", none: "text-muted-foreground" };

  // members not yet in this dept
  const availableToAdd = allMembers.filter(m => m.department_id !== selectedDept?.id);

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Departments</h1>
          <p className="text-muted-foreground text-sm">{departments.length} departments</p>
        </div>
        {isSuperAdmin && (
          <Button onClick={openNew} className="bg-primary text-primary-foreground gap-2">
            <Plus className="w-4 h-4" />New Department
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {departments.map(dept => {
          const MediaIcon = MEDIA_ICON[dept.allowed_media_types] || Layers;
          const features = (dept.allowed_features || "").split(",").filter(Boolean);
          const memberCount = allMembers.filter(m => m.department_id === dept.id).length;

          return (
            <div key={dept.id} className="bg-white rounded-xl border border-border p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-10 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: dept.color || "#6366f1" }} />
                  <div>
                    <h3 className="font-semibold text-foreground">{dept.name}</h3>
                    {dept.description && <p className="text-muted-foreground text-sm mt-0.5 line-clamp-2">{dept.description}</p>}
                    {dept.head_name && <p className="text-xs text-primary mt-1 font-medium">Head: {dept.head_name}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Users className="w-3 h-3" />{memberCount} members</p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${dept.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                  {dept.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {/* Enabled features */}
              {features.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {features.slice(0, 5).map(k => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{k.replace(/-/g," ")}</span>
                  ))}
                  {features.length > 5 && <span className="text-xs text-muted-foreground">+{features.length - 5} more</span>}
                </div>
              )}

              <div className="border-t border-border pt-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <MediaIcon className={`w-4 h-4 ${MEDIA_COLOR[dept.allowed_media_types]}`} />
                    Sermon Upload
                  </div>
                  <span className={`text-xs ${dept.media_upload_enabled ? "text-green-600" : "text-muted-foreground"}`}>
                    {dept.media_upload_enabled ? `Enabled · ${dept.allowed_media_types}` : "Disabled"}
                  </span>
                </div>
              </div>

              {canManage && (
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => openManageMembers(dept)}>
                    <Users className="w-3.5 h-3.5 mr-1" />Members
                  </Button>
                  {isSuperAdmin && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => openEdit(dept)}><Edit className="w-3.5 h-3.5" /></Button>
                      <Button variant="outline" size="sm" onClick={() => toggleActive(dept)} className={dept.is_active ? "text-amber-600 border-amber-200" : "text-green-600 border-green-200"}>
                        {dept.is_active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(dept.id)} className="text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {departments.length === 0 && (
          <div className="col-span-3 text-center py-16 text-muted-foreground">
            No departments yet. {isSuperAdmin && "Create one above."}
          </div>
        )}
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editId ? "Edit" : "New"} Department</DialogTitle></DialogHeader>

          <Tabs defaultValue="info">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">Info & Head</TabsTrigger>
              <TabsTrigger value="features" className="flex-1">Dashboard Features</TabsTrigger>
              <TabsTrigger value="media" className="flex-1">Media</TabsTrigger>
            </TabsList>

            {/* ── Info & Head ── */}
            <TabsContent value="info" className="space-y-4 mt-4">
              <div>
                <Label>Department Name *</Label>
                <Input value={form.name} onChange={e => f("name", e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Description</Label>
                <Input value={form.description} onChange={e => f("description", e.target.value)} className="mt-1" />
              </div>

              <div>
                <Label>Department Head Name</Label>
                <Input value={form.head_name} onChange={e => f("head_name", e.target.value)}
                  placeholder="Type head's name" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  The head must also have a user account. Enter their name here so it appears on the card.
                </p>
              </div>

              <div>
                <Label>Head's User Clerk ID (optional)</Label>
                <Input value={form.head_user_id} onChange={e => f("head_user_id", e.target.value)}
                  placeholder="user_2abc..." className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste the head's Clerk user ID to automatically set their role to Department Head.
                  Find it in your Clerk dashboard or from the user's profile URL.
                </p>
              </div>

              <div>
                <Label>Colour Tag</Label>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => f("color", c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <Label>Active</Label>
                <Switch checked={!!form.is_active} onCheckedChange={v => f("is_active", v)} />
              </div>
            </TabsContent>

            {/* ── Dashboard Features ── */}
            <TabsContent value="features" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">
                Choose which menu items and pages are visible to members of this department (department heads and data entry staff assigned here).
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ALL_FEATURES.map(feat => (
                  <label key={feat.key} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${selectedFeatures.includes(feat.key) ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <input
                      type="checkbox"
                      checked={selectedFeatures.includes(feat.key)}
                      onChange={() => toggleFeature(feat.key)}
                      className="rounded"
                    />
                    <span className="text-sm">{feat.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {selectedFeatures.length} of {ALL_FEATURES.length} features enabled
              </p>
            </TabsContent>

            {/* ── Media ── */}
            <TabsContent value="media" className="space-y-4 mt-4">
              <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div>
                  <Label>Enable Sermon Upload</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Allow this department to upload sermon recordings</p>
                </div>
                <Switch
                  checked={!!form.media_upload_enabled}
                  onCheckedChange={v => f("media_upload_enabled", v)}
                />
              </div>
              {form.media_upload_enabled && (
                <div>
                  <Label>Allowed Media Types</Label>
                  <Select value={form.allowed_media_types} onValueChange={v => f("allowed_media_types", v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MEDIA_OPTS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} className="bg-primary text-primary-foreground" disabled={!form.name.trim()}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Member Management Dialog */}
      <Dialog open={memberModalOpen} onOpenChange={setMemberModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedDept?.color || "#6366f1" }} />
              {selectedDept?.name} — Members
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="current">
            <TabsList className="w-full">
              <TabsTrigger value="current" className="flex-1">Current ({deptMembers.length})</TabsTrigger>
              <TabsTrigger value="add" className="flex-1">Add Member</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="space-y-2 mt-3">
              {deptMembers.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">No members assigned yet.</p>
              ) : deptMembers.map(m => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div>
                    <p className="font-medium text-sm">{m.first_name} {m.last_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{m.membership_status} · {m.occupation || m.email || "—"}</p>
                  </div>
                  {canManage && (
                    <Button variant="ghost" size="icon" title="Remove from department" onClick={() => removeMemberFromDept(m.id)}>
                      <X className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </TabsContent>

            <TabsContent value="add" className="space-y-4 mt-3">
              <p className="text-sm text-muted-foreground">Select a member to add to this department.</p>
              <Select value={addMemberId} onValueChange={setAddMemberId}>
                <SelectTrigger><SelectValue placeholder="Search members..." /></SelectTrigger>
                <SelectContent>
                  {availableToAdd.map(m => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.first_name} {m.last_name}
                      {m.department_name ? ` (currently: ${m.department_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={addMemberToDept}
                className="w-full bg-primary text-primary-foreground"
                disabled={!addMemberId}
              >
                Add to {selectedDept?.name}
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
