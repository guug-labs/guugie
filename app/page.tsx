"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mammoth from "mammoth"; 
import { 
  Plus, Send, Mic, Paperclip, User, X, Loader2, Trash2,
  Pencil, LogOut, PanelLeftOpen, FileText, ChevronDown, Zap
} from "lucide-react";

const GUUGIE_MODELS = {
  "QUICK": { id: "xiaomi/mimo-v2-flash", label: "Guugie Cepat", points: 0, sub: "Respon instan", loading: "Mencari jawaban..." },
  "REASON": { id: "deepseek/deepseek-v3.2", label: "Guugie Nalar", points: 5, sub: "Deep Reasoning", loading: "Sedang bernalar..." },
  "PRO": { id: "google/gemini-2.5-flash", label: "Guugie Pro", points: 10, sub: "Riset & File", loading: "Memproses dokumen..." }
} as const;

export default function GuugieDeepFinalPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!), []);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  const [modal, setModal] = useState<{type: 'error' | 'info', msg: string} | null>(null);

  const loadData = useCallback(async (uid: string) => {
    const { data: prof } = await supabase.from("profiles").select("quota").eq("id", uid).single();
    const { data: hist } = await supabase.from("chats").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (prof) setQuota(prof.quota);
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

  const handleSendMessage = async () => {
    const model = GUUGIE_MODELS[selectedKasta];
    const isAdmin = user?.email === 'guuglabs@gmail.com';
    if (isLoading || (!inputText.trim() && !extractedText)) return;
    if (!isAdmin && quota < model.points) return setModal({type: 'error', msg: 'Poin Habis! Tunggu reset jam 12 malem.'});

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
        await loadData(user.id); 
      }
    } catch (e) { setModal({type: 'error', msg: 'Sistem Sibuk.'}); } finally {
      setIsLoading(false);
      setPendingFile(null);
      setExtractedText("");
    }
  };

  if (isLoadingSession) return <div className="flex h-[100dvh] items-center justify-center bg-[#0a0a0a]"><Loader2 className="animate-spin text-blue-500" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0a] text-[#e3e3e3] overflow-hidden">
      <style>{`
        * { font-family: 'Inter', sans-serif !important; -webkit-tap-highlight-color: transparent; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .chat-container { height: calc(100dvh - 160px); }
        @media (max-width: 768px) { .chat-container { height: calc(100dvh - 180px); } }
      `}</style>

      {/* ALERT MODAL */}
      {modal && (
        <div className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-[#161616] border border-white/10 p-6 rounded-[32px] max-w-xs w-full text-center shadow-2xl">
            <div className={`w-12 h-12 rounded-full mx-auto mb-4 flex items-center justify-center ${modal.type === 'error' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
              {modal.type === 'error' ? <X size={24} /> : <Zap size={24} />}
            </div>
            <p className="text-sm font-bold mb-6">{modal.msg}</p>
            <button onClick={() => setModal(null)} className="w-full py-3 bg-white text-black rounded-full font-black text-[11px] uppercase tracking-widest">Oke Gas</button>
          </div>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-[500] w-72 bg-[#121212] transform transition-transform duration-300 border-r border-white/5 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:static lg:w-72"}`}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-6 lg:hidden">
            <h2 className="font-black italic uppercase tracking-tighter">Guugie</h2>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2"><X size={20}/></button>
          </div>
          <button onClick={() => { setCurrentChatId(null); setIsSidebarOpen(false); }} className="flex items-center gap-3 bg-[#1e1e1e] hover:bg-[#252525] p-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">
            <Plus size={18} /> Chat Baru
          </button>
          <div className="flex-1 overflow-y-auto mt-6 no-scrollbar space-y-1">
            {history.map(chat => (
              <div key={chat.id} className={`group flex items-center gap-2 p-3 rounded-xl hover:bg-[#1e1e1e] ${currentChatId === chat.id ? 'bg-[#1e1e1e]' : ''}`}>
                <button onClick={() => { setCurrentChatId(chat.id); setIsSidebarOpen(false); }} className="flex-1 text-left text-xs truncate opacity-70">{chat.title}</button>
                <button onClick={async (e) => { e.stopPropagation(); if(confirm("Hapus?")) { await supabase.from("chats").delete().eq("id", chat.id); loadData(user.id); if(currentChatId===chat.id) setMessages([]); } }} className="opacity-0 group-hover:opacity-100 p-1 text-red-500"><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-4 border-t border-white/5">
             <p className="text-[9px] text-[#222] font-black italic uppercase tracking-widest">© 2026 GUUG LABS.</p>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col relative min-w-0 h-full">
        <header className="flex items-center justify-between p-4 bg-[#0a0a0a]/80 backdrop-blur-md sticky top-0 z-[100]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-[#121212] rounded-xl"><PanelLeftOpen size={20} /></button>
            <h1 className="text-xl font-black italic uppercase tracking-tighter">Guugie</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20">
              <span className="text-[10px] font-black text-blue-500 tracking-widest">{quota} PTS</span>
            </div>
            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="w-8 h-8 rounded-full bg-[#121212] border border-white/5 overflow-hidden">
               {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} /> : <User size={16} className="m-auto mt-2" />}
            </button>
            {isProfileOpen && (
              <div className="absolute right-0 top-12 bg-[#161616] border border-white/10 rounded-2xl shadow-2xl z-[260] w-52 overflow-hidden animate-in fade-in zoom-in-95">
                <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="w-full flex items-center gap-3 p-4 hover:bg-red-500/10 text-red-400 text-xs font-bold transition-colors">
                  <LogOut size={16} /> Keluar
                </button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar px-4 chat-container">
          <div className="max-w-2xl mx-auto py-8">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center mt-20">
                <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2">Halo {user?.user_metadata?.name?.split(' ')[0]}</h2>
                <p className="text-sm opacity-40 font-medium">Ada riset apa hari ini?</p>
              </div>
            ) : (
              <div className="space-y-8 pb-32">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] p-4 rounded-3xl text-sm ${m.role === 'user' ? 'bg-[#161616] border border-white/5' : 'bg-transparent'}`}>
                      <div className="prose prose-invert prose-sm"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                    </div>
                  </div>
                ))}
                {isLoading && <div className="text-[10px] font-black uppercase tracking-widest opacity-30 animate-pulse px-4">{GUUGIE_MODELS[selectedKasta].loading}</div>}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* INPUT AREA */}
        <div className="fixed bottom-0 left-0 lg:left-72 right-0 p-4 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
          <div className="max-w-2xl mx-auto">
            {pendingFile && <div className="mb-2 inline-flex items-center gap-2 bg-[#161616] px-3 py-1.5 rounded-full text-[10px] font-bold text-blue-500 border border-blue-500/20"><FileText size={12} /> {pendingFile.name}</div>}
            <div className="bg-[#121212] rounded-[32px] p-2 border border-white/5 flex flex-col shadow-2xl">
              <textarea 
                ref={textAreaRef} rows={1} value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if(e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Tanya Guugie..."
                className="w-full bg-transparent border-none outline-none p-3 text-sm resize-none no-scrollbar"
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex items-center gap-1 relative">
                  <button onClick={() => setIsKastaOpen(!isKastaOpen)} className="px-3 py-1.5 hover:bg-[#1e1e1e] rounded-full text-[10px] font-black uppercase tracking-widest text-[#666] border border-white/5">
                    {GUUGIE_MODELS[selectedKasta].label}
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2 text-[#444]"><Paperclip size={18} /></button>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0]; if(!f) return; setPendingFile(f);
                    const t = f.name.endsWith(".docx") ? (await mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() })).value : await f.text();
                    setExtractedText(t); setSelectedKasta("PRO");
                  }} />
                  <button onClick={() => {
                    const Speech = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
                    if(!Speech) return setModal({type:'info', msg:'Browser gak support.'});
                    const rec = new Speech(); rec.lang = "id-ID";
                    rec.onstart = () => setIsRecording(true); rec.onend = () => setIsRecording(false);
                    rec.onresult = (e: any) => setInputText(prev => prev + " " + e.results[0][0].transcript);
                    try { rec.start(); } catch { setModal({type:'error', msg:'Izinkan Mic di HP.'}); }
                  }} className={`p-2 ${isRecording ? 'text-red-500 animate-pulse' : 'text-[#444]'}`}><Mic size={18} /></button>
                  
                  {isKastaOpen && (
                    <div className="absolute bottom-12 left-0 bg-[#161616] border border-white/10 rounded-3xl shadow-2xl p-2 w-56 z-[600]">
                      {Object.entries(GUUGIE_MODELS).map(([key, cfg]) => (
                        <button key={key} onClick={() => { setSelectedKasta(key as any); setIsKastaOpen(false); }} className={`w-full flex flex-col p-3 rounded-2xl text-left hover:bg-[#1e1e1e] ${selectedKasta === key ? 'bg-[#1e1e1e]' : ''}`}>
                          <span className="text-[11px] font-black uppercase tracking-widest">{cfg.label}</span>
                          <span className="text-[9px] opacity-40 uppercase tracking-tighter">{cfg.sub} ({cfg.points} PTS)</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleSendMessage} disabled={isLoading} className={`p-3 rounded-full transition-all ${inputText.trim() || extractedText ? 'bg-blue-600 text-white' : 'bg-[#1e1e1e] text-[#444]'}`}>
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}