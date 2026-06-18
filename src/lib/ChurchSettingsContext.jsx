import { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const ChurchSettingsContext = createContext(null);

export function ChurchSettingsProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const list = await base44.entities.ChurchSettings.list();
      setSettings(list[0] || null);
    } catch (error) {
      console.error('Failed to load church settings:', error);
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(data) {
    const saved = settings?.id
      ? await base44.entities.ChurchSettings.update(settings.id, data)
      : await base44.entities.ChurchSettings.create(data);
    setSettings(saved);
    return saved;
  }

  const fmt = (n) => {
    const sym = settings?.currency_symbol || "€";
    const locale = settings?.language || "en";
    return `${sym}${Number(n || 0).toLocaleString(locale, { minimumFractionDigits: 2 })}`;
  };

  return (
    <ChurchSettingsContext.Provider value={{ settings, loading, saveSettings, fmt, reload: load }}>
      {children}
    </ChurchSettingsContext.Provider>
  );
}

export function useChurchSettings() {
  return useContext(ChurchSettingsContext);
}