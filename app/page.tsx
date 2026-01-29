"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { debounce } from 'lodash'; // RESTORED: Sesuai arahan awal
import { 
  Plus, Send, Paperclip, User, X, Loader2, Trash2,
  PanelLeft, Zap, ChevronDown, LogOut, MessageSquare, 
  FileUp, Copy, Mic, MicOff, CheckCircle2
} from "lucide-react";

// --- HELPER BEDAH FILE (FIXED FOR v5.4.530 + EDGE COMPATIBLE) ---
const extractTextFromPDF = async (file: File): Promise<string> => {
  const pdfjs = await import('pdfjs-dist');
  // SINKRONISASI: Menggunakan worker .mjs sesuai versi package.json lu (v5)
  pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  let fullText = '';
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
  }
  return fullText;
};

const extractTextFromDOCX = async (file: File): Promise<string> => {
  const mammoth = await import('mammoth');
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
};

// --- INTERFACES ---
interface ChatMessage { id?: string; role: 'user' | 'assistant'; content: string; }
interface ChatHistory { id: string; title: string; created_at: string; user_id: string; }
interface PendingFile { file: File; extractedText: string; fileType: string; }

const GUUGIE_MODELS = {
  "QUICK": { id: "groq-fast", label: "Guugie Cepat", points: 0, sub: "Respon Kilat", loading: "Mencari..." },
  "REASON": { id: "groq-reason", label: "Guugie Nalar", points: 5, sub: "Logika Deep", loading: "Bernalar..." },
  "PRO": { id: "groq-pro", label: "Guugie Riset", points: 10, sub: "Analisis File", loading: "Membedah..." }
} as const;

