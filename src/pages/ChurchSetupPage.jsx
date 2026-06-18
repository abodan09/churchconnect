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

const ROLES = [
  { value: "super_admin", label: "Super Admin", description: "Full access to everything — church owner / IT administrator" },
  { value: "pastor_admin", label: "Pastor / Admin", description: "All features except Departments & Church Settings" },
  { value: "finance_officer", label: "Finance Officer", description: "Dashboard, Giving, Expenditures, Reports" },
  { value: "department_head", label: "Department Head", description: "Dashboard, Events, Attendance, Sermons" },
  { value: "data_entry_staff", label: "Data Entry Staff", description: "Dashboard, Members, Giving, Attendance" },
  { value: "member", label: "Member", description: "Member Portal only" },
];

export default function ChurchSetupPage() {
  const { saveSettings } = useChurchSettings();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [logoError, setLogoError] = useState("");
  const [form, setForm] = useState({
    church_name: "",
    logo_url: "",
    language: "en",
    currency_code: "EUR",
    currency_symbol: "€",
    role: "super_admin",
  });

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLogoError(`"${file.name}" is not an image. Accepted formats: JPG, PNG, GIF, SVG, WebP.`);
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      const sizeMB = (file.size / 1024 / 1024).toFixed(1);
      setLogoError(`File is ${sizeMB} MB — must be under 5 MB. Try compressing it first.`);
      e.target.value = "";
      return;
    }
    setLogoError("");
    setPreviewFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function handleConfirmLogo() {
    if (!previewFile) return;
    setUploading(true);
    setLogoError("");
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: previewFile });
      set("logo_url", file_url);
      URL.revokeObjectURL(previewUrl);
      setPreviewFile(null);
      setPreviewUrl("");
    } catch (err) {
      console.error("Logo upload failed:", err);
      setLogoError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleCancelLogo() {
    URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl("");
    setLogoError("");
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
      // Best-effort role assignment — doesn't block setup if it fails
      try {
        await base44.auth.updateMe({ data: { role: form.role } });
      } catch (roleErr) {
        console.warn("Role assignment skipped:", roleErr?.message);
      }
      const { role: _role, ...settingsData } = form;
      await saveSettings(settingsData);
      navigate("/");
    } catch (err) {
      console.error("Setup failed:", err);
      setError(err?.message || "Setup failed. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const steps = ["Church Identity", "Preferences", "Your Role", "Confirm"];
  const selectedRole = ROLES.find(r => r.value === form.role);

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
                <div className="flex items-center gap-2 mb-1">
                  <Label>Church Logo</Label>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Optional</span>
                </div>
                <div className="flex items-center gap-4">
                  {form.logo_url && (
                    <div className="relative group">
                      <img src={form.logo_url} alt="logo" className="w-14 h-14 rounded-xl object-cover border border-border" />
                      <button
                        type="button"
                        onClick={() => set("logo_url", "")}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove logo"
                      >✕</button>
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border border-dashed border-input hover:border-primary transition-colors text-sm text-muted-foreground">
                    <Upload className="w-4 h-4" />
                    {uploading ? "Uploading..." : form.logo_url ? "Change logo" : "Upload from device"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
                  </label>
                </div>
                <p className="text-xs text-muted-foreground mt-2">JPG, PNG, GIF, SVG, WebP · Max 5 MB · You can add this later too</p>
                {logoError && (
                  <p className="text-xs text-destructive mt-1.5 flex items-start gap-1">
                    <span>⚠</span> {logoError}
                  </p>
                )}
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
              <h2 className="font-semibold text-lg">Your Role</h2>
              <p className="text-sm text-muted-foreground">Select the role that matches your responsibility in the church.</p>
              <div className="space-y-2">
                {ROLES.map(r => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => set("role", r.value)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${form.role === r.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                  >
                    <div className="font-medium text-sm">{r.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{r.description}</div>
                  </button>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
                <Button className="flex-1" onClick={() => setStep(4)}>Next →</Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <h2 className="font-semibold text-lg">Confirm Setup</h2>
              <div className="space-y-3 bg-muted/40 rounded-xl p-4 text-sm">
                {form.logo_url && <img src={form.logo_url} alt="logo" className="w-16 h-16 rounded-xl object-cover border border-border mb-2" />}
                <div className="flex justify-between"><span className="text-muted-foreground">Church Name</span><span className="font-medium">{form.church_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Language</span><span className="font-medium">{LANGUAGES.find(l => l.code === form.language)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Currency</span><span className="font-medium">{CURRENCIES.find(c => c.code === form.currency_code)?.label}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Your Role</span><span className="font-medium">{selectedRole?.label}</span></div>
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>← Back</Button>
                <Button className="flex-1 bg-primary text-primary-foreground" onClick={handleFinish} disabled={saving}>
                  {saving ? "Saving..." : "Finish Setup ✓"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logo preview confirmation overlay */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-5">
            <h3 className="font-semibold text-lg text-center">Confirm Logo</h3>
            <div className="flex justify-center">
              <img
                src={previewUrl}
                alt="Logo preview"
                className="max-h-52 max-w-full rounded-xl object-contain border border-border"
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">Does this look right for your church logo?</p>
            {logoError && <p className="text-sm text-destructive text-center">⚠ {logoError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleCancelLogo} disabled={uploading}>
                Choose Different
              </Button>
              <Button className="flex-1" onClick={handleConfirmLogo} disabled={uploading}>
                {uploading ? "Uploading..." : "Use This Logo"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
