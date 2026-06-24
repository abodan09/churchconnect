import { useAuth } from '@clerk/clerk-react';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

const BILLING_ENABLED = import.meta.env.VITE_BILLING_ENABLED === 'true';
const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI?.isElectron;

// No-op hook — never calls Clerk's useAuth; safe in Electron or when billing is off
function useNoopBilling() {
  return { has: () => true, enabled: false };
}

// Clerk-backed hook — only valid inside a <ClerkProvider>
function useClerkBilling() {
  const { has } = useAuth();
  return {
    has: (params) => (BILLING_ENABLED ? !!has?.(params) : true),
    enabled: BILLING_ENABLED,
  };
}

// Resolved once at module-load time so the hook identity is stable across renders.
// Importing useAuth at the top level is fine — the error only fires when the hook
// is *called* outside ClerkProvider, which useNoopBilling never does.
export const useBilling = (IS_ELECTRON || !BILLING_ENABLED) ? useNoopBilling : useClerkBilling;

/**
 * Declarative gate — mirrors Clerk's <Show when={{ plan/feature/permission }}>.
 * Usage:
 *   <BillingShow when={{ plan: 'pro' }} fallback={<UpgradePrompt plan="pro" />}>
 *     <ProFeature />
 *   </BillingShow>
 */
export function BillingShow({ when, children, fallback = null }) {
  const { has } = useBilling();
  return has(when) ? children : fallback;
}

/**
 * Standard upgrade wall shown as the fallback for gated pages/sections.
 */
export function UpgradePrompt({ plan, feature, permission, message }) {
  const label = plan ?? feature ?? permission ?? 'Pro';
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-12 min-h-[60vh]">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold mb-2">Upgrade Required</h2>
        <p className="text-muted-foreground text-sm mb-6">
          {message ?? `This feature requires the ${label} plan. Upgrade to unlock it.`}
        </p>
        <Link
          to="/pricing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          View Pricing Plans
        </Link>
      </div>
    </div>
  );
}
