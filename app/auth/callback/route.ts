import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Kalau ada parameter 'next', kita ikutin, kalau gak ada balik ke dashboard ('/')
  const next = searchParams.get('next') ?? '/'; 

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // Middleware biasanya handle ini, tapi kita biarkan agar tidak crash
            }
          },
        },
      }
    );
    
    // Tukar kode login dari Google menjadi sesi user aktif
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // BERHASIL: Lempar user ke halaman utama
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // GAGAL: Lempar balik ke login dengan pesan error yang jelas
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}