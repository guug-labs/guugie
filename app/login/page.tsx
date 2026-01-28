"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react"; // Pastikan install lucide-react

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // 1. Inisialisasi Supabase
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 2. Cek apakah user sudah login? Kalau iya, lempar ke Dashboard
  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace("/"); // Pindah ke home
      } else {
        setIsChecking(false); // Buka gerbang login
      }
    };
    checkSession();
  }, [router, supabase]);

  // 3. Fungsi Login Google
  const handleGoogleLogin = async () => {
    try {
      setIsLoading(true);
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });
    } catch (error) {
      console.error("Login Error:", error);
      setIsLoading(false);
    }
  };

  // Tampilan Loading Putih pas ngecek sesi (biar ga kedip)
  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="w-8 h-8 border-4 border-blue-600/30 border-t-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] p-6 text-[#e3e3e3] selection:bg-blue-500/20">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        * { font-family: 'Inter', sans-serif !important; -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div className="w-full max-w-sm space-y-12 text-center animate-in fade-in zoom-in-95 duration-700">
        {/* LOGO AREA */}
        <div className="flex flex-col items-center space-y-6">
          <div className="relative p-[2px] bg-gradient-to-tr from-blue-600/50 to-transparent rounded-[32px]">
            <div className="bg-[#0a0a0a] rounded-[30px] p-6 shadow-2xl relative overflow-hidden group">
              {/* Efek kilau di logo */}
              <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-20 h-20 object-contain relative z-10" 
                onError={(e) => {
                  // Fallback kalau logo ga ketemu, ganti jadi teks G
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement!.innerHTML = '<div class="w-20 h-20 flex items-center justify-center text-4xl font-black text-white">G</div>';
                }}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-5xl font-[900] tracking-tighter italic uppercase text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]">Guugie</h2>
            <div className="flex items-center justify-center gap-2">
              <span className="h-px w-4 bg-blue-500/30"></span>
              <p className="text-blue-500 text-[10px] uppercase tracking-[0.5em] font-black italic">BY GUUG LABS</p>
              <span className="h-px w-4 bg-blue-500/30"></span>
            </div>
          </div>
        </div>

        {/* ACTION AREA */}
        <div className="space-y-6">
          <button 
            onClick={handleGoogleLogin} 
            disabled={isLoading}
            className="w-full py-5 bg-white text-black rounded-full font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-4 hover:bg-[#f0f0f0] transition-all active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.1)] disabled:opacity-70 disabled:cursor-not-allowed group"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-black" />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 group-hover:scale-110 transition-transform" alt="G" />
            )}
            {isLoading ? "Menghubungkan..." : "Lanjut dengan Google"}
          </button>

          <p className="text-[9px] text-[#444] uppercase tracking-[0.3em] font-black italic">
            Secure Academic Access System
          </p>
        </div>

        {/* FOOTER */}
        <div className="pt-12">
          <div className="flex items-center justify-center gap-4 opacity-20 hover:opacity-40 transition-opacity cursor-default">
             <span className="text-[10px] font-black italic uppercase tracking-tighter">Gemini 2.5</span>
             <div className="w-1 h-1 bg-white rounded-full"></div>
             <span className="text-[10px] font-black italic uppercase tracking-tighter">DeepSeek V3</span>
          </div>
        </div>
      </div>
    </div>
  );
}