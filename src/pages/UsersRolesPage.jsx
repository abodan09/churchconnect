import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/ClerkAuthContext";
import { churchUsers, entities } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { UserCog, UserPlus, Mail, KeyRound, Copy, ShieldCheck, Loader2 } from "lucide-react";

const IS_ELECTRON = typeof window !== "undefined" && !!window.electronAPI?.isElectron;

const ROLES = [
  { value: "super_admin", label: "Super Admin", elevated: true },
  { value: "pastor_admin", label: "Pastor Admin", elevated: true },
  { value: "finance_officer", label: "Finance Officer", elevated: false },
  { value: "department_head", label: "Department Head", elevated: false },
  { value: "data_entry_staff", label: "Data Entry Staff", elevated: false },
  { value: "member", label: "Member", elevated: false },
];
const ROLE_LABEL = Object.fromEntries(ROLES.map(r => [r.value, r.label]));
const ROLE_COLOR = {
  super_admin: "bg-purple-100 text-purple-700",
  pastor_admin: "bg-indigo-100 text-indigo-700",
  finance_officer: "bg-emerald-100 text-emerald-700",
  department_head: "bg-amber-100 text-amber-700",
  data_entry_staff: "bg-sky-100 text-sky-700",
  member: "bg-gray-100 text-gray-700",
};

