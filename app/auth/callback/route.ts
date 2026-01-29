import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// 1. WAJIB: Biar proses login secepat kilat di Cloudflare (Edge Runtime)
export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/'; 

  if (code) {
    // 2. NEXT.JS 15 COMPLIANT: Cookies sekarang asinkron
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          // 3. SSR COOKIE MANAGEMENT: Handle sesi user secara aman
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // Server component aman, abaikan error redirect
            }
          },
        },
      }
    );
    
    // 4. TUKAR KODE: Mengubah kode Google menjadi Sesi Supabase
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Login Sukses -> Lempar ke Dashboard
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // 5. FAIL-SAFE: Jika gagal, balikkan ke login dengan error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}