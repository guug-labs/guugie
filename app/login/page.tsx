"use client";

import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleGoogleLogin = async () => {
    // Tambahin loading dikit biar user tau tombolnya udah kepencet
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
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#131314] p-6 text-[#e3e3e3] font-sans selection:bg-white/10">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        * { font-family: 'Inter', sans-serif !important; -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div className="w-full max-w-sm space-y-12 text-center animate-in fade-in zoom-in-95 duration-700">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative p-1 bg-gradient-to-tr from-blue-600 to-transparent rounded-[32px] shadow-2xl shadow-blue-500/10">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-24 h-24 object-contain bg-[#131314] rounded-[28px] p-4" 
            />
          </div>
          <div className="space-y-1">
            <h2 className="text-5xl font-[900] tracking-tighter italic uppercase text-white">Guugie</h2>
            <p className="text-blue-500 text-[10px] uppercase tracking-[0.5em] font-black opacity-80">by GUUG LABS</p>
          </div>
        </div>

        <div className="space-y-6">
          <button 
            onClick={handleGoogleLogin} 
            className="w-full py-5 bg-white text-black rounded-full font-black uppercase text-[11px] flex items-center justify-center gap-4 hover:bg-[#e3e3e3] transition-all active:scale-95 shadow-2xl"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
            Lanjut dengan Google
          </button>

          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] text-[#9aa0a6] uppercase tracking-[0.2em] font-black opacity-40">
              Secure Academic Authentication
            </p>
            <div className="h-px w-8 bg-white/5"></div>
          </div>
        </div>
      </div>
    </div>
  );
}