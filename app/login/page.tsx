"use client";

import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) alert("Error login: " + error.message);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0B101A] p-4 font-black text-slate-200">
      {/* FIX: Padding p-6 di HP, p-12 di Laptop (md:p-12) */}
      <div className="w-full max-w-sm space-y-8 md:space-y-10 bg-[#111827] p-6 md:p-12 rounded-[30px] md:rounded-[40px] border border-white/5 shadow-2xl text-center">
        
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
            <div className="absolute inset-0 bg-blue-600/20 blur-3xl rounded-full"></div>
            <img 
              src="/logo.png" 
              alt="Logo Guugie" 
              className="relative w-20 h-20 md:w-28 md:h-28 object-contain animate-pulse" 
            />
          </div>
          
          <div className="space-y-1">
            {/* FIX: Font size 4xl di HP, 5xl di Laptop */}
            <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter italic">Guugie</h2>
            <p className="text-blue-500 text-[9px] md:text-[10px] uppercase tracking-[0.4em] font-black opacity-80">by GUUG Labs</p>
          </div>
        </div>

        <button 
          onClick={handleGoogleLogin} 
          className="w-full py-4 md:py-5 bg-white text-black rounded-2xl font-black uppercase text-[10px] md:text-[11px] flex items-center justify-center gap-3 md:gap-4 hover:bg-slate-200 transition-all shadow-2xl active:scale-95"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" />
          Lanjut dengan Google
        </button>

        <p className="text-[9px] text-slate-600 font-medium italic leading-relaxed px-2 md:px-4">
          Gunakan akun Google untuk verifikasi secara otomatis.
        </p>
      </div>
    </div>
  );
}