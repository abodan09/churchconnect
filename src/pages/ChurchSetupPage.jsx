import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useChurchSettings } from "@/lib/ChurchSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Church, Upload, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
];

const CURRENCIES = [
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "GHS", symbol: "₵", label: "Ghana Cedi (₵)" },
  { code: "NGN", symbol: "₦", label: "Nigerian Naira (₦)" },
  { code: "KES", symbol: "KSh", label: "Kenyan Shilling (KSh)" },
  { code: "ZAR", symbol: "R", label: "South African Rand (R)" },
  { code: "CAD", symbol: "C$", label: "Canadian Dollar (C$)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  { code: "CHF", symbol: "CHF", label: "Swiss Franc (CHF)" },
];

export default function ChurchSetupPage() {
  const { saveSettings } = useChurchSettings();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    church_name: "",
    logo_url: "",
    language: "en",
    currency_code: "EUR",
    currency_symbol: "€",
  });

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("logo_url", file_url);
    } catch (err) {
      console.error("Logo upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  function handleCurrencyChange(code) {
    const cur = CURRENCIES.find(c => c.code === code);
    if (cur) { set("currency_code", cur.code); set("currency_symbol", cur.symbol); }
  }

  async function handleFinish() {
    if (!form.church_name.trim()) return;
    setSaving(true);
    setError("");
    try {
      // New users register with role "member" by default, but creating
      // ChurchSettings requires "super_admin". Promote this user first —
      // whoever runs setup IS the church administrator.
      const me = await base44.auth.me();
      if (me?.data?.role !== "super_admin") {
        await base44.auth.updateMe({ data: { role: "super_admin" } });
      }
      await saveSettings(form);
      navigate("/");
    } catch (err) {
      console.error("Setup failed:", err);
      setError(err?.message || "Setup failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const steps = ["Church Identity", "Preferences", "Confirm"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/40 to-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <Church className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to ChurchConnect</h1>
          <p className="text-muted-foreground text-sm mt-1">Let's set up your church profile</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step > i + 1 ? "bg-primary text-primary-foreground" : step === i + 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {step > i + 1 ? <CheckCircle className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs hidden sm:block ${step === i + 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${step > i + 1 ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-border shadow-lg p-7">
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Church Identity</h2>
              <div>
                <Label>Church Name *</Label>
                <Input className="mt-1" placeholder="e.g. Grace Community Church" value={form.church_name} onChange={e => set("church_name", e.target.value)} />
              </div>
              <div>
                <Label>Church Logo (optional)</Label>
                <div className="mt-1 flex items-center gap-4">
                  {form.logo_url && <img src={form.logo_url} alt="logo" className="w-14 h-14 rounded-xl object-cover border border-border" />}
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border border-dashed border-input hover:border-primary transition-colors text-sm text-muted-foreground">
                    <Upload className="w-4 h-4" />
                    {uploading ? "Uploading..." : "Upload from device"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                  </label>
                </div>
              </div>
              <Button className="w-full" onClick={() => setStep(2)} disabled={!form.church_name.trim()}>Next →</Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Preferences</h2>
              <div>
                <Label>Language</Label>
                <Select value={form.language} onValueChange={v => set("language", v)}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Currency</Label>
                <Select value={form.currency_code} onValueChange={handleCurrencyChange}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
                <Button className="flex-1" onClick={() => setStep(3)}>Next →</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Confirm Setup</h2>
              <div className="space-y-3 bg-muted/40 rounded-xl p-4 text-sm">
                {form.logo_url && <img src={form.logo_url} alt="logo" className="w-16 h-16 rounded-xl object-cover border border-border mb-2" />}
                <div className="flex justify-between"><span className="text-muted-foreground">Church Name</span><span className="font-medium">{form.church_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Language</span><span className="font-medium">{LANGUAGES.find(l => l.code === form.language)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span className="font-medium">{CURRENCIES.find(c => c.code === form.currency_code)?.label}</span></div>
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
                <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleFinish} disabled={saving}>
                  {saving ? "Saving..." : "Finish Setup ✓"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}