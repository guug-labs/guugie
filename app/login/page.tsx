"use client";

import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleGoogleLogin = async () => {
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
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#0a0a0a] p-6 text-[#e3e3e3] selection:bg-blue-500/20">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&display=swap');
        * { font-family: 'Inter', sans-serif !important; -webkit-tap-highlight-color: transparent; }
      `}</style>

      <div className="w-full max-w-sm space-y-12 text-center animate-in fade-in zoom-in-95 duration-700">
        {/* LOGO AREA */}
        <div className="flex flex-col items-center space-y-6">
          <div className="relative p-[2px] bg-gradient-to-tr from-blue-600/50 to-transparent rounded-[32px]">
            <div className="bg-[#0a0a0a] rounded-[30px] p-6 shadow-2xl">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="w-20 h-20 object-contain" 
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <h2 className="text-5xl font-[900] tracking-tighter italic uppercase text-white">Guugie</h2>
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
            className="w-full py-5 bg-white text-black rounded-full font-black uppercase text-[11px] tracking-widest flex items-center justify-center gap-4 hover:bg-[#f0f0f0] transition-all active:scale-95 shadow-[0_0_40px_rgba(255,255,255,0.1)]"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
            Lanjut dengan Google
          </button>

          <p className="text-[9px] text-[#444] uppercase tracking-[0.3em] font-black italic">
            Secure Academic Access System
          </p>
        </div>

        {/* FOOTER BARENGAN SAMA TEMA DEEP */}
        <div className="pt-12">
          <div className="flex items-center justify-center gap-4 opacity-20">
             <span className="text-[10px] font-black italic uppercase tracking-tighter">Gemini 2.5</span>
             <div className="w-1 h-1 bg-white rounded-full"></div>
             <span className="text-[10px] font-black italic uppercase tracking-tighter">DeepSeek V3</span>
          </div>
        </div>
      </div>
    </div>
  );
}