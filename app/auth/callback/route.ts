import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Node.js Runtime (Dihapus 'edge' agar exchange session berhasil disimpan di cookies)

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
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
              // Aman di Route Handler
            }
          },
        },
      }
    );
    
    // Tukar kode login dari Google menjadi session aktif
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Redirect ke halaman utama dengan session aktif
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Jika gagal, balikkan ke login
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}