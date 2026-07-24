import { useState, useEffect } from "react";
import { entities } from "@/api/client";
import { useAuth } from "@/lib/ClerkAuthContext";
import { AddUserDialog } from "@/pages/UsersRolesPage";
import { useChurchSettings } from "@/lib/ChurchSettingsContext";
import { makePdfMoneyFormatter } from "@/lib/finance";
import { generateMemberStatementPDF } from "@/lib/memberStatement";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  HandCoins, HeartHandshake, Download, Printer, Pencil, Trash2, ChevronDown,
  MapPin, Phone, Mail, Users2, Link2, UserPlus, Clock, KeyRound,
} from "lucide-react";

const REL_LABEL = { spouse: "Spouse", child: "Child", parent: "Parent" };
const INVERSE = { spouse: "spouse", child: "parent", parent: "child" };
const STATUS_COLOR = { active: "bg-green-100 text-green-700", inactive: "bg-red-100 text-red-700", visitor: "bg-amber-100 text-amber-700" };

function parseHistory(json) {
  if (!json) return [];
  try { const a = JSON.parse(json); return Array.isArray(a) ? a : []; } catch { return []; }
}

export default function MemberDetailSheet({ open, onOpenChange, member, members = [], onEdit, onOpenMember, onChanged }) {
  const { fmt, settings } = useChurchSettings() || {};
  const { user } = useAuth();
  const isAdmin = ["super_admin", "pastor_admin"].includes(user?.role);
  const [showInvite, setShowInvite] = useState(false);
  const formatMoney = fmt || ((n) => `€${Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2 })}`);

  const [giving, setGiving] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [linkedExtra, setLinkedExtra] = useState([]); // related members not in the capped `members` list
  const [loading, setLoading] = useState(false);
  const [expand, setExpand] = useState(null);      // 'tithe' | 'welfare' | null
  const [showPastAddr, setShowPastAddr] = useState(false);
  const [addRel, setAddRel] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!(open && member?.id)) return;
    setExpand(null); setShowPastAddr(false); setAddRel(false);
    let ignore = false;
    loadDetail(() => ignore);
    return () => { ignore = true; };
  }, [open, member?.id]);

  async function loadDetail(isIgnored = () => false) {
    setLoading(true);
    try {
      const [g, direct, inverse] = await Promise.all([
        entities.Giving.filter({ member_id: member.id }),
        entities.MemberRelationship.filter({ member_id: member.id }),
        entities.MemberRelationship.filter({ related_member_id: member.id }),
      ]);
      if (isIgnored()) return;
      const combined = [
        ...direct.map((r) => ({ ...r, _type: r.relationship_type, _inverse: false })),
        ...inverse.map((r) => ({ ...r, _type: INVERSE[r.relationship_type] || r.relationship_type, _inverse: true })),
      ];
      // Resolve any linked members that fall outside the parent's capped list,
      // so registered relatives are always named + clickable.
      const referenced = new Set();
      combined.forEach((r) => { if (r._inverse) referenced.add(r.member_id); else if (r.related_member_id) referenced.add(r.related_member_id); });
      const known = new Set(members.map((m) => m.id));
      const missing = [...referenced].filter((id) => id && !known.has(id));
      let extra = [];
      if (missing.length) {
        extra = (await Promise.all(missing.map((id) => entities.Member.get(id).catch(() => null)))).filter(Boolean);
      }
      if (isIgnored()) return;
      setGiving(Array.isArray(g) ? g : []);
      setRelationships(combined);
      setLinkedExtra(extra);
    } catch (e) {
      if (isIgnored()) return;
      console.error("Member detail load failed:", e);
      setGiving([]); setRelationships([]); setLinkedExtra([]);
    } finally {
      if (!isIgnored()) setLoading(false);
    }
  }

  if (!member) return null;

  const titheRecords = giving.filter((g) => g.type === "tithe");
  const welfareRecords = giving.filter((g) => g.type === "welfare");
  const titheTotal = titheRecords.reduce((s, g) => s + (g.amount || 0), 0);
  const welfareTotal = welfareRecords.reduce((s, g) => s + (g.amount || 0), 0);

  const pastAddresses = parseHistory(member.address_history);

  // Resolve the "other person" of a relationship from this member's viewpoint.
  // `registered` is decided from the row data (not from cap resolution), so a
  // real member is never mislabeled just because they fell outside `members`.
  const allMembers = [...members, ...linkedExtra];
  function otherPerson(r) {
    if (r._inverse) {
      const owner = allMembers.find((m) => m.id === r.member_id);
      return { registered: true, linked: owner, name: owner ? `${owner.first_name} ${owner.last_name}` : "Registered member", phone: owner?.phone, email: owner?.email, notes: r.related_notes };
    }
    const linked = r.related_member_id ? allMembers.find((m) => m.id === r.related_member_id) : null;
    return {
      registered: !!r.related_member_id,
      linked,
      name: linked ? `${linked.first_name} ${linked.last_name}` : (r.related_name || "Unknown"),
      phone: linked?.phone || r.related_phone,
      email: linked?.email || r.related_email,
      notes: r.related_notes,
    };
  }

  const grouped = { spouse: [], child: [], parent: [] };
  relationships.forEach((r) => { (grouped[r._type] || (grouped[r._type] = [])).push(r); });
  Object.values(grouped).forEach((arr) => arr.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || ""))));

  async function downloadStatement(kind, mode) {
    generateMemberStatementPDF({
      member,
      records: kind === "tithe" ? titheRecords : welfareRecords,
      kind,
      fmt: makePdfMoneyFormatter(settings),
      churchName: settings?.church_name,
      mode,
    });
  }

  async function deleteRelationship(r) {
    if (!confirm("Remove this family link?")) return;
    try { await entities.MemberRelationship.delete(r.id); await loadDetail(); onChanged?.(); }
    catch (e) { console.error(e); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-primary text-primary-foreground px-6 py-5">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3 pr-8">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {(member.first_name?.[0] || "") + (member.last_name?.[0] || "")}
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-primary-foreground text-xl truncate">{member.first_name} {member.last_name}</SheetTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium capitalize ${STATUS_COLOR[member.membership_status] || "bg-gray-100 text-gray-700"}`}>{member.membership_status}</span>
                    {member.department_name && <span className="text-xs text-primary-foreground/80">{member.department_name}</span>}
                  </div>
                </div>
              </div>
            </div>
          </SheetHeader>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => onEdit?.(member)}>
              <Pencil className="w-3.5 h-3.5" /> Edit member
            </Button>
            {member.user_id ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-white/20 text-[11px] font-medium">
                <KeyRound className="w-3.5 h-3.5" /> Has app login
              </span>
            ) : isAdmin ? (
              <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setShowInvite(true)}>
                <UserPlus className="w-3.5 h-3.5" /> Invite / Create login
              </Button>
            ) : null}
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* Contact + address */}
          <section className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <h3 className="font-semibold text-sm text-foreground mb-3">Contact & Address</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {member.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4 flex-shrink-0" /><span className="truncate">{member.phone}</span></div>}
              {member.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4 flex-shrink-0" /><span className="truncate">{member.email}</span></div>}
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-start gap-2 text-sm">
                <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">Current address</p>
                  <p className="text-foreground">{member.address || <span className="text-muted-foreground italic">No address on file</span>}</p>
                </div>
              </div>
              {pastAddresses.length > 0 && (
                <div className="mt-2">
                  <button onClick={() => setShowPastAddr((v) => !v)} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                    <Clock className="w-3.5 h-3.5" /> {pastAddresses.length} previous address{pastAddresses.length > 1 ? "es" : ""}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPastAddr ? "rotate-180" : ""}`} />
                  </button>
                  {showPastAddr && (
                    <ul className="mt-2 space-y-1.5 pl-5 border-l-2 border-border">
                      {pastAddresses.map((a, i) => (
                        <li key={i} className="text-sm">
                          <span className="text-foreground">{a.address}</span>
                          {a.changed_on && <span className="text-xs text-muted-foreground"> — until {a.changed_on}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Giving: tithe + welfare */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <GivingTile label="Total Tithe" total={titheTotal} count={titheRecords.length} color="green" icon={HandCoins}
              active={expand === "tithe"} onToggle={() => setExpand(expand === "tithe" ? null : "tithe")} fmt={formatMoney} loading={loading} />
            <GivingTile label="Total Welfare" total={welfareTotal} count={welfareRecords.length} color="teal" icon={HeartHandshake}
              active={expand === "welfare"} onToggle={() => setExpand(expand === "welfare" ? null : "welfare")} fmt={formatMoney} loading={loading} />
          </section>

          {expand && (
            <GivingHistory
              kind={expand}
              records={expand === "tithe" ? titheRecords : welfareRecords}
              fmt={formatMoney}
              onDownload={() => downloadStatement(expand, "save")}
              onPrint={() => downloadStatement(expand, "print")}
            />
          )}

          {/* Family */}
          <section className="bg-white rounded-xl border border-border p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-foreground flex items-center gap-2"><Users2 className="w-4 h-4 text-primary" /> Family</h3>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setAddRel((v) => !v)}>
                <UserPlus className="w-3.5 h-3.5" /> Add
              </Button>
            </div>

            {addRel && (
              <AddRelationshipForm
                self={member}
                members={members}
                relationships={relationships}
                saving={saving}
                onCancel={() => setAddRel(false)}
                onSave={async (payload) => {
                  setSaving(true);
                  try {
                    await entities.MemberRelationship.create({ ...payload, member_id: member.id });
                    setAddRel(false); await loadDetail(); onChanged?.();
                  } catch (e) { console.error(e); alert("Could not save the family link."); }
                  finally { setSaving(false); }
                }}
              />
            )}

            {relationships.length === 0 && !addRel && (
              <p className="text-sm text-muted-foreground">No family linked yet. Use “Add” to link a spouse, child, or parent.</p>
            )}

            <div className="space-y-3">
              {["spouse", "child", "parent"].map((type) => grouped[type]?.length > 0 && (
                <div key={type}>
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium mb-1.5">{REL_LABEL[type]}{grouped[type].length > 1 ? (type === "child" ? "ren" : "s") : ""}</p>
                  <div className="space-y-1.5">
                    {grouped[type].map((r) => {
                      const p = otherPerson(r);
                      return (
                        <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {p.linked ? (
                                <button onClick={() => onOpenMember?.(p.linked)} className="font-medium text-sm text-primary hover:underline flex items-center gap-1 truncate">
                                  <Link2 className="w-3.5 h-3.5 flex-shrink-0" />{p.name}
                                </button>
                              ) : (
                                <span className="font-medium text-sm truncate">{p.name}</span>
                              )}
                              {!p.registered && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">not registered</span>}
                            </div>
                            {(p.phone || p.email) && (
                              <p className="text-xs text-muted-foreground truncate">{[p.phone, p.email].filter(Boolean).join(" · ")}</p>
                            )}
                            {p.notes && <p className="text-xs text-muted-foreground truncate">{p.notes}</p>}
                          </div>
                          <button onClick={() => deleteRelationship(r)} aria-label="Remove" className="text-muted-foreground hover:text-destructive flex-shrink-0">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {showInvite && (
          <AddUserDialog
            memberId={member.id}
            presetEmail={member.email || ""}
            presetFirst={member.first_name || ""}
            presetLast={member.last_name || ""}
            title="Give this member an app login"
            onClose={() => setShowInvite(false)}
            onDone={() => { setShowInvite(false); onChanged?.(); }}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function GivingTile({ label, total, count, color, icon: Icon, active, onToggle, fmt, loading }) {
  const colors = { green: "bg-primary/10 text-primary", teal: "bg-teal-100 text-teal-700" };
  return (
    <button
      onClick={onToggle}
      className={`text-left bg-white rounded-xl border p-4 shadow-sm transition-colors ${active ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/40"}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${colors[color]}`}><Icon className="w-5 h-5" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{loading ? "…" : fmt(total)}</p>
          <p className="text-[11px] text-primary mt-0.5">{count} record{count === 1 ? "" : "s"} · {active ? "hide" : "view history"}</p>
        </div>
      </div>
    </button>
  );
}

function GivingHistory({ kind, records, fmt, onDownload, onPrint }) {
  const sorted = [...records].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  return (
    <section className="bg-white rounded-xl border border-border p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-semibold text-sm capitalize">{kind} history</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={onPrint} disabled={!sorted.length}><Printer className="w-3.5 h-3.5" /> Print</Button>
          <Button size="sm" className="gap-1.5 h-8 bg-primary text-primary-foreground" onClick={onDownload} disabled={!sorted.length}><Download className="w-3.5 h-3.5" /> PDF</Button>
        </div>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {kind} records yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border">
              <tr>{["Date", "Amount", "Method", "Service / Event"].map((h) => <th key={h} className="text-left py-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>)}</tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="py-2 text-muted-foreground">{r.date}</td>
                  <td className="py-2 font-semibold text-primary tabular-nums">{fmt(r.amount)}</td>
                  <td className="py-2 text-muted-foreground capitalize">{(r.payment_method || "").replace(/_/g, " ")}</td>
                  <td className="py-2 text-muted-foreground">{r.service_or_event || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function AddRelationshipForm({ self, members, relationships, saving, onCancel, onSave }) {
  const [type, setType] = useState("child");
  const [linkMode, setLinkMode] = useState("registered");
  const [search, setSearch] = useState("");
  const [linked, setLinked] = useState(null); // member object
  const [manual, setManual] = useState({ related_name: "", related_phone: "", related_email: "" });
  const [notes, setNotes] = useState("");

  // Members already linked (either direction) + self are not selectable.
  const linkedIds = new Set(relationships.flatMap((r) => [r.member_id, r.related_member_id]).filter(Boolean));
  const candidates = members
    .filter((m) => m.id !== self.id && !linkedIds.has(m.id))
    .filter((m) => `${m.first_name} ${m.last_name}`.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 6);

  const canSave = linkMode === "registered" ? !!linked : manual.related_name.trim().length > 0;

  function submit() {
    if (!canSave) return;
    const base = { relationship_type: type, related_notes: notes.trim() || undefined };
    if (linkMode === "registered" && linked) {
      onSave({ ...base, related_member_id: linked.id, related_name: `${linked.first_name} ${linked.last_name}` });
    } else {
      onSave({ ...base, related_name: manual.related_name.trim(), related_phone: manual.related_phone.trim() || undefined, related_email: manual.related_email.trim() || undefined });
    }
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 mb-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Relationship</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="spouse">Spouse</SelectItem>
              <SelectItem value="child">Child</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Who</Label>
          <Select value={linkMode} onValueChange={(v) => { setLinkMode(v); setLinked(null); setSearch(""); }}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="registered">Registered member</SelectItem>
              <SelectItem value="manual">Not registered</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {linkMode === "registered" ? (
        <div className="relative">
          <Label className="text-xs">Search member</Label>
          {linked ? (
            <div className="mt-1 flex items-center justify-between rounded-md border border-border bg-white px-3 py-2 text-sm">
              <span className="font-medium">{linked.first_name} {linked.last_name}</span>
              <button onClick={() => { setLinked(null); setSearch(""); }} className="text-xs text-primary hover:underline">change</button>
            </div>
          ) : (
            <>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Type a name…" className="mt-1 h-9" />
              {search && (
                <div className="absolute z-20 bg-white border border-border rounded-lg mt-1 w-full shadow-lg max-h-48 overflow-y-auto">
                  {candidates.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">No matching members</p>
                  ) : candidates.map((m) => (
                    <button key={m.id} onClick={() => { setLinked(m); setSearch(""); }} className="w-full text-left px-3 py-2 text-sm hover:bg-muted">
                      {m.first_name} {m.last_name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          <Input value={manual.related_name} onChange={(e) => setManual((p) => ({ ...p, related_name: e.target.value }))} placeholder="Full name" className="h-9" />
          <div className="grid grid-cols-2 gap-2">
            <Input value={manual.related_phone} onChange={(e) => setManual((p) => ({ ...p, related_phone: e.target.value }))} placeholder="Phone" className="h-9" />
            <Input value={manual.related_email} onChange={(e) => setManual((p) => ({ ...p, related_email: e.target.value }))} placeholder="Email" className="h-9" />
          </div>
        </div>
      )}

      <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" className="h-9" />

      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
        <Button size="sm" className="bg-primary text-primary-foreground" onClick={submit} disabled={!canSave || saving}>{saving ? "Saving…" : "Add link"}</Button>
      </div>
    </div>
  );
}
