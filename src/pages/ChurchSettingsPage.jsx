import { useState, useEffect } from "react";
import { uploadFile } from '@/api/client';
import { useChurchSettings } from "@/lib/ChurchSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Save, Settings } from "lucide-react";
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

export default function ChurchSettingsPage() {
  const { settings, saveSettings } = useChurchSettings();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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

  async function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await uploadFile(file);
    set("logo_url", file_url);
    setUploading(false);
  }

  function handleCurrencyChange(code) {
    const cur = CURRENCIES.find(c => c.code === code);
    if (cur) { set("currency_code", cur.code); set("currency_symbol", cur.symbol); }
  }

  async function handleSave() {
    if (!form.church_name.trim()) return;
    setSaving(true);
    await saveSettings(form);
    setSaving(false);
    toast.success("Settings saved successfully!");
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
          <div className="mt-1 flex items-center gap-4">
            {form.logo_url ? (
              <img src={form.logo_url} alt="Church logo" className="w-20 h-20 rounded-xl object-cover border border-border" />
            ) : (
              <div className="w-20 h-20 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center text-muted-foreground text-xs text-center">No Logo</div>
            )}
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border border-dashed border-input hover:border-primary transition-colors text-sm text-muted-foreground">
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : "Upload from device"}
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploading} />
              </label>
              {form.logo_url && (
                <button onClick={() => set("logo_url", "")} className="text-xs text-destructive hover:underline">Remove logo</button>
              )}
            </div>
          </div>
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
    </div>
  );
}