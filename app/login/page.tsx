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
      
      {/* GLOW DIHAPUS BIAR FULL HITAM PEKAT */}

      <div className="w-full max-w-[400px] px-8 flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000 relative z-20">
        
        {/* LOGO & BRANDING */}
        <div className="mb-14 flex flex-col items-center gap-8">
          <div className="relative group">
            {/* Shadow minimalis saja tanpa glow berwarna */}
            <div className="absolute inset-0 bg-white/5 blur-2xl rounded-full" />
            <div className="w-24 h-24 bg-[#111] rounded-[32px] border border-white/[0.08] flex items-center justify-center shadow-2xl relative z-10">
              <img src="/logo.png" alt="G" className="w-12 h-12 object-contain" />
            </div>
          </div>

          <div className="text-center space-y-3">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-white">
              Guugie Labs
            </h1>
            <p className="text-[10px] text-white/40 font-black uppercase tracking-[0.4em] italic">
              Guugie Public Beta
            </p>
          </div>
        </div>

        {/* LOGIN CARD */}
        <div className="w-full bg-white/[0.02] border border-white/[0.06] p-10 rounded-[40px] shadow-2xl backdrop-blur-md">
          <button 
            onClick={handleGoogleLogin} 
            disabled={isLoading}
            className="group w-full h-16 bg-white hover:bg-[#f0f0f0] text-black text-[15px] font-black rounded-2xl flex items-center justify-center gap-4 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-6 h-6" alt="G" />
                <span className="uppercase tracking-tight">Mulai Riset Sekarang</span>
              </>
            )}
          </button>

          <div className="mt-8 flex items-start gap-4 px-2 text-white/30">
            <Globe2 size={18} className="shrink-0 mt-0.5 text-white/20" />
            <p className="text-[9px] font-bold leading-relaxed uppercase tracking-[0.1em]">
              Buka potensi riset tak terbatas. Diproses secara aman melalui infrastruktur LPU™ generasi terbaru.
            </p>
          </div>
        </div>

        {/* SYNCED FOOTER */}
        <div className="mt-20 flex flex-col items-center gap-6 opacity-20">
          <div className="flex items-center gap-6">
             <div className="h-px w-8 bg-white/10"></div>
             <span className="text-[8px] font-black text-white/40 uppercase tracking-[0.5em]">Guugie Security Access</span>
             <div className="h-px w-8 bg-white/10"></div>
          </div>
          <p className="text-[9px] text-white/60 font-black italic uppercase tracking-widest">
            Powered by Groq LPU™ Engine
          </p>
        </div>

      </div>
    </div>
  );
}