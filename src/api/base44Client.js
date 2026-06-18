import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, token, functionsVersion } = appParams;

// Keep all Base44 traffic on this origin so it flows through the /api/apps/*
// proxy (see api/base44/proxy.js + vercel.json), which avoids cross-origin
// CORS failures when self-hosted.
//   - serverUrl '' makes API requests relative (baseURL becomes "/api").
//   - appBaseUrl drives the SDK's login / logout / OAuth redirects; pointing it
//     at this origin keeps users on the app's own /login page and routes the
//     logout + OAuth entry points through the proxy instead of api.base44.app.
const sameOrigin = typeof window !== 'undefined' ? window.location.origin : '';

export const base44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl: sameOrigin,
});