const MemoizedMarkdown = memo(({ content }: { content: string }) => {
  const MarkdownWithPlugins = ReactMarkdown as any;
  return (
    <MarkdownWithPlugins className="markdown-body" remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
      {content}
    </MarkdownWithPlugins>
  );
});
MemoizedMarkdown.displayName = 'MemoizedMarkdown';

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

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [selectedKasta, setSelectedKasta] = useState<keyof typeof GUUGIE_MODELS>("QUICK");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [isKastaOpen, setIsKastaOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [toast, setToast] = useState<{type: 'error' | 'success', msg: string} | null>(null);
  const [legalModal, setLegalModal] = useState<{title: string, content: string} | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [lastMessageTime, setLastMessageTime] = useState(0); // FITUR ANTI-SPAM LU

  // --- UTILS ---
  const showToast = (type: 'error' | 'success', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast('success', 'Berhasil disalin!');
    } catch { showToast('error', 'Gagal menyalin'); }
  };

  const showLegal = (title: string, content: string) => {
    setLegalModal({ title, content });
    setIsSidebarOpen(false);
  };

  // --- AUTO HEIGHT TEXTAREA ---
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [inputText]);

  // --- DATA LOADING ---
  const loadData = useCallback(async (uid: string) => {
    const { data: prof } = await supabase.from("profiles").select("quota, last_reset").eq("id", uid).single();
    const todayStr = new Date().toDateString();
    let currentQuota = 25;
    if (prof) {
      if (prof.last_reset !== todayStr) {
        await supabase.from("profiles").update({ quota: 25, last_reset: todayStr }).eq("id", uid);
      } else { currentQuota = prof.quota; }
    } else {
      await supabase.from("profiles").insert([{ id: uid, quota: 25, last_reset: todayStr }]); 
    }
    setQuota(currentQuota);
    const { data: hist } = await supabase.from("chats").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (hist) setHistory(hist as ChatHistory[]);
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
      if (data) setMessages(data as ChatMessage[]);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    loadMsg();
  }, [currentChatId, supabase]);

  // --- HANDLERS ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    showToast('success', 'Sedang membedah dokumen...');
    const processed = await Promise.all(files.map(async (file) => {
      if (file.size > 15 * 1024 * 1024) { showToast('error', `${file.name} kegedean!`); return null; }
      try {
        let text = "";
        if (file.type === 'application/pdf') text = await extractTextFromPDF(file);
        else if (file.type.includes('word') || file.type.includes('document')) text = await extractTextFromDOCX(file);
        else if (file.type === 'text/plain') text = await file.text();
        return { file, extractedText: text, fileType: file.type };
      } catch (err) {
        showToast('error', `Gagal bedah ${file.name}`);
        return null;
      }
    }));

    const validFiles = processed.filter((f): f is PendingFile => f !== null);
    setPendingFiles(prev => [...prev, ...validFiles]);
    setSelectedKasta("PRO");
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async () => {
    const now = Date.now();
    // FITUR ANTI-SPAM LU: Delay 1 detik antar pesan
    if (now - lastMessageTime < 1000) return showToast('error', 'Sabar, satu-satu Bang...');
    
    const model = GUUGIE_MODELS[selectedKasta];
    if ((quota ?? 0) < model.points) return showToast('error', 'Poin kurang!');
    if (!inputText.trim() && pendingFiles.length === 0) return;

    setLastMessageTime(now);
    setIsLoading(true);
    const msg = inputText;
    const combinedText = pendingFiles.map(f => f.extractedText).join("\n\n---\n\n");
    setInputText("");
    let cid = currentChatId;

    try {
      if (!cid) {
        const { data } = await supabase.from("chats").insert([{ user_id: user.id, title: msg.slice(0, 40) || "Riset Akademik" }]).select().single();
        if (data) { cid = data.id; setCurrentChatId(cid); setHistory(prev => [data, ...prev] as ChatHistory[]); }
      }

      if (cid) {
        setMessages(prev => [...prev, { role: "user", content: msg || "Bedah dokumen ini." }]);
        await supabase.from("messages").insert([{ chat_id: cid, role: "user", content: msg || "Bedah dokumen ini." }]);

        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message: msg, 
            extractedText: combinedText || null, 
            modelId: model.id
          })
        });

        const data = await res.json();
        if (data.content) {
          setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
          await supabase.from("messages").insert([{ chat_id: cid, role: "assistant", content: data.content }]);
          if (model.points > 0) {
            const newQ = Math.max(0, (quota ?? 0) - model.points);
            setQuota(newQ); await supabase.from("profiles").update({ quota: newQ }).eq("id", user.id);
          }
        }
      }
    } catch (e) { showToast('error', 'Koneksi AI terputus.'); }
    finally { setIsLoading(false); setPendingFiles([]); }
  };

  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return showToast('error', 'Browser tidak support Mic.');
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'id-ID';
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e: any) => setInputText(prev => prev + " " + e.results[0][0].transcript);
    rec.onend = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
  };

  if (isLoadingSession) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0a] text-[#ededed] overflow-hidden font-sans selection:bg-white/10">
      <style jsx global>{`
        * { -webkit-tap-highlight-color: transparent !important; outline: none !important; }
        .markdown-body { width: 100%; font-size: 16px; line-height: 1.8; color: #d1d1d1; }
        .markdown-body table { display: block; width: 100%; overflow-x: auto; border-collapse: collapse; margin: 2rem 0; background: #111; border-radius: 12px; border: 1px solid #333; }
        .markdown-body th { background: #222; padding: 14px 18px; text-align: left; color: white; border-bottom: 2px solid #333; }
        .markdown-body td { padding: 14px 18px; border-top: 1px solid #222; color: #aaa; vertical-align: top; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 20px); }
      `}</style>

      {/* SIDEBAR NAVIGATION */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-[100] w-[280px] bg-[#0d0d0d] border-r border-white/[0.04] transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" className="w-8 h-8 object-contain" />
            <span className="text-xl font-black text-white italic uppercase tracking-tighter">Guugie Labs</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-white/40 hover:text-white"><X size={20}/></button>
        </div>
        <div className="px-4 pb-4">
          <button onClick={() => { setCurrentChatId(null); setIsSidebarOpen(false); }} className="w-full flex items-center justify-center gap-2 bg-white text-black font-bold p-3 rounded-xl shadow-lg text-sm hover:bg-white/90 transition-all">
            <Plus size={18}/> Riset Baru
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
          {history.map(chat => (
            <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); setIsSidebarOpen(false); }} className={`group flex items-center justify-between p-3 rounded-xl mb-1 cursor-pointer transition-all ${currentChatId === chat.id ? 'bg-[#1a1a1a] text-white shadow-inner' : 'text-white/40 hover:bg-[#1a1a1a]/40'}`}>
              <div className="flex items-center gap-3 truncate min-w-0">
                <MessageSquare size={14}/>
                <span className="text-sm truncate">{chat.title || "Percakapan"}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); if(confirm("Hapus riset ini?")) supabase.from("chats").delete().eq("id",chat.id).then(()=>loadData(user.id)) }} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity"><Trash2 size={13}/></button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/[0.04] space-y-3 bg-[#0a0a0a]">
          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-white/30 tracking-widest uppercase">
            <button onClick={() => showLegal("ToS", "Penggunaan untuk riset akademik saja.")} className="p-2 bg-white/5 rounded-lg text-center hover:bg-white/10">ToS</button>
            <button onClick={() => showLegal("Privasi", "Data anda aman dan terenkripsi.")} className="p-2 bg-white/5 rounded-lg text-center hover:bg-white/10">Privasi</button>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl shadow-sm">
            <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center"><User size={18} className="text-white/40"/></div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate">{user?.user_metadata?.name || 'Researcher'}</p>
              <p className="text-[10px] text-yellow-500 font-black tracking-tighter uppercase">{quota ?? 0} PTS AVAILABLE</p>
            </div>
            <button onClick={() => supabase.auth.signOut()} className="p-2 text-white/20 hover:text-red-400 transition-colors"><LogOut size={16}/></button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col relative w-full h-full bg-[#0a0a0a]">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-2xl border-b border-white/[0.04]">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-white/60 hover:text-white transition-colors"><PanelLeft size={20}/></button>
            <h1 className="text-xs font-black text-white/90 uppercase tracking-widest truncate max-w-[150px]">{currentChatId ? (history.find(h => h.id === currentChatId)?.title || "Riset") : "Environment Baru"}</h1>
          </div>
          <div className="lg:hidden flex items-center gap-1.5 bg-white/5 px-3 py-1 rounded-full border border-white/[0.05]">
            <Zap size={10} className="text-yellow-500 fill-yellow-500"/><span className="text-[10px] font-black text-white">{Math.max(0, quota ?? 0)}</span>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 lg:px-0 w-full pt-10 pb-[280px]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[55vh] text-center animate-in fade-in duration-700">
                <h2 className="text-2xl font-black text-white mb-3 tracking-tight">Halo, {user?.user_metadata?.name?.split(' ')[0]}</h2>
                <p className="text-sm text-white/30 max-w-[280px] leading-relaxed">Upload jurnal atau dokumen riset lu buat mulai analisis mendalam.</p>
              </div>
            ) : (
              <div className="space-y-12">
                {messages.map((m, i) => (
                  <div key={i} className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-500 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`relative group max-w-[90%] lg:max-w-[85%] rounded-[32px] p-6 lg:p-7 ${m.role === 'user' ? 'bg-[#1a1a1a] text-white rounded-tr-none border border-white/[0.06] shadow-xl' : 'bg-transparent text-[#e5e5e5] px-0'}`}>
                      {m.role === 'assistant' && (
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-2"><Zap size={12} className="text-yellow-500 fill-yellow-500"/><span className="text-[10px] font-black text-white uppercase tracking-widest">Guugie Labs AI</span></div>
                          <button onClick={() => copyToClipboard(m.content)} className="opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-white/5 rounded-lg hover:bg-white/10"><Copy size={14} className="text-white/40" /></button>
                        </div>
                      )}
                      <MemoizedMarkdown content={m.content} />
                    </div>
                  </div>
                ))}
                {isLoading && <div className="flex items-center gap-3 text-white/30 text-[10px] uppercase font-bold animate-pulse px-2"><Loader2 className="animate-spin" size={14}/><span>{GUUGIE_MODELS[selectedKasta].loading}</span></div>}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* FLOATING INPUT COMPONENT */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-20 pb-8 px-4 safe-area-bottom z-50">
          <div className="max-w-3xl mx-auto">
            {pendingFiles.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 animate-in slide-in-from-bottom-2">
                {pendingFiles.map((pf, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[10px] font-bold text-emerald-200 shadow-sm">
                    <FileUp size={12}/><span className="truncate max-w-[100px] uppercase tracking-tighter">{pf.file.name}</span>
                    <button onClick={() => setPendingFiles(prev => prev.filter((_, i) => i !== idx))} className="hover:text-white transition-colors"><X size={12}/></button>
                  </div>
                ))}
              </div>
            )}

            <div className="mb-4 flex justify-start">
              <div className="relative">
                <button onClick={() => setIsKastaOpen(!isKastaOpen)} className="flex items-center gap-2 bg-[#111] border border-white/[0.08] px-4 py-2 rounded-full text-[11px] font-black text-white/60 uppercase tracking-tighter shadow-xl hover:border-white/20 transition-all">
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedKasta === 'QUICK' ? 'bg-emerald-500' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]'}`} />
                  {GUUGIE_MODELS[selectedKasta].label} <ChevronDown size={14} className={`transition-transform duration-300 ${isKastaOpen ? 'rotate-180' : ''}`} />
                </button>
                {isKastaOpen && (
                  <div className="absolute bottom-full left-0 mb-3 w-64 bg-[#111] border border-white/[0.1] rounded-[24px] p-2.5 z-[100] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    {Object.entries(GUUGIE_MODELS).map(([k, v]) => (
                      <button key={k} onClick={() => { setSelectedKasta(k as any); setIsKastaOpen(false); }} className={`w-full text-left p-4 rounded-xl transition-all mb-1 ${selectedKasta === k ? 'bg-white/5' : 'hover:bg-white/[0.03]'}`}>
                        <div className="text-[11px] font-black text-white flex justify-between uppercase tracking-widest">{v.label} <span className="text-white/20 text-[10px]">{v.points} PTS</span></div>
                        <div className="text-[10px] text-white/30 mt-1">{v.sub}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-[#111] border border-white/[0.08] rounded-[32px] p-2.5 flex flex-col focus-within:border-white/20 transition-all relative shadow-2xl group">
              <textarea ref={textareaRef} value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(); } }} placeholder="Tanya riset ke Guugie..." className="w-full bg-transparent border-none focus:ring-0 text-[16px] text-white placeholder-white/10 px-5 py-4 resize-none no-scrollbar max-h-[180px]" rows={1}/>
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex items-center gap-1.5">
                  <button onClick={toggleMic} className={`p-3 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' : 'text-white/30 hover:text-white hover:bg-white/5'}`}>{isListening ? <MicOff size={20}/> : <Mic size={20}/>}</button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-3 text-white/30 hover:text-white hover:bg-white/5 rounded-2xl transition-all"><Paperclip size={20}/></button>
                </div>
                <input type="file" ref={fileInputRef} className="hidden" multiple onChange={handleFileUpload} />
                <button onClick={handleSendMessage} disabled={isLoading} className={`flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 ${inputText.trim() || pendingFiles.length > 0 ? 'bg-white text-black shadow-lg scale-100' : 'bg-white/5 text-white/10 scale-90 disabled:opacity-50'}`}>
                  {isLoading ? <Loader2 size={22} className="animate-spin"/> : <Send size={22} className="ml-0.5"/>}
                </button>
              </div>
            </div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-center text-white/10 mt-5 opacity-40 italic">Experimental Lab • Guugie v3.9</p>
          </div>
        </div>
      </main>

      {/* LEGAL & TOAST SYSTEMS */}
      {legalModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setLegalModal(null)}>
          <div className="bg-[#161616] border border-white/10 rounded-3xl max-w-md w-full p-8 text-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 font-bold text-white uppercase tracking-widest text-xs"><span>LEGAL COMPLIANCE: {legalModal.title}</span><button onClick={() => setLegalModal(null)} className="hover:text-red-400 transition-colors"><X size={20}/></button></div>
            <p className="text-white/60 whitespace-pre-wrap leading-relaxed italic">{legalModal.content}</p>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] animate-in slide-in-from-top-4 fade-in duration-300">
          <div className={`px-6 py-3 rounded-full border backdrop-blur-md shadow-2xl flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-200' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'}`}>
             {toast.type === 'success' ? <CheckCircle2 size={16}/> : <Zap size={16}/>}
            <span className="text-xs font-black uppercase tracking-widest">{toast.msg}</span>
          </div>
        </div>
      )}
    </div>
  );
}