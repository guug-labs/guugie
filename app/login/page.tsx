"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react"; 

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // 1. Inisialisasi Supabase
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 2. Cek Sesi (Logic Tetap, Tampilan Loading Diperhalus)
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

  // Tampilan Loading Awal (Minimalis)
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-5 h-5 animate-spin text-white/20" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] text-[#ededed] font-sans selection:bg-white/20">
      {/* INJECT FONT INTER BIAR CLEAN */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        body, button, input { font-family: 'Inter', sans-serif !important; }
      `}</style>

      <div className="w-full max-w-[320px] flex flex-col items-center animate-in fade-in slide-in-from-bottom-4 duration-700">
        
        {/* 1. LOGO AREA (Clean & Professional) */}
        <div className="mb-8 flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-[#161616] rounded-2xl border border-white/10 flex items-center justify-center shadow-lg">
            <img 
              src="/logo.png" 
              alt="G" 
              className="w-8 h-8 object-contain opacity-90"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement!.innerHTML = '<span class="text-xl font-bold text-white">G</span>';
              }} 
            />
          </div>
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Guugie</h1>
            <p className="text-sm text-[#666] font-medium">Platform Riset Akademik</p>
          </div>
        </div>

        {/* 2. ACTION AREA (Flat & Elegan) */}
        <div className="w-full space-y-4">
          <button 
            onClick={handleGoogleLogin} 
            disabled={isLoading}
            className="w-full h-11 bg-white hover:bg-[#f2f2f2] text-black text-[13px] font-semibold rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-4 h-4" alt="G" />
            )}
            <span>Lanjut dengan Google</span>
          </button>

          <p className="text-[11px] text-[#444] text-center px-4 leading-relaxed">
            Dengan masuk, Anda menyetujui aturan penggunaan untuk tujuan pendidikan & riset.
          </p>
        </div>

        {/* 3. FOOTER (Info Mesin Baru) */}
        <div className="mt-12 flex flex-col items-center gap-2">
          <div className="h-px w-8 bg-white/5"></div>
          <p className="text-[10px] text-[#333] font-medium tracking-wide uppercase">
            Powered by Groq • Llama 3
          </p>
        </div>

      </div>
    </div>
  );
}