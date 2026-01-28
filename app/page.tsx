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
  MessageSquare, ChevronDown, Search, Shield, Mic, MicOff
} from "lucide-react";

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

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const [messages, setMessages] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [selectedKasta, setSelectedKasta] = useState<keyof typeof GUUGIE_MODELS>("QUICK");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [isKastaOpen, setIsKastaOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<any[]>([]);
  const [toast, setToast] = useState<{type: 'error' | 'success', msg: string} | null>(null);
  const [legalModal, setLegalModal] = useState<{title: string, content: string} | null>(null);
  const [isListening, setIsListening] = useState(false);

  const showToast = (type: 'error' | 'success', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const showLegal = (title: string, content: string) => {
    setLegalModal({ title, content });
    setIsSidebarOpen(false);
  };

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputText]);

  const loadData = useCallback(async (uid: string) => {
    const { data: prof } = await supabase.from("profiles").select("quota, last_reset").eq("id", uid).single();
    const todayStr = new Date().toDateString();
    if (prof) {
      if (prof.last_reset !== todayStr || prof.quota < 0) {
        await supabase.from("profiles").update({ quota: 25, last_reset: todayStr }).eq("id", uid);
        setQuota(25);
        if(prof.last_reset !== todayStr) showToast('success', 'Poin harian direset: 25 PTS');
      } else {
        setQuota(prof.quota);
      }
    } else {
      await supabase.from("profiles").insert([{ id: uid, quota: 25, last_reset: todayStr }]); 
      setQuota(25);
    }
    const { data: hist } = await supabase.from("chats").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (hist) setHistory(hist);
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

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return showToast('error', 'Browser tidak support Mic.');
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'id-ID';
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => setInputText((prev) => prev + (prev ? ' ' : '') + event.results[0][0].transcript);
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
      recognitionRef.current = recognition;
    } catch(e) { showToast('error', 'Gagal Mic'); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newFiles = await Promise.all(Array.from(files).map(async (file) => {
      let text = "";
      if (file.type === "text/plain" || file.name.endsWith('.txt')) {
        text = await file.text(); 
      } else {
        text = `[File: ${file.name}] Dokumen riset akademik.`;
      }
      return { file, extractedText: text };
    }));
    setPendingFiles(prev => [...prev, ...newFiles]);
    setSelectedKasta("PRO");
    showToast('success', 'Dokumen diserap!');
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async () => {
    const model = GUUGIE_MODELS[selectedKasta];
    const cost = model.points;
    const currentQuota = quota ?? 0;
    if (currentQuota < cost) return showToast('error', `Poin kurang! Sisa: ${currentQuota}`);
    if (!inputText.trim() && pendingFiles.length === 0) return;

    setIsLoading(true);
    const msg = inputText;
    setInputText(""); 
    let cid = currentChatId;
    if (!cid) {
      const { data } = await supabase.from("chats").insert([{ user_id: user.id, title: msg.slice(0, 40) }]).select().single();
      if (data) { cid = data.id; setCurrentChatId(cid); setHistory(prev => [data, ...prev]); }
    }
    setMessages(prev => [...prev, { role: "user", content: msg }]);

    try {
      await supabase.from("messages").insert([{ chat_id: cid, role: "user", content: msg }]);
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: `ROLE: Asisten Riset Akademik Universal. 
                    DOKUMEN: ${pendingFiles.map(f => f.extractedText).join('\n')}
                    PERTANYAAN: ${msg}`, 
          modelId: model.id 
        })
      });

      const data = await res.json();
      if (data.content) {
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
        await supabase.from("messages").insert([{ chat_id: cid, role: "assistant", content: data.content }]);
        if (cost > 0) {
          const safeNewQuota = Math.max(0, currentQuota - cost);
          setQuota(safeNewQuota); 
          await supabase.from("profiles").update({ quota: safeNewQuota }).eq("id", user.id);
        }
      } else { throw new Error(data.error); }
    } catch (e: any) { showToast('error', 'Koneksi bermasalah.'); } 
    finally { setIsLoading(false); setPendingFiles([]); }
  };

  if (isLoadingSession) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0a] text-[#ededed] overflow-hidden font-sans">
      <style jsx global>{`
        /* 1. RESET APPLE & BIRU-BIRU */
        * { -webkit-tap-highlight-color: transparent !important; outline: none !important; }
        input:focus, textarea:focus { outline: none !important; box-shadow: none !important; }
        
        /* 2. STYLE PARAGRAF & MARKDOWN (ELIT MODE) */
        .markdown-body { width: 100%; font-size: 15px; line-height: 1.8; color: #d1d1d1; }
        .markdown-body p { margin-bottom: 1.5rem !important; }
        .markdown-body h1, .markdown-body h2 { color: white; margin-top: 1.5rem; margin-bottom: 1rem; font-weight: 700; }
        
        /* 3. STYLE TABEL (CENTERED & SCROLLABLE) */
        .markdown-body table { 
            display: block; 
            width: 100%; 
            overflow-x: auto; 
            border-collapse: collapse; 
            margin: 1.5rem 0; 
            background: #171717; 
            border-radius: 12px; 
            border: 1px solid #333; 
        }
        .markdown-body th { background: #262626; padding: 12px 16px; text-align: left; color: white; font-weight: 600; }
        .markdown-body td { padding: 12px 16px; border-top: 1px solid #333; color: #ccc; }
        
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 20px); }
      `}</style>

      {/* TOAST & LEGAL MODAL TETEP SAMA */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl border backdrop-blur-md shadow-2xl ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-200' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'}`}>
            {toast.type === 'error' ? <AlertCircle size={18}/> : <CheckCircle2 size={18}/>}
            <span className="text-sm font-medium">{toast.msg}</span>
          </div>
        </div>
      )}

      {legalModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-white/10 rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-white">{legalModal.title}</h3>
              <button onClick={() => setLegalModal(null)} className="p-1 hover:bg-white/10 rounded-full"><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-white/70 whitespace-pre-wrap leading-relaxed">{legalModal.content}</div>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-[90] w-[280px] bg-[#0f0f0f] border-r border-white/[0.04] transition-transform duration-300 flex flex-col ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-5 flex items-center justify-between">
          <span className="text-xl font-bold text-white tracking-tight">Guugie</span>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-white/40"><X size={20}/></button>
        </div>
        <div className="px-4 pb-2">
          <button onClick={() => { setCurrentChatId(null); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 bg-[#1a1a1a] p-3 rounded-xl border border-white/[0.04] text-sm">
            <Plus size={18}/> Riset Baru
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
          {history.map(chat => (
            <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); setIsSidebarOpen(false); }} className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer ${currentChatId === chat.id ? 'bg-[#1a1a1a] text-white' : 'text-white/40 hover:bg-[#1a1a1a]/50'}`}>
              <span className="text-sm truncate max-w-[180px]">{chat.title || "Percakapan"}</span>
              <button onClick={(e) => { e.stopPropagation(); if(confirm("Hapus?")) supabase.from("chats").delete().eq("id",chat.id).then(()=>loadData(user.id)) }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400"><Trash2 size={13}/></button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/[0.04] space-y-3">
          <button onClick={() => showLegal("ToS", "Dilarang Plagiat. AI Bisa Salah.")} className="w-full flex items-center gap-3 text-sm text-white/40"><Shield size={16}/> ToS</button>
          <button onClick={() => showLegal("Privasi", "Data Anda Aman.")} className="w-full flex items-center gap-3 text-sm text-white/40"><FileText size={16}/> Privasi</button>
          <div className="flex items-center gap-3 pt-3 border-t border-white/[0.04]">
            <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center"><User size={16}/></div>
            <div className="flex-1 min-w-0"><p className="text-xs font-bold text-white truncate">{user?.user_metadata?.name?.split(' ')[0]}</p><p className="text-[10px] text-yellow-500 font-bold">{Math.max(0, quota ?? 0)} PTS</p></div>
            <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="p-2 hover:text-red-400"><LogOut size={16}/></button>
          </div>
        </div>
      </aside>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/50 z-[80] lg:hidden" onClick={() => setIsSidebarOpen(false)} />}

      {/* MAIN CONTENT: CENTERED VIEW */}
      <main className="flex-1 flex flex-col relative w-full h-full bg-[#0a0a0a]">
        <header className="h-16 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-white/[0.04]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-white/60"><PanelLeft size={20}/></button>
            <h1 className="text-sm font-semibold text-white/90 truncate max-w-[200px]">{currentChatId ? (history.find(h => h.id === currentChatId)?.title || "Riset") : "Riset Baru"}</h1>
          </div>
          <div className="lg:hidden flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/[0.05]"><Zap size={12} className="text-yellow-500 fill-yellow-500"/><span className="text-xs font-bold">{Math.max(0, quota ?? 0)}</span></div>
        </header>

        {/* AREA CHAT: SIMETRIS TENGAH */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <div className="max-w-3xl mx-auto px-4 lg:px-0 w-full pt-6 pb-[280px]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center opacity-40">
                <Search size={48} className="mb-4 text-white/20"/>
                <h2 className="text-xl font-semibold text-white mb-2">Halo, {user?.user_metadata?.name?.split(' ')[0]}</h2>
                <p className="text-sm text-white/50">Mulai riset akademik lu di sini.</p>
              </div>
            ) : (
              <div className="space-y-10">
                {messages.map((m, i) => (
                  <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-3xl p-5 text-[15px] ${m.role === 'user' ? 'bg-[#262626] text-white rounded-tr-sm border border-white/5' : 'bg-transparent text-[#e5e5e5] px-0'}`}>
                      {/* @ts-ignore */}
                      <ReactMarkdown className="markdown-body" remarkPlugins={[remarkGfm]}>{m.content as string}</ReactMarkdown>
                    </div>
                  </div>
                ))}
                {isLoading && <div className="flex items-center gap-3 text-white/30 text-xs px-4 animate-pulse"><Loader2 className="animate-spin" size={14}/><span>{GUUGIE_MODELS[selectedKasta].loading}</span></div>}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* INPUT BAR: SIMETRIS TENGAH */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-12 pb-6 px-4 safe-area-bottom z-40">
          <div className="max-w-3xl mx-auto space-y-3">
            <div className="relative inline-block">
                <button onClick={() => setIsKastaOpen(!isKastaOpen)} className="flex items-center gap-2 bg-[#1a1a1a] border border-white/[0.08] px-4 py-2 rounded-full text-xs font-bold text-white/70">
                  <div className={`w-2 h-2 rounded-full ${selectedKasta === 'QUICK' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  {GUUGIE_MODELS[selectedKasta].label} <ChevronDown size={12} />
                </button>
                {isKastaOpen && (
                  <div className="absolute bottom-full left-0 mb-3 w-56 bg-[#1a1a1a] border border-white/[0.1] rounded-2xl p-2 z-50 animate-in slide-in-from-bottom-2">
                    {Object.entries(GUUGIE_MODELS).map(([k, v]) => (
                      <button key={k} onClick={() => { setSelectedKasta(k as any); setIsKastaOpen(false); }} className="w-full text-left p-3 hover:bg-white/[0.05] rounded-xl">
                        <div className="text-xs font-bold text-white flex justify-between">{v.label} <span className="text-white/30">{v.points}</span></div>
                        <div className="text-[10px] text-white/40 mt-0.5">{v.sub}</div>
                      </button>
                    ))}
                  </div>
                )}
            </div>
            <div className="bg-[#1a1a1a] border border-white/[0.08] rounded-[28px] p-2 flex flex-col focus-within:border-white/20 relative shadow-2xl">
              <textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(); } }} placeholder="Tanya Guugie..." className="w-full bg-transparent border-none focus:ring-0 text-[16px] text-white placeholder-white/30 px-4 py-3 resize-none no-scrollbar max-h-[160px]" rows={1}/>
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex items-center gap-1">
                  <button onClick={toggleMic} className={`p-2.5 rounded-full transition-all ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-white/40 hover:text-white hover:bg-white/5'}`}>{isListening ? <MicOff size={20}/> : <Mic size={20}/>}</button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-white/40 hover:text-white hover:bg-white/5 rounded-full"><Paperclip size={20}/></button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                <button onClick={handleSendMessage} disabled={isLoading || (!inputText.trim() && pendingFiles.length === 0)} className={`p-2.5 rounded-full ${inputText.trim() || pendingFiles.length > 0 ? 'bg-white text-black shadow-lg' : 'bg-white/10 text-white/20 cursor-not-allowed'}`}>{isLoading ? <Loader2 size={20} className="animate-spin"/> : <Send size={20}/>}</button>
              </div>
            </div>
            <p className="text-[10px] text-center text-white/20 px-4">Guugie dapat membuat kesalahan. Cek ulang info penting.</p>
          </div>
        </div>
      </main>
    </div>
  );
}