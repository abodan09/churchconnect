import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ClipboardCheck, Search, UserCheck, TrendingDown, Users, BarChart3 } from "lucide-react";
import StatCard from "@/components/StatCard";

export default function AttendancePage() {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [events, setEvents] = useState([]);
  const [members, setMembers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMember, setSelectedMember] = useState(null);
  const [checkStatus, setCheckStatus] = useState("present");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("checkin");

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [a, e, m, d] = await Promise.all([
      entities.Attendance.list("-check_in_time", 500),
      entities.Event.list("-start_datetime", 50),
      entities.Member.list("-created_date", 500),
      entities.Department.list("-created_date", 100),
    ]);
    setAttendance(a); setEvents(e); setMembers(m); setDepartments(d); setLoading(false);
  }

  async function handleCheckIn() {
    if (!selectedEvent || !selectedMember) return;
    const evt = events.find(e => e.id === selectedEvent);
    await entities.Attendance.create({
      event_id: selectedEvent,
      event_name: evt?.title || "",
      event_date: evt?.start_datetime?.split("T")[0] || "",
      member_id: selectedMember.id,
      member_name: `${selectedMember.first_name} ${selectedMember.last_name}`,
      department_id: selectedMember.department_id,
      department_name: selectedMember.department_name,
      check_in_time: new Date().toISOString(),
      status: checkStatus,
      checked_in_by: user?.full_name || ""
    });
    setSelectedMember(null); setMemberSearch(""); setOpen(false); loadData();
  }

  // Analytics
  const eventAttendance = selectedEvent ? attendance.filter(a => a.event_id === selectedEvent) : attendance;
  const deptStats = departments.map(d => ({
    name: d.name,
    count: attendance.filter(a => a.department_id === d.id).length
  })).filter(d => d.count > 0).sort((a,b) => b.count - a.count);

  // Inactive members: no attendance in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const activeIds = new Set(attendance.filter(a => a.check_in_time >= thirtyDaysAgo).map(a => a.member_id));
  const inactiveMembers = members.filter(m => m.membership_status === "active" && !activeIds.has(m.id));

  const filteredMembers = members.filter(m =>
    `${m.first_name} ${m.last_name}`.toLowerCase().includes(memberSearch.toLowerCase())
  ).slice(0, 5);

  const eventRecords = selectedEvent ? attendance.filter(a => a.event_id === selectedEvent) : [];

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-bold">Attendance</h1><p className="text-muted-foreground text-sm">Track and analyze member attendance</p></div>
        <div className="flex gap-2">
          <Button variant={view==="checkin"?"default":"outline"} onClick={()=>setView("checkin")} className={view==="checkin"?"bg-primary text-primary-foreground":""}>Check-in</Button>
          <Button variant={view==="analytics"?"default":"outline"} onClick={()=>setView("analytics")} className={view==="analytics"?"bg-primary text-primary-foreground":""}>Analytics</Button>
        </div>
      </div>

      {view === "checkin" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
            <h2 className="font-semibold mb-3">Select Event</h2>
            <div className="flex gap-3 flex-wrap">
              <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                <SelectTrigger className="flex-1 min-w-48"><SelectValue placeholder="Choose an event..." /></SelectTrigger>
                <SelectContent>
                  {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title} — {e.start_datetime?.split("T")[0]}</SelectItem>)}
                </SelectContent>
              </Select>
              {selectedEvent && (
                <Button onClick={() => setOpen(true)} className="bg-primary text-primary-foreground gap-2">
                  <UserCheck className="w-4 h-4" />Check In Member
                </Button>
              )}
            </div>
          </div>

          {selectedEvent && (
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold">Attendance for this event ({eventRecords.length})</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9 w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>{["Member","Department","Check-in Time","Status","Checked In By"].map(h => <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {eventRecords.filter(a=>(a.member_name||"").toLowerCase().includes(search.toLowerCase())).map((a,i)=>(
                      <tr key={a.id} className={`border-b border-border last:border-0 ${i%2===0?"":"bg-muted/10"}`}>
                        <td className="px-4 py-3 font-medium">{a.member_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{a.department_name||"—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{a.check_in_time ? new Date(a.check_in_time).toLocaleTimeString() : "—"}</td>
                        <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${a.status==="present"?"bg-green-100 text-green-700":a.status==="late"?"bg-amber-100 text-amber-700":"bg-blue-100 text-blue-700"}`}>{a.status}</span></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{a.checked_in_by}</td>
                      </tr>
                    ))}
                    {eventRecords.length===0&&<tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No check-ins yet for this event.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "analytics" && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Total Check-ins" value={attendance.length} icon={ClipboardCheck} color="green" />
            <StatCard title="Inactive Members" value={inactiveMembers.length} icon={TrendingDown} color="red" sub="No attendance in 30 days" />
            <StatCard title="Active Members" value={activeIds.size} icon={Users} color="blue" sub="Attended in last 30 days" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" />Attendance by Department</h2>
              {deptStats.length === 0 ? <p className="text-muted-foreground text-sm">No data yet.</p> : (
                <div className="space-y-3">
                  {deptStats.map(d => (
                    <div key={d.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium">{d.name}</span>
                        <span className="text-muted-foreground">{d.count}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${Math.min(100, (d.count / (deptStats[0]?.count||1)) * 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
              <h2 className="font-semibold mb-4 flex items-center gap-2"><TrendingDown className="w-4 h-4 text-destructive" />Inactive Members (30 days)</h2>
              {inactiveMembers.length === 0 ? <p className="text-muted-foreground text-sm">All members are active!</p> : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {inactiveMembers.map(m => (
                    <div key={m.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border last:border-0">
                      <div>
                        <p className="font-medium">{m.first_name} {m.last_name}</p>
                        <p className="text-muted-foreground text-xs">{m.department_name||"No department"}</p>
                      </div>
                      <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded-full">Inactive</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Check In Member</DialogTitle></DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="relative">
              <Label>Search Member</Label>
              <Input value={memberSearch} onChange={e => { setMemberSearch(e.target.value); setSelectedMember(null); }} placeholder="Type name..." className="mt-1" />
              {memberSearch && !selectedMember && filteredMembers.length > 0 && (
                <div className="absolute z-10 bg-white border border-border rounded-lg mt-1 w-full shadow-lg">
                  {filteredMembers.map(m => (
                    <button key={m.id} onClick={() => { setSelectedMember(m); setMemberSearch(`${m.first_name} ${m.last_name}`); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                      {m.first_name} {m.last_name} <span className="text-muted-foreground text-xs">· {m.department_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div><Label>Status</Label>
              <Select value={checkStatus} onValueChange={setCheckStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                  <SelectItem value="excused">Excused</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleCheckIn} disabled={!selectedMember} className="bg-primary text-primary-foreground">Check In</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
