"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Plus, Send, Paperclip, User, X, Loader2, Trash2,
  PanelLeft, FileText, Zap, 
  AlertCircle, CheckCircle2, LogOut, 
  MessageSquare, Instagram, 
  ChevronDown, Search, Shield, Mic, MicOff
} from "lucide-react";

// KONFIGURASI MODEL (ID Sesuai Route.ts Groq)
const GUUGIE_MODELS = {
  "QUICK": { id: "groq-fast", label: "Guugie Cepat", points: 0, sub: "Respon Kilat", loading: "Mencari..." },
  "REASON": { id: "groq-reason", label: "Guugie Nalar", points: 5, sub: "Logika Deep", loading: "Bernalar..." },
  "PRO": { id: "groq-pro", label: "Guugie Riset", points: 10, sub: "Analisis File", loading: "Membedah..." }
} as const;

export default function GuugieFinalPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null); // Ref buat Mic

  // States
  const [messages, setMessages] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [selectedKasta, setSelectedKasta] = useState<keyof typeof GUUGIE_MODELS>("QUICK");
  
  // UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [isKastaOpen, setIsKastaOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<any[]>([]);
  const [toast, setToast] = useState<{type: 'error' | 'success', msg: string} | null>(null);
  const [legalModal, setLegalModal] = useState<{title: string, content: string} | null>(null);
  const [isListening, setIsListening] = useState(false); // State Mic

  // --- UTILS: TOAST ---
  const showToast = (type: 'error' | 'success', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  // --- UTILS: LEGAL MODAL ---
  const showLegal = (title: string, content: string) => {
    setLegalModal({ title, content });
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  // --- UTILS: AUTO RESIZE TEXTAREA ---
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputText]);

  // --- RESPONSIVE CHECK ---
  useEffect(() => {
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  }, []);

  // ==================== DATA LOADER ====================
  const loadData = useCallback(async (uid: string) => {
    const { data: prof } = await supabase.from("profiles").select("quota").eq("id", uid).single();
    if (prof) setQuota(prof.quota);
    
    const { data: hist } = await supabase.from("chats").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (hist) setHistory(hist);
  }, [supabase]);

  // ==================== AUTH & INIT ====================
  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return router.push("/login");
      setUser(authUser);
      await loadData(authUser.id);
      setIsLoadingSession(false);
    };
    init();
  }, [router, supabase, loadData]);

  useEffect(() => {
    if (!currentChatId) { setMessages([]); return; }
    const loadMsg = async () => {
      const { data } = await supabase.from("messages").select("*").eq("chat_id", currentChatId).order("created_at", { ascending: true });
      if (data) setMessages(data);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    loadMsg();
  }, [currentChatId, supabase]);

  // ==================== MIC / SPEECH TO TEXT (FIX IPHONE) ====================
  const toggleMic = () => {
    // 1. Cek Support Browser
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      return showToast('error', 'Browser ini tidak mendukung fitur suara.');
    }

    // 2. Kalau lagi nyala -> Matikan
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    // 3. Kalau mati -> Nyalakan
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID'; // Bahasa Indonesia
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      // Tambahkan teks ke input yang sudah ada
      setInputText((prev) => prev + (prev ? ' ' : '') + transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Error:", event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        showToast('error', 'Izinkan akses mikrofon di pengaturan browser.');
      } else {
        showToast('error', 'Gagal mendeteksi suara.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  // ==================== FILE UPLOAD ====================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    // Logic Extract Text (Placeholder)
    const processed = Array.from(files).map(f => ({ 
      file: f, 
      extractedText: `[File Content: ${f.name}]` 
    }));

    setPendingFiles(prev => [...prev, ...processed]);
    setSelectedKasta("PRO");
    showToast('success', 'File siap dianalisis');
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  // ==================== SEND MESSAGE ====================
  const handleSendMessage = async () => {
    const model = GUUGIE_MODELS[selectedKasta];
    const cost = model.points;
    const currentQuota = quota || 0;

    if (currentQuota < cost) return showToast('error', `Poin kurang! Butuh ${cost} PTS.`);
    if (!inputText.trim() && pendingFiles.length === 0) return;

    setIsLoading(true);
    const msg = inputText;
    setInputText(""); // UI Snappy

    // 1. Buat Chat ID
    let cid = currentChatId;
    if (!cid) {
      const { data } = await supabase.from("chats").insert([{ user_id: user.id, title: msg.slice(0, 40) }]).select().single();
      if (data) {
        cid = data.id;
        setCurrentChatId(cid);
        setHistory(prev => [data, ...prev]);
      }
    }

    setMessages(prev => [...prev, { role: "user", content: msg }]);

    try {
      // 2. Simpan User Msg
      await supabase.from("messages").insert([{ chat_id: cid, role: "user", content: msg }]);

      // 3. Panggil Backend
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: msg, 
          fileContent: pendingFiles.map(f => f.extractedText).join('\n'),
          modelId: model.id
        })
      });

      const data = await res.json();
      
      if (data.content) {
        // 4. Munculin Jawaban AI
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
        await supabase.from("messages").insert([{ chat_id: cid, role: "assistant", content: data.content }]);

        // 5. UPDATE POIN
        if (cost > 0) {
          const newQuota = currentQuota - cost;
          setQuota(newQuota); // Update State
          await supabase.from("profiles").update({ quota: newQuota }).eq("id", user.id); // Update DB
        }

      } else {
        throw new Error(data.error || "Gagal memproses");
      }

    } catch (e: any) {
      showToast('error', 'Koneksi bermasalah.');
    } finally {
      setIsLoading(false);
      setPendingFiles([]);
    }
  };

  if (isLoadingSession) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0a] text-[#ededed] overflow-hidden font-sans">
      
      {/* GLOBAL STYLES */}
      <style jsx global>{`
        input, textarea { font-size: 16px !important; } /* ANTI ZOOM IPHONE */
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .markdown-body p { margin-bottom: 1rem; line-height: 1.6; color: #d4d4d4; }
        .markdown-body h1, .markdown-body h2 { font-weight: 600; color: white; margin-top: 1.5rem; }
        .markdown-body ul, .markdown-body ol { padding-left: 1.5rem; margin-bottom: 1rem; }
        .markdown-body table { width: 100%; border-collapse: collapse; margin: 1rem 0; background: #171717; border-radius: 8px; }
        .markdown-body th { background: #262626; padding: 10px; text-align: left; font-size: 13px; color: white; }
        .markdown-body td { padding: 10px; border-top: 1px solid #333; font-size: 13px; color: #ccc; }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 20px); }
      `}</style>

      {/* TOAST */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-2xl ${
            toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-200' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
          }`}>
            {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
            <span className="text-sm font-medium">{toast.msg}</span>
          </div>
        </div>
      )}

      {/* LEGAL MODAL */}
      {legalModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-white/10 rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col animate-in zoom-in-95">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-white">{legalModal.title}</h3>
              <button onClick={() => setLegalModal(null)} className="p-1 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
              {legalModal.content}
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-[40] lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-[50] w-[280px] bg-[#0f0f0f] border-r border-white/[0.04] transform transition-transform duration-300 flex flex-col ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      } ${!isSidebarOpen ? "lg:hidden" : "lg:flex"}`}>

        <div className="p-5 flex items-center justify-between">
          <span className="text-xl font-bold text-white tracking-tight pl-2">Guugie</span>
          <button onClick={() => setIsSidebarOpen(false)} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
            <PanelLeft size={20}/>
          </button>
        </div>

        <div className="px-4 pb-2">
          <button onClick={() => { setCurrentChatId(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
            className="w-full flex items-center gap-3 bg-[#1a1a1a] hover:bg-[#222] text-white/90 p-3 rounded-xl transition-all border border-white/[0.04] group shadow-sm">
            <Plus size={18} className="text-white/60 group-hover:text-white"/>
            <span className="text-sm font-medium">Riset Baru</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 no-scrollbar">
          <p className="px-3 text-[10px] font-bold text-white/20 uppercase tracking-wider mb-2">Riwayat</p>
          {history.map(chat => (
            <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} 
              className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all ${
                currentChatId === chat.id ? 'bg-[#1a1a1a] text-white' : 'text-white/40 hover:bg-[#1a1a1a]/50 hover:text-white/80'
              }`}>
              <span className="text-sm truncate max-w-[180px]">{chat.title || "Percakapan"}</span>
              <button onClick={(e) => { e.stopPropagation(); if(confirm("Hapus?")) supabase.from("chats").delete().eq("id",chat.id).then(()=>loadData(user.id)) }} 
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity">
                <Trash2 size={13}/>
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/[0.04] bg-[#0f0f0f]">
          <div className="space-y-1 mb-4">
             <button onClick={() => showLegal("Syarat & Ketentuan", `TERAKHIR DIPERBARUI: JANUARI 2026\n\n1. PENGGUNAAN LAYANAN\nGuugie adalah alat bantu riset. Dilarang plagiarisme.\n\n2. DISCLAIMER AI\nOutput mungkin mengandung halusinasi.\n\n3. SISTEM POIN\nPoin non-refundable.`)} className="w-full flex items-center gap-3 p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors">
               <Shield size={16} /> Terms of Service
             </button>

             <button onClick={() => showLegal("Kebijakan Privasi", `KOMITMEN PRIVASI GUUG LABS\n\n1. DATA\nKami menyimpan riwayat chat untuk Anda.\n\n2. KEAMANAN\nData Anda tidak diperjualbelikan.`)} className="w-full flex items-center gap-3 p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors">
               <FileText size={16} /> Privacy Policy
             </button>

             <button onClick={() => window.open('mailto:guuglabs@gmail.com')} className="w-full flex items-center gap-3 p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-lg text-sm transition-colors">
               <MessageSquare size={16} /> Kritik & Saran
             </button>
          </div>
          
          <div className="flex items-center gap-3 pt-3 border-t border-white/[0.04]">
             <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-white/50">
               {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} className="w-full h-full rounded-full" /> : <User size={18} />}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-xs font-semibold text-white/90 truncate">{user?.user_metadata?.name?.split(' ')[0] || "User"}</p>
               <div className="flex items-center gap-1.5 mt-0.5">
                  <Zap size={10} className="text-yellow-500 fill-yellow-500" />
                  <span className="text-[10px] font-bold text-white/60">{quota ?? '-'} PTS</span>
               </div>
             </div>
             <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="p-2 text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
               <LogOut size={16} />
             </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative w-full h-full bg-[#0a0a0a]">
        
        {/* HEADER */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button onClick={() => setIsSidebarOpen(true)} className="p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                <PanelLeft size={20} />
              </button>
            )}
            <h1 className="text-sm font-semibold text-white/90 truncate max-w-[200px] lg:max-w-md animate-in fade-in">
              {currentChatId ? (history.find(h => h.id === currentChatId)?.title || "Riset Akademik") : "Riset Baru"}
            </h1>
          </div>
          <div className="lg:hidden flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/[0.05]">
            <Zap size={12} className="text-yellow-500 fill-yellow-500" />
            <span className="text-xs font-bold">{quota ?? '...'}</span>
          </div>
        </header>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-0 lg:w-[800px] lg:mx-auto w-full no-scrollbar pb-36">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center opacity-40">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-6">
                <Search size={32} className="text-white/50" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Halo, {user?.user_metadata?.name?.split(' ')[0]}</h2>
              <p className="text-sm text-white/50 max-w-xs">Apa yang ingin kita teliti hari ini?</p>
            </div>
          ) : (
            <div className="space-y-6 pt-6">
              {messages.map((m, i) => (
                <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`
                    max-w-[88%] lg:max-w-[85%] rounded-2xl p-4 text-[15px] leading-relaxed
                    ${m.role === 'user' 
                      ? 'bg-[#262626] text-white rounded-tr-sm border border-white/5' 
                      : 'bg-transparent text-[#e5e5e5] px-0 lg:px-2'
                    }
                  `}>
                    {/* @ts-ignore */}
                    <ReactMarkdown className="markdown-body" remarkPlugins={[remarkGfm]}>
                      {m.content as string}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-3 text-white/30 text-xs px-2 animate-pulse">
                  <Loader2 className="animate-spin" size={14} />
                  <span>{GUUGIE_MODELS[selectedKasta].loading}</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-10 pb-6 px-4 safe-area-bottom z-40">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex justify-start">
               <div className="relative">
                  <button onClick={() => setIsKastaOpen(!isKastaOpen)} className="flex items-center gap-2 bg-[#1a1a1a] border border-white/[0.08] px-4 py-1.5 rounded-full text-xs font-bold text-white/70 hover:text-white transition-all shadow-lg">
                    <div className={`w-2 h-2 rounded-full ${selectedKasta === 'QUICK' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                    {GUUGIE_MODELS[selectedKasta].label}
                    <ChevronDown size={12} />
                  </button>
                  {isKastaOpen && (
                    <div className="absolute bottom-full left-0 mb-2 w-52 bg-[#1a1a1a] border border-white/[0.1] rounded-2xl p-2 shadow-2xl z-50 animate-in slide-in-from-bottom-2">
                      {Object.entries(GUUGIE_MODELS).map(([k, v]) => (
                        <button key={k} onClick={() => { setSelectedKasta(k as any); setIsKastaOpen(false); }} className="w-full text-left p-3 hover:bg-white/[0.05] rounded-xl transition-colors">
                          <div className="text-xs font-bold text-white flex justify-between">{v.label} <span className="text-white/30">{v.points}</span></div>
                          <div className="text-[10px] text-white/40 mt-0.5">{v.sub}</div>
                        </button>
                      ))}
                    </div>
                  )}
               </div>
            </div>

            <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-[26px] p-2 flex flex-col focus-within:border-white/20 transition-all shadow-2xl relative">
              {pendingFiles.length > 0 && (
                <div className="flex gap-2 p-2 px-3 overflow-x-auto border-b border-white/5 mb-1">
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-md text-xs text-white/70 whitespace-nowrap">
                      <FileText size={12} /> <span className="max-w-[100px] truncate">{f.file.name}</span>
                      <button onClick={() => setPendingFiles([])}><X size={12}/></button>
                    </div>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Tanya Guugie..."
                className="w-full bg-transparent border-none focus:ring-0 text-[15px] text-white placeholder-white/30 px-4 py-2 resize-none no-scrollbar max-h-[160px] min-h-[44px]"
                rows={1}
              />
              
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex items-center gap-1">
                  {/* MIC BUTTON ADDED HERE */}
                  <button onClick={toggleMic} className={`p-2 rounded-full transition-colors ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>
                     {isListening ? <MicOff size={20} /> : <Mic size={20} />}
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 text-white/40 hover:text-white hover:bg-white/5 rounded-full transition-colors">
                    <Paperclip size={20} />
                  </button>
                </div>

                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                
                <button onClick={handleSendMessage} disabled={isLoading || (!inputText.trim() && pendingFiles.length === 0)} 
                  className={`p-2 rounded-full transition-all duration-200 flex items-center justify-center ${
                    inputText.trim() || pendingFiles.length > 0 
                    ? 'bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:scale-105' 
                    : 'bg-white/10 text-white/20 cursor-not-allowed'
                  }`}>
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
            </div>
            
            <p className="text-[10px] text-center text-white/20 px-4">
              Guugie dapat membuat kesalahan. Cek ulang info penting.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}