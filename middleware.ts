import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  // 1. Inisialisasi response awal
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Setup Supabase Client khusus Middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // 3. Ambil data user secara real-time
  const { data: { user } } = await supabase.auth.getUser();

  // 4. LOGIKA PROTEKSI (PENTING!):
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isRootPage = request.nextUrl.pathname === '/';

  // A. Kalau BELUM login dan mau buka halaman utama (Halo Guug) -> Tendang ke /login
  if (!user && isRootPage) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // B. Kalau SUDAH login tapi mau coba buka halaman /login -> Tarik balik ke halaman utama (/)
  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Matcher ini nge-filter semua file static biar logo.png dan favicon.png lu 
     * gak ikutan kena "cegat" satpam middleware
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};