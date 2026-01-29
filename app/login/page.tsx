"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Loader2, Zap, ShieldCheck } from "lucide-react"; 

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // 1. Inisialisasi Supabase
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 2. Auth Guard
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/"); 
      } else {
        setIsChecking(false);
      }
    };
    checkSession();
  }, [router, supabase]);

  // 3. Login Google
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
    } catch (error) {
      console.error("Login Error:", error);
      setIsLoading(false);
    }
  };

  // Loading State (Glassmorphism Style)
  if (isChecking) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-6 h-6 animate-spin text-white/10" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] items-center justify-center bg-[#0a0a0a] text-[#ededed] font-sans selection:bg-white/10 overflow-hidden relative">
      
      {/* BACKGROUND ORNAMENT (Soft Glow) */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full" />

      <div className="w-full max-w-[360px] px-6 flex flex-col items-center animate-in fade-in zoom-in-95 duration-1000">
        
        {/* 1. BRANDING AREA (Aligned with Sidebar) */}
        <div className="mb-12 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="w-20 h-20 bg-[#111] rounded-[28px] border border-white/[0.08] flex items-center justify-center shadow-2xl relative z-10">
              <img 
                src="/logo.png" 
                alt="G" 
                className="w-10 h-10 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<span class="text-2xl font-black text-white italic">G</span>';
                }} 
              />
            </div>
            {/* Decorative Zap */}
            <div className="absolute -top-2 -right-2 bg-yellow-500 rounded-full p-1.5 shadow-lg z-20 border-2 border-[#0a0a0a]">
              <Zap size={12} className="text-black fill-black" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white">
              Guugie Labs
            </h1>
            <p className="text-[11px] text-white/30 font-bold uppercase tracking-[0.3em]">
              Research Environment v3.7
            </p>
          </div>
        </div>

        {/* 2. LOGIN CARD */}
        <div className="w-full bg-[#111]/50 backdrop-blur-xl border border-white/[0.06] p-8 rounded-[32px] shadow-2xl">
          <button 
            onClick={handleGoogleLogin} 
            disabled={isLoading}
            className="w-full h-14 bg-white hover:bg-white/90 text-black text-[14px] font-black rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
                <span className="uppercase tracking-tight">Masuk dengan Google</span>
              </>
            )}
          </button>

          <div className="mt-8 flex items-start gap-3 px-1 text-white/20">
            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
            <p className="text-[10px] font-medium leading-relaxed uppercase tracking-wider">
              Akses terbatas untuk penggunaan riset akademik & analisis data profesional.
            </p>
          </div>
        </div>

        {/* 3. FOOTER INFO */}
        <div className="mt-16 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4">
             <div className="h-px w-6 bg-white/5"></div>
             <span className="text-[9px] font-black text-white/10 uppercase tracking-[0.4em]">Secure Access</span>
             <div className="h-px w-6 bg-white/5"></div>
          </div>
          <p className="text-[10px] text-white/20 font-bold italic opacity-50">
            Powered by Groq LPU™ Engine
          </p>
        </div>

      </div>
    </div>
  );
}