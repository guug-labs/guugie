"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Loader2, Globe2 } from "lucide-react"; 

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { router.replace("/"); } else { setIsChecking(false); }
    };
    checkSession();
  }, [router, supabase]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      });
    } catch (error) { setIsLoading(false); }
  };

  if (isChecking) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-6 h-6 animate-spin text-white/10" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-[#ededed] font-sans selection:bg-white/10 overflow-hidden relative">
      <style jsx global>{`
        html, body { 
          background-color: #0a0a0a !important; 
          margin: 0; 
          padding: 0;
          height: 100%;
        }
      `}</style>
      
      <div className="w-full max-w-[400px] px-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000 relative z-20">
        
        {/* LOGO & BRANDING (MONOCHROME & TEGAK) */}
        <div className="mb-14 flex flex-col items-center gap-6">
          <div className="relative group">
            <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full" />
            <div className="w-24 h-24 bg-[#111] rounded-[32px] border border-white/[0.08] flex items-center justify-center shadow-2xl relative z-10 overflow-hidden p-4">
              {/* LOGO PNG */}
              <img 
                src="/logo.png" 
                alt="GUUG LABS" 
                className="w-full h-full object-contain opacity-90"
              />
            </div>
          </div>

          <div className="text-center space-y-2">
            {/* TEXT: TEGAK (NO ITALIC), NO BLUE */}
            <h1 className="text-4xl font-bold uppercase tracking-tighter text-white">
              GUUGIE <span className="text-white/50">v2.0</span>
            </h1>
            <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.4em]">
              The Student's Engine
            </p>
          </div>
        </div>

        {/* LOGIN CARD */}
        <div className="w-full bg-white/[0.02] border border-white/[0.06] p-10 rounded-[40px] shadow-2xl backdrop-blur-md">
          <button 
            onClick={handleGoogleLogin} 
            disabled={isLoading}
            className="group w-full h-16 bg-white hover:bg-[#e5e5e5] text-black text-[15px] font-bold rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                <span className="uppercase tracking-tight">Masuk dengan Google</span>
              </>
            )}
          </button>

          <div className="mt-8 flex items-start gap-4 px-2 text-white/30">
            <Globe2 size={18} className="shrink-0 mt-0.5 text-white/20" />
            <p className="text-[9px] font-bold leading-relaxed uppercase tracking-[0.1em]">
              Akses riset akademik tanpa batas. Aman, Cepat, dan Terintegrasi dengan v2.0 Engine.
            </p>
          </div>
        </div>

        {/* FOOTER (NO ITALIC, NO BLUE) */}
        <div className="mt-20 flex flex-col items-center gap-6 opacity-20">
          <div className="flex items-center gap-6">
             <div className="h-px w-8 bg-white/10"></div>
             <span className="text-[8px] font-bold text-white/40 uppercase tracking-[0.5em]">Guugie v2.0</span>
             <div className="h-px w-8 bg-white/10"></div>
          </div>
          <p className="text-[9px] text-white/60 font-bold uppercase tracking-widest">
            POWERED BY GUUG LABS 2026
          </p>
        </div>

      </div>
    </div>
  );
}