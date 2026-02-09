import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that don't need authentication
const publicPaths = ['/signin', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Redirect root to sign-in (landing page is a separate project)
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/signin', request.url));
  }

  // Allow public paths, static files, and API routes
  if (
    publicPaths.some((p) => pathname === p) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/sw') ||
    pathname.startsWith('/workbox') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for auth token in cookies or rely on client-side check
  // Since we use localStorage (Zustand), server-side middleware can't verify tokens.
  // We'll do a lightweight check and rely on the client-side auth layout for real protection.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
