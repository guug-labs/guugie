import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  
  // Karena sekarang pusatnya di app/page.tsx, default-nya adalah '/'
  const next = searchParams.get('next') ?? '/'; 

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) {
              // Di Route Handler ini aman, tapi catch tetap ada buat jaga-jaga
            }
          },
        },
      }
    );
    
    // Tukar kode login dari Google menjadi session aktif
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Jika sukses, lempar ke halaman utama (root)
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Jika gagal, balikkan ke login dengan info error
  return NextResponse.redirect(`${origin}/login?error=auth-code-error`);
}