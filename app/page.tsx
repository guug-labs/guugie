"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mammoth from "mammoth"; 
import { 
  Plus, Send, Mic, Paperclip, User, X, Loader2, Trash2,
  Check, Pencil, LogOut, PanelLeftOpen, FileText, ChevronDown, 
  ShieldCheck, Info, Zap, MessageSquare, Globe
} from "lucide-react";

// --- KATEGORI AI (GUUGIE STYLE) ---
const GUUGIE_MODELS = {
  "QUICK": { id: "xiaomi/mimo-v2-flash", label: "Guugie Cepat", points: 0, sub: "Respon instan", loading: "Guugie sedang berpikir..." },
  "REASON": { id: "deepseek/deepseek-v3.2", label: "Guugie Nalar", points: 5, sub: "Analisis mendalam", loading: "Guugie mencari argumen..." },
  "PRO": { id: "google/gemini-2.5-flash", label: "Guugie Pro", points: 10, sub: "Riset & File", loading: "Guugie memproses dokumen..." }
} as const;

export default function GuugieUltraMasterPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // --- REFS ---
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- STATES ---
  const [messages, setMessages] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [selectedKasta, setSelectedKasta] = useState<keyof typeof GUUGIE_MODELS>("QUICK");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isKastaOpen, setIsKastaOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [quota, setQuota] = useState(0);
  const [pendingFile, setPendingFile] = useState<any>(null);
  const [extractedText, setExtractedText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [modal, setModal] = useState<string | null>(null);

  // --- LOAD DATA ---
  const loadData = useCallback(async (uid: string) => {
    const [{ data: hist }, { data: prof }] = await Promise.all([
      supabase.from("chats").select("*").eq("user_id", uid).order("created_at", { ascending: false }),
      supabase.from("profiles").select("quota").eq("id", uid).single()
    ]);
    if (hist) setHistory(hist);
    if (prof) setQuota(prof.quota);
  }, [supabase]);

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

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = `${Math.min(textAreaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  // --- ACTIONS ---
  const handleSendMessage = async () => {
    const model = GUUGIE_MODELS[selectedKasta];
    const isAdmin = user?.email === 'guuglabs@gmail.com';
    
    // ANTI-DUPLIKAT GUARD
    if (isLoading || (!inputText.trim() && !extractedText)) return;
    if (!isAdmin && quota < model.points) return alert("Poin tidak cukup!");

    setIsLoading(true);
    const msg = inputText;
    setInputText("");
    
    let cid = currentChatId;
    if (!cid) {
      const { data } = await supabase.from("chats").insert([{ user_id: user.id, title: msg.slice(0, 30) || "Chat Baru" }]).select().single();
      cid = data?.id;
      setCurrentChatId(cid);
      setHistory(prev => [data, ...prev]);
    }

    setMessages(prev => [...prev, { role: "user", content: msg }]);
    await supabase.from("messages").insert([{ chat_id: cid, role: "user", content: msg }]);

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        body: JSON.stringify({ chatId: cid, message: msg, modelId: model.id, fileContent: extractedText, isAdmin })
      });
      const data = await res.json();
      if (data.content) {
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
        loadData(user.id);
      }
    } catch (e) { alert("Sistem sibuk."); } finally {
      setIsLoading(false);
      setPendingFile(null);
      setExtractedText("");
    }
  };

  const handleFileUpload = async (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    setPendingFile(file);
    if (file.name.endsWith(".docx")) {
      const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
      setExtractedText(res.value);
    } else {
      setExtractedText(await file.text());
    }
    setSelectedKasta("PRO");
  };

  if (isLoadingSession) return <div className="flex h-[100dvh] items-center justify-center bg-[#131314]"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#131314] text-[#e3e3e3] overflow-hidden font-sans">
      <style>{`
        * { font-family: 'Inter', sans-serif !important; -webkit-tap-highlight-color: transparent; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        @media (max-width: 768px) { .prose { font-size: 14px; } }
      `}</style>

      {/* MODAL (TOS, PRIVACY, FEEDBACK) */}
      {modal && (
        <div className="fixed inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-[#1e1f20] p-6 rounded-3xl border border-white/10 max-w-sm w-full animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold mb-4">{modal}</h3>
            <div className="text-sm text-[#9aa0a6] space-y-4">
              {modal === 'TOS' && <p>Gunakan asisten ini untuk riset akademik profesional. Poin Anda akan di-reset otomatis menjadi 100 setiap jam 00:00 WIB.</p>}
              {modal === 'PRIVACY' && <p>Kami sangat menjaga privasi. File dokumen yang Anda unggah hanya diproses sementara untuk analisis AI dan tidak disimpan permanen.</p>}
              {modal === 'FEEDBACK' && <p>Masukan Anda sangat berharga bagi perkembangan Guugie. Kirim saran/feedback ke: guuglabs@gmail.com.</p>}
            </div>
            <button onClick={() => setModal(null)} className="w-full mt-6 py-3 bg-[#303132] rounded-xl font-bold transition-all hover:bg-[#444746]">Tutup</button>
          </div>
        </div>
      )}

      {/* SIDEBAR (RENAME, DELETE, LEGAL, POWERED BY) */}
      <aside className={`fixed lg:relative z-[250] h-full transition-all duration-300 bg-[#1e1f20] border-r border-white/5 ${isSidebarOpen ? "w-72" : "w-0 lg:w-0 overflow-hidden"}`}>
        <div className="w-72 p-4 flex flex-col h-full">
          <button onClick={() => { setCurrentChatId(null); setMessages([]); setIsSidebarOpen(false); }} className="flex items-center gap-3 bg-[#303132] hover:bg-[#444746] p-4 rounded-2xl text-sm font-medium transition-all shadow-xl">
            <Plus size={20} /> Chat Baru
          </button>
          <div className="mt-8 flex-1 overflow-y-auto space-y-1 custom-scrollbar">
            {history.map(chat => (
              <div key={chat.id} className={`group flex items-center justify-between p-3 rounded-xl hover:bg-[#303132] ${currentChatId === chat.id ? 'bg-[#303132]' : ''}`}>
                <button onClick={() => { setCurrentChatId(chat.id); setIsSidebarOpen(false); }} className="flex-1 text-left text-sm truncate pr-2">{chat.title}</button>
                <div className="hidden group-hover:flex items-center gap-2">
                  <button onClick={async (e) => { e.stopPropagation(); const t = prompt("Ubah Nama:", chat.title); if(t) { await supabase.from("chats").update({title: t}).eq("id", chat.id); loadData(user.id); } }}><Pencil size={14} /></button>
                  <button onClick={async (e) => { e.stopPropagation(); if(confirm("Hapus?")) { await supabase.from("chats").delete().eq("id", chat.id); loadData(user.id); if(currentChatId===chat.id) setMessages([]); } }} className="text-red-400"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto pt-4 border-t border-white/5 space-y-4">
            {/* RESET INFO */}
            <div className="p-3 bg-blue-500/5 rounded-xl border border-blue-500/10">
              <div className="flex items-center gap-2 mb-1"><Zap size={12} className="text-blue-500" /><p className="text-[10px] font-bold uppercase text-blue-400">Daily Reset</p></div>
              <p className="text-[9px] text-[#9aa0a6] leading-tight font-black italic">Poin di-reset menjadi 100 setiap jam 00:00.</p>
            </div>
            {/* POWERED BY */}
            <div className="px-2">
              <p className="text-[10px] uppercase font-bold text-[#444746] mb-1 leading-none">Powered By</p>
              <div className="flex gap-2 opacity-30 grayscale hover:grayscale-0 transition-all">
                <img src="https://upload.wikimedia.org/wikipedia/commons/8/8a/Google_Gemini_logo.svg" className="h-3" alt="Gemini" />
                <span className="text-[9px] font-black uppercase italic tracking-tighter">DeepSeek</span>
              </div>
            </div>
            {/* LEGAL LINKS */}
            <div className="flex gap-4 text-[10px] font-bold text-[#9aa0a6] px-2 uppercase tracking-tighter">
              <button onClick={() => setModal('TOS')} className="hover:text-white transition-colors">TOS</button>
              <button onClick={() => setModal('PRIVACY')} className="hover:text-white transition-colors">PRIVACY</button>
              <button onClick={() => setModal('FEEDBACK')} className="hover:text-white transition-colors">FEEDBACK</button>
            </div>
            <p className="text-[9px] text-[#444746] px-2 font-black italic uppercase tracking-widest leading-none">© 2026 GUUG LABS.</p>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col relative h-full min-w-0">
        <header className="flex items-center justify-between p-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-[#303132] rounded-full transition-all text-[#9aa0a6]"><PanelLeftOpen size={20} /></button>
            <h1 className="text-xl font-black italic uppercase tracking-tighter">Guugie</h1>
          </div>
          <div className="flex items-center gap-4 relative">
            <span className="text-sm font-bold text-blue-500">{quota} Pts</span>
            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-8 h-8 rounded-full bg-[#303132] flex items-center justify-center border border-white/5 overflow-hidden transition-transform active:scale-90 shadow-lg">
               {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} /> : <User size={16} />}
            </button>
            {isProfileOpen && (
              <div className="absolute right-0 top-12 bg-[#1e1f20] border border-white/10 rounded-2xl shadow-2xl z-[260] w-52 overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-4 border-b border-white/5 text-xs">
                  <p className="font-bold text-white truncate">{user?.user_metadata?.name || 'User'}</p>
                  <p className="text-[#9aa0a6] truncate">{user?.email}</p>
                </div>
                <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="w-full flex items-center gap-3 p-4 hover:bg-red-500/10 text-red-400 text-xs font-bold transition-colors">
                  <LogOut size={16} /> Keluar
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
          <div className="max-w-3xl mx-auto py-10">
            {messages.length === 0 ? (
              <div className="mt-20 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <h2 className="text-4xl md:text-5xl font-medium text-white tracking-tight italic uppercase font-black">Halo {user?.user_metadata?.name?.split(' ')[0] || 'GUUG'},</h2>
                <p className="text-[#9aa0a6] text-xl font-normal leading-relaxed tracking-tight">Ada yang bisa saya bantu hari ini?</p>
              </div>
            ) : (
              <div className="space-y-10 pb-32">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-[#303132]' : 'border border-white/5'}`}>
                      <div className="prose prose-invert max-w-none text-[15px] leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                    </div>
                  </div>
                ))}
                {isLoading && <div className="text-sm text-[#9aa0a6] animate-pulse italic font-bold pl-2 tracking-tight">{GUUGIE_MODELS[selectedKasta].loading}</div>}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* INPUT BOX AREA */}
        <div className="p-4 lg:p-10">
          <div className="max-w-3xl mx-auto relative">
            {pendingFile && <div className="mb-2 inline-flex items-center gap-2 bg-[#303132] px-3 py-1.5 rounded-xl text-xs text-blue-400 border border-blue-500/20 animate-in slide-in-from-bottom-2"><FileText size={14} /> {pendingFile.name} <button onClick={() => setPendingFile(null)}><X size={14} /></button></div>}
            
            <div className="bg-[#1e1f20] rounded-[28px] p-2 flex flex-col border border-transparent focus-within:border-[#444746] shadow-2xl transition-all">
              <textarea 
                ref={textAreaRef} rows={1} value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }} 
                placeholder="Tanyakan riset atau akademik Anda..." 
                className="w-full bg-transparent border-none outline-none p-4 text-base resize-none max-h-40 custom-scrollbar placeholder-[#9aa0a6]" 
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex items-center gap-1 relative">
                  {/* MODEL SELECTOR */}
                  <button onClick={() => setIsKastaOpen(!isKastaOpen)} className="flex items-center gap-2 px-3 py-1.5 hover:bg-[#303132] rounded-xl text-xs font-bold text-[#9aa0a6] transition-colors border border-white/5">
                    {GUUGIE_MODELS[selectedKasta].label} <ChevronDown size={14} />
                  </button>
                  {/* ATTACH FILE */}
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-[#303132] rounded-xl text-[#9aa0a6] transition-colors"><Paperclip size={20} /></button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
                  {/* VOICE INPUT */}
                  <button onClick={() => { 
                    const Speech = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition; 
                    if (!Speech) return alert("Browser tidak mendukung voice."); 
                    const rec = new Speech(); rec.lang = "id-ID"; 
                    rec.onstart = () => setIsRecording(true); 
                    rec.onend = () => setIsRecording(false); 
                    rec.onresult = (e: any) => setInputText(prev => prev + " " + e.results[0][0].transcript); 
                    rec.start(); 
                  }} className={`p-2 hover:bg-[#303132] rounded-xl text-[#9aa0a6] transition-colors ${isRecording ? 'text-red-500 animate-pulse' : ''}`}><Mic size={20} /></button>
                  
                  {isKastaOpen && (
                    <div className="absolute bottom-12 left-0 bg-[#1e1f20] border border-white/10 rounded-2xl shadow-2xl p-2 w-64 z-[260] animate-in slide-in-from-bottom-2">
                      {Object.entries(GUUGIE_MODELS).map(([key, cfg]) => (
                        <button key={key} onClick={() => { setSelectedKasta(key as any); setIsKastaOpen(false); }} className={`w-full flex flex-col p-3 rounded-xl text-left transition-colors hover:bg-[#303132] ${selectedKasta === key ? 'bg-[#303132] border border-white/5' : ''}`}>
                          <span className="text-sm font-bold">{cfg.label}</span>
                          <span className="text-[10px] text-[#9aa0a6]">{cfg.sub} ({cfg.points} Pts)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleSendMessage} disabled={isLoading} className={`p-2 rounded-full transition-all ${inputText.trim() || extractedText ? 'text-white' : 'text-[#444746]'}`}>
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
            </div>
            
            <div className="mt-4 pb-4">
               <p className="text-[10px] md:text-[11px] text-[#9aa0a6] text-center font-medium opacity-60 italic tracking-tight">
                 Guugie dapat membuat kesalahan, jadi periksa kembali responsnya.
               </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}