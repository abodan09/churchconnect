import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Church, CheckCircle2, Loader2 } from "lucide-react";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "twitter", label: "Twitter / X" },
  { value: "facebook", label: "Facebook" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Other" },
];

export default function RequestAccessPage() {
  const [form, setForm] = useState({
    name: "", email: "", social_platform: "instagram", social_handle: "", message: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function setField(field) {
    return (e) => setForm(p => ({ ...p, [field]: typeof e === "string" ? e : e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Submission failed. Please try again."); return; }
      setSubmitted(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-secondary/40 to-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Request Submitted!</h1>
          <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
            Your access request has been sent to the church administrator.
            You'll be able to register once it's approved — no further action needed from you right now.
          </p>
          <Link to="/login" className="text-primary font-medium hover:underline text-sm">
            Already approved? Log in here
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/40 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Church className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Request Access</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Submit your details and the administrator will review your request.
          </p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name" className="mt-1 h-11" placeholder="John Smith"
                value={form.name} onChange={setField("name")} required maxLength={200}
              />
            </div>

            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email" type="email" className="mt-1 h-11" placeholder="you@example.com"
                value={form.email} onChange={setField("email")} required maxLength={200}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Social Platform</Label>
                <Select value={form.social_platform} onValueChange={setField("social_platform")}>
                  <SelectTrigger className="mt-1 h-11"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="handle">Handle / Username</Label>
                <Input
                  id="handle" className="mt-1 h-11" placeholder="@username"
                  value={form.social_handle} onChange={setField("social_handle")} maxLength={200}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="message">Message <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="message" className="mt-1 resize-none" rows={3}
                placeholder="Briefly introduce yourself or explain your reason for requesting access..."
                value={form.message} onChange={setField("message")} maxLength={1000}
              />
            </div>

            <Button type="submit" className="w-full h-12 font-medium" disabled={loading}>
              {loading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</>
              ) : "Submit Request"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-5">
            Already have access?{" "}
            <Link to="/login" className="text-primary font-medium hover:underline">Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
