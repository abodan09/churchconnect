import { useState, useEffect } from "react";
import { uploadFile } from '@/api/client';
import { useChurchSettings } from "@/lib/ChurchSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Save, Settings, X } from "lucide-react";
import { toast } from "sonner";

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

function getImageDimensions(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image dimensions."));
    img.src = objectUrl;
  });
}

export default function ChurchSettingsPage() {
  const { settings, saveSettings } = useChurchSettings();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [form, setForm] = useState({
    church_name: "",
    logo_url: "",
    language: "en",
    currency_code: "EUR",
    currency_symbol: "€",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        church_name: settings.church_name || "",
        logo_url: settings.logo_url || "",
        language: settings.language || "en",
        currency_code: settings.currency_code || "EUR",
        currency_symbol: settings.currency_symbol || "€",
      });
    }
  }, [settings]);

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleLogoSelect(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setUploadError("");

    if (!file.type.startsWith("image/")) {
      setUploadError("Not an image file. Accepted: JPG, PNG, GIF, SVG, WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — must be under 5 MB.`);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const { w, h } = await getImageDimensions(objectUrl);
      if (w < 100 || h < 100) {
        URL.revokeObjectURL(objectUrl);
        setUploadError(`Image too small (${w}×${h}px). Minimum 100×100px.`);
        return;
      }
    } catch {
      URL.revokeObjectURL(objectUrl);
      setUploadError("Could not read this image. Try a different file.");
      return;
    }

    setPreviewFile(file);
    setPreviewUrl(objectUrl);
  }

  async function handleConfirmLogo() {
    if (!previewFile) return;
    setUploading(true);
    setUploadError("");
    try {
      const { file_url } = await uploadFile(previewFile);
      set("logo_url", file_url);
      URL.revokeObjectURL(previewUrl);
      setPreviewFile(null);
      setPreviewUrl("");
    } catch (err) {
      setUploadError("Upload failed — check your connection or paste a URL below.");
    } finally {
      setUploading(false);
    }
  }

  function handleCancelPreview() {
    URL.revokeObjectURL(previewUrl);
    setPreviewFile(null);
    setPreviewUrl("");
    setUploadError("");
  }

  function handleCurrencyChange(code) {
    const cur = CURRENCIES.find(c => c.code === code);
    if (cur) { set("currency_code", cur.code); set("currency_symbol", cur.symbol); }
  }

  async function handleSave() {
    if (!form.church_name.trim()) return;
    setSaving(true);
    try {
      await saveSettings(form);
      toast.success("Settings saved successfully!");
    } catch (err) {
      toast.error("Failed to save settings. Please try again.");
      console.error("Settings save error:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
          <Settings className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Church Settings</h1>
          <p className="text-muted-foreground text-sm">Manage your church profile and preferences</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-5">
        <h2 className="font-semibold">Church Identity</h2>

        <div>
          <Label>Church Name *</Label>
          <Input className="mt-1" placeholder="e.g. Grace Community Church" value={form.church_name} onChange={e => set("church_name", e.target.value)} />
        </div>

        <div>
          <Label>Church Logo</Label>
          <div className="mt-2 flex items-center gap-4">
            {form.logo_url ? (
              <div className="relative group">
                <img src={form.logo_url} alt="Church logo" className="w-20 h-20 rounded-xl object-cover border border-border" />
                <button onClick={() => set("logo_url", "")}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
              </div>
            ) : (
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground text-xs text-center">No Logo</div>
            )}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border border-dashed border-input hover:border-primary transition-colors text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />
                {form.logo_url ? "Change logo" : "Upload from device"}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoSelect} />
              </label>
              <p className="text-xs text-muted-foreground">Or paste a URL:</p>
              <Input
                placeholder="https://example.com/logo.png"
                value={form.logo_url}
                onChange={e => set("logo_url", e.target.value)}
                className="text-xs h-8"
              />
            </div>
          </div>
          {uploadError && <p className="text-xs text-destructive mt-2">⚠ {uploadError}</p>}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-5">
        <h2 className="font-semibold">Language and Currency</h2>

        <div>
          <Label>Display Language</Label>
          <Select value={form.language} onValueChange={v => set("language", v)}>
            <SelectTrigger className="mt-1 w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div>
          <Label>Currency</Label>
          <Select value={form.currency_code} onValueChange={handleCurrencyChange}>
            <SelectTrigger className="mt-1 w-64"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving || !form.church_name.trim()} className="gap-2">
        <Save className="w-4 h-4" />{saving ? "Saving..." : "Save Settings"}
      </Button>

      {/* Logo preview confirmation overlay */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-5">
            <h3 className="font-semibold text-lg text-center">Confirm Logo</h3>
            <div className="flex justify-center">
              <img src={previewUrl} alt="Logo preview" className="max-h-52 max-w-full rounded-xl object-contain border border-border" />
            </div>
            <p className="text-sm text-muted-foreground text-center">Does this look right for your church logo?</p>
            {uploadError && <p className="text-sm text-destructive text-center">⚠ {uploadError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleCancelPreview} disabled={uploading}>Choose Different</Button>
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