export default function UsersRolesPage() {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const isAdmin = isSuper || user?.role === "pastor_admin";

  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [savingKey, setSavingKey] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const grantable = useMemo(() => ROLES.filter(r => isSuper || !r.elevated), [isSuper]);

  useEffect(() => { if (isAdmin) load(); else setLoading(false); }, [isAdmin]);

  async function load() {
    setLoading(true); setErr("");
    try {
      const [u, d] = await Promise.all([
        churchUsers.list(),
        // All departments (incl. archived) so a head assigned to a deactivated dept still shows.
        entities.Department.list().catch(() => []),
      ]);
      setUsers(u);
      setDepartments(Array.isArray(d) ? d : []);
    } catch (e) {
      setErr(e?.message || "Could not load users");
    } finally {
      setLoading(false);
    }
  }

  async function changeRole(row, role, department_id) {
    setSavingKey(row.key); setErr("");
    try {
      await churchUsers.setRole({ target: row.key, role, department_id: role === "department_head" ? department_id : null });
      await load();
    } catch (e) {
      setErr(e?.message || "Could not update role");
    } finally {
      setSavingKey(null);
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <ShieldCheck className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="font-semibold">Admins only</p>
        <p className="text-sm text-muted-foreground">You don’t have permission to manage users.</p>
      </div>
    );
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const deptName = (id) => departments.find(d => d.id === id)?.name || "—";

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><UserCog className="w-6 h-6 text-primary" /> Users &amp; Roles</h1>
          <p className="text-muted-foreground text-sm">{users.length} user{users.length === 1 ? "" : "s"} · assign roles and access</p>
        </div>
        <Button onClick={() => setShowAdd(true)} className="gap-1.5">
          {churchUsers.supportsInvite ? <Mail className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {churchUsers.supportsInvite ? "Invite / Add user" : "Add user"}
        </Button>
      </div>

      {err && <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{err}</div>}

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["User", "Email", "Role", "Department"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((row, i) => {
                const busy = savingKey === row.key;
                // Non-super admins can't touch an elevated user's row.
                const locked = (!isSuper && ROLES.find(r => r.value === row.role)?.elevated);
                return (
                  <tr key={row.key} className={`border-b border-border last:border-0 ${i % 2 ? "bg-muted/10" : ""}`}>
                    <td className="px-4 py-3 font-medium">
                      {row.name}{row.isSelf && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">you</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.email || "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${ROLE_COLOR[row.role] || ""}`}>{ROLE_LABEL[row.role] || row.role}</span>
                        {!locked && (
                          <Select value={row.role} onValueChange={(v) => changeRole(row, v, row.departmentId)} disabled={busy}>
                            <SelectTrigger className="h-8 w-[150px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {grantable.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}
                        {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {row.role === "department_head" ? (
                        <Select value={row.departmentId || ""} onValueChange={(v) => changeRole(row, "department_head", v)} disabled={busy || locked}>
                          <SelectTrigger className="h-8 w-[170px]"><SelectValue placeholder="Choose department" /></SelectTrigger>
                          <SelectContent>
                            {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-muted-foreground">{row.departmentId ? deptName(row.departmentId) : "—"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No users yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAdd && (
        <AddUserDialog
          departments={departments}
          grantable={grantable}
          onClose={() => setShowAdd(false)}
          onDone={() => { setShowAdd(false); load(); }}
        />
      )}
    </div>
  );
}

function AddUserDialog({ departments: depProp, grantable: grantProp, onClose, onDone, memberId, presetEmail, presetFirst, presetLast, title }) {
  const { user } = useAuth();
  const isSuper = user?.role === "super_admin";
  const [deps, setDeps] = useState(depProp || null);
  useEffect(() => {
    if (depProp) return;
    entities.Department.filter({ is_active: true }).then(d => setDeps(Array.isArray(d) ? d : [])).catch(() => setDeps([]));
  }, [depProp]);
  const departments = deps || [];
  const grantable = grantProp || ROLES.filter(r => isSuper || !r.elevated);
  const canInvite = churchUsers.supportsInvite;
  const [mode, setMode] = useState(canInvite ? "invite" : "create");
  const [form, setForm] = useState({
    email: presetEmail || "", first_name: presetFirst || "", last_name: presetLast || "",
    role: "member", department_id: "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null); // { mode, tempPassword?, email }

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e?.target ? e.target.value : e }));

  async function submit(e) {
    e?.preventDefault();
    setBusy(true); setErr("");
    try {
      const res = await churchUsers.add({
        mode, email: form.email.trim(), first_name: form.first_name.trim(), last_name: form.last_name.trim(),
        role: form.role, department_id: form.role === "department_head" ? form.department_id : null, member_id: memberId,
      });
      setResult({ mode: res.mode || mode, tempPassword: res.tempPassword, email: res.email || form.email.trim() });
    } catch (e2) {
      setErr(e2?.message || "Could not add user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{title || (canInvite ? "Invite or add a user" : "Add a user")}</DialogTitle></DialogHeader>

        {result ? (
          <div className="space-y-4">
            {result.mode === "invite" ? (
              <div className="text-sm">
                <div className="flex items-center gap-2 text-emerald-700 font-medium mb-1"><Mail className="w-4 h-4" /> Invitation sent</div>
                <p className="text-muted-foreground">An email invite is on its way to <span className="font-medium text-foreground">{result.email}</span>. Their role is applied automatically when they accept and sign in.</p>
              </div>
            ) : (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-emerald-700 font-medium"><KeyRound className="w-4 h-4" /> User created</div>
                <p className="text-muted-foreground">Share these one-time sign-in details with <span className="font-medium text-foreground">{result.email}</span>. Ask them to change the password after first sign-in.</p>
                <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs flex items-center justify-between gap-2">
                  <span className="truncate">{result.tempPassword}</span>
                  <button type="button" onClick={() => navigator.clipboard?.writeText(result.tempPassword)} className="text-primary hover:text-primary/80" title="Copy"><Copy className="w-4 h-4" /></button>
                </div>
              </div>
            )}
            <DialogFooter><Button onClick={onDone}>Done</Button></DialogFooter>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {canInvite && (
              <div className="flex rounded-lg border border-border p-0.5 text-sm">
                <button type="button" onClick={() => setMode("invite")} className={`flex-1 rounded-md py-1.5 font-medium ${mode === "invite" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Invite by email</button>
                <button type="button" onClick={() => setMode("create")} className={`flex-1 rounded-md py-1.5 font-medium ${mode === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Create directly</button>
              </div>
            )}
            <div>
              <Label className="text-xs">Email</Label>
              <Input type="email" required value={form.email} onChange={set("email")} className="mt-1 h-9" placeholder="person@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label className="text-xs">First name</Label><Input value={form.first_name} onChange={set("first_name")} className="mt-1 h-9" /></div>
              <div><Label className="text-xs">Last name</Label><Input value={form.last_name} onChange={set("last_name")} className="mt-1 h-9" /></div>
            </div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={set("role")}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{grantable.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {form.role === "department_head" && (
              <div>
                <Label className="text-xs">Department</Label>
                <Select value={form.department_id} onValueChange={set("department_id")}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Choose department" /></SelectTrigger>
                  <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {mode === "create" && <p className="text-xs text-muted-foreground">A one-time password will be generated for you to share.</p>}
            {err && <p className="text-sm text-destructive">{err}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
              <Button type="submit" disabled={busy}>{busy ? "Working…" : (mode === "invite" ? "Send invite" : "Create user")}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export { AddUserDialog };
