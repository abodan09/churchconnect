import { useState, useEffect } from "react";
import { useAuth } from "@/lib/ClerkAuthContext";
import { entities, getToken } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, RotateCcw, Search, UserPlus } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLOR = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
};

const FILTERS = ["pending", "approved", "rejected", "all"];

export default function AccessRequestsAdminPage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("pending");

  useEffect(() => {
    loadRequests();
  }, []);

  async function loadRequests() {
    setLoading(true);
    try {
      const data = await entities.AccessRequest.list('-createdAt', 500);
      setRequests(data);
    } catch (err) {
      console.error("Failed to load access requests:", err);
    } finally {
      setLoading(false);
    }
  }

  // For member join requests (with clerk_id): call the dedicated approve endpoint
  async function approveMemberJoin(id, action) {
    try {
      const token = await getToken();
      const res = await fetch('/api/member-join-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ request_id: id, action }),
      });
      if (!res.ok) {
        const data = await res.json();
        console.error('member-join-approve failed:', data.error);
        return;
      }
      loadRequests();
    } catch (err) {
      console.error('member-join-approve error:', err);
    }
  }

  // For general access requests (no clerk_id): just update the status
  async function updateStatus(id, status) {
    await entities.AccessRequest.update(id, {
      status,
      reviewed_by: user?.full_name || user?.email || "Admin",
      reviewed_at: new Date().toISOString(),
    });
    loadRequests();
  }

  async function revokeAccess(id) {
    if (!confirm("Revoke this user's access? They will no longer be able to register or log in using the approved status.")) return;
    await entities.AccessRequest.update(id, {
      status: "rejected",
      reviewed_by: user?.full_name || user?.email || "Admin",
      reviewed_at: new Date().toISOString(),
      rejection_reason: "Access revoked by administrator.",
    });
    loadRequests();
  }

  const pendingCount = requests.filter(r => r.status === "pending").length;

  const filtered = requests.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.name?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      r.social_handle?.toLowerCase().includes(q);
    const matchFilter = filter === "all" || r.status === filter;
    return matchSearch && matchFilter;
  });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          Access Requests
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold">
              {pendingCount}
            </span>
          )}
        </h1>
        <p className="text-muted-foreground text-sm">{requests.length} total · {pendingCount} pending review</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search name, email, or handle..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          {FILTERS.map(s => (
            <Button
              key={s}
              variant={filter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(s)}
              className="capitalize"
            >
              {s}{s === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                {["Name", "Email", "Type", "Message", "Requested", "Status", "Actions"].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const isMemberJoin = !!r.clerk_id;
                return (
                  <tr key={r.id} className={`border-b border-border last:border-0 hover:bg-muted/20 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.email}</td>
                    <td className="px-4 py-3">
                      {isMemberJoin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <UserPlus className="w-3 h-3" /> Member Join
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground capitalize">
                          {r.social_handle
                            ? `${r.social_platform}: ${r.social_handle}`
                            : "General"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate" title={r.message}>
                      {r.message || "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {r.requested_at ? format(new Date(r.requested_at), "MMM d, yyyy") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLOR[r.status] || ""}`}>
                        {r.status}
                      </span>
                      {r.reviewed_by && (
                        <p className="text-xs text-muted-foreground mt-0.5">by {r.reviewed_by}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="icon" title="Approve"
                            onClick={() => isMemberJoin
                              ? approveMemberJoin(r.id, 'approved')
                              : updateStatus(r.id, "approved")
                            }
                          >
                            <CheckCircle className="w-4 h-4 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" title="Reject"
                            onClick={() => isMemberJoin
                              ? approveMemberJoin(r.id, 'rejected')
                              : updateStatus(r.id, "rejected")
                            }
                          >
                            <XCircle className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                      {r.status === "approved" && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs h-7 text-destructive hover:text-destructive"
                          onClick={() => revokeAccess(r.id)}
                          title="Revoke access permanently"
                        >
                          <XCircle className="w-3 h-3 mr-1" /> Revoke
                        </Button>
                      )}
                      {r.status === "rejected" && (
                        <Button
                          variant="ghost" size="sm"
                          className="text-xs h-7"
                          onClick={() => isMemberJoin
                            ? approveMemberJoin(r.id, 'approved')
                            : updateStatus(r.id, "approved")
                          }
                          title="Re-approve this request"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" /> Re-approve
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    {filter === "pending" ? "No pending requests." : "No requests found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
