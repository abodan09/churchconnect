import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request) {
  return updateSession(request);
}

export const config = {
  // Run on all routes except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
