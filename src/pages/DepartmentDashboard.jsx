import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, CalendarDays, ClipboardCheck, Mic2, X, UserPlus, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import StatCard from "@/components/StatCard";

export default function DepartmentDashboard() {
  const { user } = useAuth();
  const role = user?.role || "member";
  const deptId = user?.data?.department_id;
  const isDeptHead = role === "department_head";

  const [dept, setDept] = useState(null);
  const [members, setMembers] = useState([]);
  const [allMembers, setAllMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [sermons, setSermons] = useState([]);
  const [loading, setLoading] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [addMemberId, setAddMemberId] = useState("");

  useEffect(() => {
    if (deptId) loadAll();
    else setLoading(false);
  }, [deptId]);

  async function loadAll() {
    setLoading(true);
    const [depts, mem, evts, att, ser, allMem] = await Promise.all([
      entities.Department.filter({ id: deptId }),
      entities.Member.filter({ department_id: deptId }),
      entities.Event.filter({ department_id: deptId }),
      entities.Attendance.filter({ department_id: deptId }),
      entities.Sermon.filter({ department_id: deptId }),
      isDeptHead ? entities.Member.list("-createdAt", 1000) : Promise.resolve([]),
    ]);
    setDept(depts[0] || null);
    setMembers(mem);
    setAllMembers(allMem);

    const now = new Date().toISOString();
    setEvents(evts.filter(e => e.start_datetime >= now).sort((a, b) => a.start_datetime.localeCompare(b.start_datetime)).slice(0, 8));
    setAttendance(att);
    setSermons(ser.slice(0, 6));
    setLoading(false);
  }

  async function addMember() {
    const m = allMembers.find(m => m.id === addMemberId);
    if (!m || !dept) return;
    await entities.Member.update(m.id, { department_id: dept.id, department_name: dept.name });
    setAddMemberId("");
    setAddOpen(false);
    loadAll();
  }

  async function removeMember(memberId) {
    if (!confirm("Remove this member from the department?")) return;
    await entities.Member.update(memberId, { department_id: null, department_name: "" });
    loadAll();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  if (!deptId || !dept) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground gap-2">
        <Users className="w-10 h-10 opacity-30" />
        <p className="font-medium">No department assigned</p>
        <p className="text-sm">Ask a super admin to assign you to a department.</p>
      </div>
    );
  }

  const presentCount = attendance.filter(a => a.status === "present").length;
  const attendanceRate = attendance.length ? Math.round((presentCount / attendance.length) * 100) : 0;
  const activeMembers = members.filter(m => m.membership_status === "active").length;

  const available = allMembers.filter(m => m.department_id !== deptId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-3 h-14 rounded-full flex-shrink-0" style={{ backgroundColor: dept.color || "#6366f1" }} />
        <div>
          <h1 className="text-2xl font-bold">{dept.name}</h1>
          {dept.description && <p className="text-muted-foreground text-sm mt-0.5">{dept.description}</p>}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            {dept.head_name && <span className="text-primary font-medium">Head: {dept.head_name}</span>}
            <Badge className={`text-xs border-0 ${dept.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {dept.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Members" value={members.length} icon={Users} color="blue" />
        <StatCard title="Active Members" value={activeMembers} icon={TrendingUp} color="green" />
        <StatCard title="Upcoming Events" value={events.length} icon={CalendarDays} color="amber" />
        <StatCard title="Attendance Rate" value={`${attendanceRate}%`} icon={ClipboardCheck} color="red" />
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
          <TabsTrigger value="sermons">Sermons ({sermons.length})</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-4">
          {isDeptHead && (
            <div className="flex justify-end mb-3">
              <Button onClick={() => setAddOpen(true)} className="gap-2 bg-primary text-primary-foreground" size="sm">
                <UserPlus className="w-4 h-4" />Add Member
              </Button>
            </div>
          )}
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  {["Name", "Status", "Email", "Phone", isDeptHead ? "Remove" : ""].map(h => h && (
                    <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m, i) => (
                  <tr key={m.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${i % 2 ? "bg-muted/10" : ""}`}>
                    <td className="px-4 py-3 font-medium">{m.first_name} {m.last_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs capitalize font-medium
                        ${m.membership_status === "active" ? "bg-green-100 text-green-700"
                          : m.membership_status === "visitor" ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"}`}>
                        {m.membership_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.email || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.phone || "—"}</td>
                    {isDeptHead && (
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="icon" onClick={() => removeMember(m.id)}>
                          <X className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
                {members.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No members in this department yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="mt-4">
          <div className="space-y-3">
            {events.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No upcoming events.</p>
            ) : events.map(e => (
              <div key={e.id} className="bg-white rounded-xl border border-border p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CalendarDays className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{e.title}</p>
                  <p className="text-sm text-muted-foreground">{e.start_datetime ? format(new Date(e.start_datetime), "EEE, MMM d · h:mm a") : ""}</p>
                  {e.location && <p className="text-xs text-muted-foreground">{e.location}</p>}
                  <Badge variant="outline" className="text-xs mt-1 capitalize">{e.event_type}</Badge>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Sermons Tab */}
        <TabsContent value="sermons" className="mt-4">
          <div className="space-y-3">
            {sermons.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">No sermons recorded.</p>
            ) : sermons.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-border p-4 flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mic2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.preacher} · {s.date}</p>
                  {s.tags && <p className="text-xs text-muted-foreground mt-0.5">{s.tags}</p>}
                  {s.file_url && (
                    <a href={s.file_url} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline mt-1 inline-block">
                      {s.media_type === "audio" ? "Listen" : "Watch"} →
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Member to {dept?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <Select value={addMemberId} onValueChange={setAddMemberId}>
              <SelectTrigger><SelectValue placeholder="Select a member..." /></SelectTrigger>
              <SelectContent>
                {available.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.first_name} {m.last_name}
                    {m.department_name ? ` (${m.department_name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={addMember} className="w-full bg-primary text-primary-foreground" disabled={!addMemberId}>
              Add to Department
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
