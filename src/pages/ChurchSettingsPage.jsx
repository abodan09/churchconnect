import { useState, useEffect, useRef } from "react";
import { useChurchSettings } from "@/lib/ChurchSettingsContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Save, Settings, Wand2 } from "lucide-react";
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

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function getImageDimensions(objectUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("Could not read image dimensions."));
    img.src = objectUrl;
  });
}

function extractDominantColors(imgEl) {
  const SIZE = 80;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, SIZE, SIZE);
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data;

  const pixels = [];
  for (let i = 0; i < data.length; i += 16) {
    if (data[i + 3] < 128) continue;
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length < 3) return null;

  const lum = ([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b;
  const sorted = [...pixels].sort((a, b) => lum(a) - lum(b));
  let centers = [
    sorted[0],
    sorted[Math.floor(sorted.length / 2)],
    sorted[sorted.length - 1],
  ];

  for (let iter = 0; iter < 8; iter++) {
    const clusters = [[], [], []];
    for (const p of pixels) {
      let minD = Infinity, ci = 0;
      centers.forEach((c, i) => {
        const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
        if (d < minD) { minD = d; ci = i; }
      });
      clusters[ci].push(p);
    }
    centers = clusters.map(cl => {
      if (!cl.length) return [128, 128, 128];
      const s = [0, 0, 0];
      cl.forEach(p => { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; });
      return s.map(v => Math.round(v / cl.length));
    });
  }

  const toHex = ([r, g, b]) =>
    `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

  const [darkest, mid, lightest] = [...centers].sort((a, b) => lum(a) - lum(b));
  return {
    primary: toHex(darkest),
    secondary: toHex(lightest),
    tertiary: toHex(mid),
  };
}

function ColorPicker({ label, description, value, onChange }) {
  const inputRef = useRef(null);
  const isValid = HEX_RE.test(value || '');
  const display = isValid ? value : '#cccccc';

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-foreground">{label}</div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="relative w-full h-16 rounded-xl border-2 border-border hover:border-primary/50 transition-colors overflow-hidden shadow-sm"
        style={{ backgroundColor: display }}
        title={`Pick ${label} color`}
      >
        <input
          ref={inputRef}
          type="color"
          value={display}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
          aria-label={`${label} color picker`}
        />
      </button>
      <input
        type="text"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="#rrggbb"
        maxLength={7}
        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-border focus:outline-none focus:ring-1 focus:ring-primary/30 font-mono"
      />
      <p className="text-[10px] text-muted-foreground leading-tight">{description}</p>
    </div>
  );
}

export default function ChurchSettingsPage() {
  const { settings, saveSettings } = useChurchSettings();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [previewFile, setPreviewFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [form, setForm] = useState({
    church_name: "",
    logo_url: "",
    language: "en",
    currency_code: "EUR",
    currency_symbol: "€",
    theme_primary: "",
    theme_secondary: "",
    theme_tertiary: "",
  });

  useEffect(() => {
    if (settings) {
      setForm({
        church_name: settings.church_name || "",
        logo_url: settings.logo_url || "",
        language: settings.language || "en",
        currency_code: settings.currency_code || "EUR",
        currency_symbol: settings.currency_symbol || "€",
        theme_primary: settings.theme_primary || "",
        theme_secondary: settings.theme_secondary || "",
        theme_tertiary: settings.theme_tertiary || "",
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
      const result = await new Promise((resolve, reject) => {
        if (previewFile.type === 'image/svg+xml') {
          const reader = new FileReader();
          reader.onload = () => resolve({ dataUrl: reader.result, colors: null });
          reader.onerror = () => reject(new Error("Failed to read SVG"));
          reader.readAsDataURL(previewFile);
        } else {
          const img = new Image();
          img.onload = () => {
            const maxSize = 400;
            const ratio = Math.min(1, maxSize / img.naturalWidth, maxSize / img.naturalHeight);
            const w = Math.round(img.naturalWidth * ratio);
            const h = Math.round(img.naturalHeight * ratio);
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            canvas.getContext("2d").drawImage(img, 0, 0, w, h);
            const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
            const colors = extractDominantColors(img);
            resolve({ dataUrl, colors });
          };
          img.onerror = () => reject(new Error("Failed to load image"));
          img.src = previewUrl;
        }
      });

      URL.revokeObjectURL(previewUrl);
      setPreviewFile(null);
      setPreviewUrl("");

      setForm(prev => {
        const noColorsSet = !prev.theme_primary && !prev.theme_secondary && !prev.theme_tertiary;
        return {
          ...prev,
          logo_url: result.dataUrl,
          ...(result.colors && noColorsSet && {
            theme_primary: result.colors.primary,
            theme_secondary: result.colors.secondary,
            theme_tertiary: result.colors.tertiary,
          }),
        };
      });
    } catch {
      setUploadError("Could not process this image. Try a different file or paste a URL.");
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

  async function handleExtractColors() {
    if (!form.logo_url) return;
    setExtracting(true);
    try {
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const colors = extractDominantColors(img);
          if (colors) {
            setForm(prev => ({
              ...prev,
              theme_primary: colors.primary,
              theme_secondary: colors.secondary,
              theme_tertiary: colors.tertiary,
            }));
          }
          resolve();
        };
        img.onerror = () => reject(new Error('Load failed'));
        img.src = form.logo_url;
      });
    } catch {
      toast.error('Could not extract colors from logo. Try setting them manually.');
    } finally {
      setExtracting(false);
    }
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

  const hasValidColors = [form.theme_primary, form.theme_secondary, form.theme_tertiary].some(c => HEX_RE.test(c || ''));

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

      {/* Church Identity */}
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

      {/* Brand Colors */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Brand Colors</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Customize the platform to match your church's identity</p>
          </div>
          {form.logo_url && (
            <button
              type="button"
              onClick={handleExtractColors}
              disabled={extracting}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-primary/40 hover:border-primary text-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              <Wand2 className="w-3.5 h-3.5" />
              {extracting ? 'Extracting…' : 'Extract from logo'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <ColorPicker
            label="Primary"
            description="Sidebar, buttons, active links"
            value={form.theme_primary}
            onChange={v => set('theme_primary', v)}
          />
          <ColorPicker
            label="Secondary"
            description="Backgrounds, muted areas"
            value={form.theme_secondary}
            onChange={v => set('theme_secondary', v)}
          />
          <ColorPicker
            label="Accent"
            description="Highlights, badges, tags"
            value={form.theme_tertiary}
            onChange={v => set('theme_tertiary', v)}
          />
        </div>

        {/* Live color preview strip */}
        {hasValidColors && (
          <div className="flex gap-1 h-5 rounded-lg overflow-hidden border border-border">
            {[form.theme_primary, form.theme_secondary, form.theme_tertiary].map((c, i) =>
              HEX_RE.test(c || '') ? (
                <div key={i} className="flex-1" style={{ backgroundColor: c }} />
              ) : null
            )}
          </div>
        )}

        {!form.logo_url && !hasValidColors && (
          <p className="text-xs text-muted-foreground">Upload a logo first to auto-extract colors, or pick them manually above.</p>
        )}
      </div>

      {/* Language & Currency */}
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
                {uploading ? "Processing..." : "Use This Logo"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
