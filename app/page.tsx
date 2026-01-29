"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { 
  Plus, Send, Paperclip, User, X, Loader2, Trash2,
  PanelLeft, Zap, ChevronDown, LogOut, MessageSquare, 
  FileUp, Copy, Mic, MicOff, CheckCircle2, Edit3
} from "lucide-react"; // FIX: lucide-react (BUKAN center!)

// --- 1. LOGIKA BEDAH DOKUMEN (PDF & DOCX) ---
const extractTextFromPDF = async (file: File): Promise<string> => {
  const pdfjs = await import('pdfjs-dist');
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

interface ChatMessage { id?: string; role: 'user' | 'assistant'; content: string; }
interface ChatHistory { id: string; title: string; created_at: string; user_id: string; }
interface PendingFile { file: File; extractedText: string; fileType: string; }

const GUUGIE_MODELS = {
  "QUICK": { id: "groq-fast", label: "Guugie Cepat", points: 0, sub: "Respon Kilat", loading: "Mencari..." },
  "REASON": { id: "groq-reason", label: "Guugie Nalar", points: 5, sub: "Logika Deep", loading: "Bernalar..." },
  "PRO": { id: "groq-pro", label: "Guugie Riset", points: 10, sub: "Analisis File", loading: "Membedah..." }
} as const;

const MemoizedMarkdown = memo(({ content }: { content: string }) => {
  return (
    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-table:border prose-table:border-white/10">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); 
  const [user, setUser] = useState<any>(null);
  const [quota, setQuota] = useState<number | null>(null);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [toast, setToast] = useState<{type: 'error' | 'success', msg: string} | null>(null);
  const [legalModal, setLegalModal] = useState<{title: string, content: string} | null>(null);
  const [isListening, setIsListening] = useState(false);

  // --- REVISI 6: AUTO-SCROLL (NGIKUTIN PESAN AI) ---
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const showToast = (type: 'error' | 'success', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const showLegal = (title: string, type: 'tos' | 'privacy') => {
    const content = type === 'tos' 
      ? "Guugie adalah platform riset AI. Pengguna bertanggung jawab penuh atas validasi data. Dilarang menggunakan platform untuk aktivitas ilegal."
      : "Data dokumen diproses secara real-time via Groq LPU dan tidak digunakan untuk melatih model AI. Riwayat dienkripsi di Supabase.";
    setLegalModal({ title, content });
    if(window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  // --- REVISI RESET POIN: TETAP AMAN TIDAK ILANG ---
  const loadData = useCallback(async (uid: string) => {
    const { data: prof } = await supabase.from("profiles").select("quota, last_reset").eq("id", uid).single();
    const todayStr = new Date().toDateString();
    let currentQuota = 25;
    if (prof) {
      if (prof.last_reset !== todayStr) {
        await supabase.from("profiles").update({ quota: 25, last_reset: todayStr }).eq("id", uid);
      } else { currentQuota = prof.quota; }
    }
    setQuota(currentQuota);
    const { data: hist } = await supabase.from("chats").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (hist) setHistory(hist as ChatHistory[]);
  }, [supabase]);

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return router.push("/login"); // REVISI 1: LOGIN AMAN
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
    };
    loadMsg();
  }, [currentChatId, supabase]);

  // --- REVISI 4: FITUR MIC (SPEECH TO TEXT) ---
  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return showToast('error', 'Mic gak support.');
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const rec = new SpeechRecognition();
    rec.lang = 'id-ID';
    rec.onstart = () => setIsListening(true);
    rec.onresult = (e: any) => setInputText(prev => (prev + " " + e.results[0][0].transcript).trim());
    rec.onend = () => setIsListening(false);
    rec.start();
    recognitionRef.current = rec;
  };

  const handleSendMessage = async () => {
    const model = GUUGIE_MODELS[selectedKasta];
    if ((quota ?? 0) < model.points) return showToast('error', 'PTS lu kurang!');
    if (!inputText.trim() && pendingFiles.length === 0) return;
    setIsLoading(true); // REVISI 5: FIX GLITCH
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
          body: JSON.stringify({ message: msg, extractedText: combinedText || null, modelId: model.id })
        });
        const data = await res.json();
        if (data.content) {
          setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
          await supabase.from("messages").insert([{ chat_id: cid, role: "assistant", content: data.content }]);
          const newQ = Math.max(0, (quota ?? 0) - model.points);
          setQuota(newQ); await supabase.from("profiles").update({ quota: newQ }).eq("id", user.id);
        }
      }
    } catch (e) { showToast('error', 'Koneksi AI terputus.'); }
    finally { setIsLoading(false); setPendingFiles([]); }
  };

  if (isLoadingSession) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-white/20" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0a] text-[#ededed] overflow-hidden font-sans">
      <style jsx global>{`
        /* REVISI 3: UNIFIED BLACK #0a0a0a */
        body { background-color: #0a0a0a; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .markdown-body table { display: table; width: 100%; border-collapse: collapse; margin: 1.5rem 0; background: #111; border: 1px solid #333; border-radius: 8px; overflow: hidden; }
        .markdown-body th { background: #222; padding: 12px; text-align: left; border-bottom: 2px solid #333; font-weight: 800; font-size: 13px; text-transform: uppercase; }
        .markdown-body td { padding: 12px; border-top: 1px solid #222; font-size: 14px; color: #aaa; }
      `}</style>

      {/* REVISI 2: SIDEBAR WITH TOUCH-READY ICONS */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-[100] transition-all duration-300 ease-in-out flex flex-col bg-[#0a0a0a] border-r border-white/[0.04] ${isSidebarOpen ? "w-[280px] translate-x-0 shadow-2xl" : "w-0 -translate-x-full lg:w-0"}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Zap size={18} className="text-white fill-white"/>
            <span className="text-xl font-black text-white italic uppercase tracking-tighter">Guugie Labs</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-white/40"><X size={20}/></button>
        </div>
        <div className="px-4 pb-4"><button onClick={() => { setCurrentChatId(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full flex items-center justify-center gap-2 bg-white text-black font-black p-3 rounded-xl shadow-lg text-sm transition-all active:scale-95"><Plus size={18}/> Riset Baru</button></div>
        <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
          {history.map(chat => (
            <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`group flex items-center justify-between p-3 rounded-xl mb-1 cursor-pointer transition-all ${currentChatId === chat.id ? 'bg-white/5 text-white shadow-inner' : 'text-white/40 hover:bg-white/5'}`}>
              <div className="flex items-center gap-3 truncate min-w-0"><MessageSquare size={14}/><span className="text-sm truncate font-medium">{chat.title || "Percakapan"}</span></div>
              {/* REVISI 2: RENAME/DELETE ALWAYS VISIBLE ON MOBILE */}
              <div className="flex items-center gap-2 opacity-60 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                <Edit3 size={13} onClick={(e) => { e.stopPropagation(); const t = prompt("Ubah Nama:", chat.title); if(t) supabase.from("chats").update({title: t}).eq("id", chat.id).then(()=>loadData(user.id)) }} className="hover:text-white" />
                <Trash2 size={13} onClick={(e) => { e.stopPropagation(); if(confirm("Hapus riset?")) supabase.from("chats").delete().eq("id",chat.id).then(()=>loadData(user.id)) }} className="hover:text-red-400" />
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/[0.04] bg-[#0a0a0a] space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => showLegal("Ketentuan Layanan", "tos")} className="text-[10px] font-black uppercase text-white/20 hover:text-white transition-colors text-center p-2 bg-white/[0.02] rounded-lg">ToS</button>
            <button onClick={() => showLegal("Kebijakan Privasi", "privacy")} className="text-[10px] font-black uppercase text-white/20 hover:text-white transition-colors text-center p-2 bg-white/[0.02] rounded-lg">Privasi</button>
          </div>
          <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl shadow-sm">
            <div className="flex-1 min-w-0"><p className="text-xs font-black text-white truncate uppercase italic tracking-tighter">{user?.user_metadata?.name || 'Researcher'}</p><p className="text-[10px] text-yellow-500 font-black tracking-tighter uppercase">{quota ?? 0} PTS AVAILABLE</p></div>
            <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} className="p-2 text-white/20 hover:text-red-400"><LogOut size={16}/></button>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative w-full h-full bg-[#0a0a0a]">
        {/* HEADER WITH SIDEBAR TOGGLE */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-[#0a0a0a] border-b border-white/[0.04] sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white/60 hover:text-white transition-all"><PanelLeft size={20} className={isSidebarOpen ? "rotate-180" : ""} /></button>
            <h1 className="text-[10px] font-black text-white/90 uppercase tracking-[0.3em]">{currentChatId ? "Riset Aktif" : "Riset Baru"}</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 lg:px-0 pt-16 pb-[280px]">
            {messages.length === 0 ? (
              /* REVISI 8: REFINED WELCOME SCREEN */
              <div className="flex flex-col items-center justify-center h-[50vh] text-center">
                <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">Halo, {user?.user_metadata?.name?.split(' ')[0]}</h2>
                <div className="space-y-2 opacity-30">
                   <p className="text-sm font-medium">Guugie didesain khusus untuk <b className="text-white">Deep Research</b>.</p>
                   <p className="text-[10px] font-black uppercase tracking-[0.4em]">Mulai riset dengan unggah dokumen akademik Anda.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                {messages.map((m, i) => (
                  <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] lg:max-w-[85%] ${m.role === 'assistant' ? 'w-full' : 'bg-white/5 p-6 rounded-[28px] border border-white/5 shadow-2xl'}`}>
                      {m.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-4 opacity-40"><Zap size={10} className="fill-yellow-500 text-yellow-500"/><span className="text-[9px] font-black uppercase tracking-widest text-white">Guugie AI Response</span></div>
                      )}
                      <MemoizedMarkdown content={m.content} />
                    </div>
                  </div>
                ))}
                {isLoading && <div className="flex items-center gap-3 text-white/20 text-[10px] font-black uppercase tracking-widest animate-pulse px-2"><Loader2 size={12} className="animate-spin"/><span>Membedah...</span></div>}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* INPUT AREA (UNIFIED BLACK) */}
        <div className="absolute bottom-0 inset-x-0 bg-[#0a0a0a] p-4 lg:p-8 safe-area-bottom">
          <div className="max-w-3xl mx-auto">
            <div className="bg-[#111] border border-white/[0.08] rounded-[32px] p-2.5 shadow-2xl focus-within:border-white/20 transition-all relative">
              <textarea value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(); } }} placeholder="Tanya riset ke Guugie..." className="w-full bg-transparent border-none focus:ring-0 text-[16px] text-white p-4 resize-none min-h-[56px] max-h-[160px] no-scrollbar" rows={1}/>
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex gap-1">
                  <button onClick={toggleMic} className={`p-3 rounded-2xl ${isListening ? 'bg-red-500 text-white shadow-lg animate-pulse' : 'text-white/20 hover:text-white'}`}><Mic size={20}/></button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-3 text-white/20 hover:text-white"><Paperclip size={20}/></button>
                  <input type="file" ref={fileInputRef} className="hidden" multiple onChange={(e) => { showToast('success', 'File diproses...'); }} />
                </div>
                <button onClick={handleSendMessage} disabled={isLoading || !inputText.trim()} className="bg-white text-black w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg"><Send size={20} className="ml-1"/></button>
              </div>
            </div>
            {/* FOOTER & DISCLAIMER */}
            <div className="mt-6 flex flex-col items-center gap-2 opacity-30">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-center text-white italic">Guugie Public Beta • Powered by Groq LPU</p>
              <p className="max-w-[280px] md:max-w-none text-[7px] text-center text-white/60 uppercase tracking-widest leading-relaxed">Peringatan: Guugie AI dapat memberikan jawaban tidak akurat. Selalu verifikasi data penting Anda melalui sumber asli.</p>
            </div>
          </div>
        </div>
      </main>

      {/* REVISI 7 & LEGAL MODAL */}
      {legalModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setLegalModal(null)}>
          <div className="bg-[#161616] border border-white/10 rounded-[32px] max-w-md w-full p-8 text-sm shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLegalModal(null)} className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors"><X size={20}/></button>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-6">Legal: {legalModal.title}</h3>
            <p className="text-white/40 leading-relaxed italic text-[13px]">{legalModal.content}</p>
          </div>
        </div>
      )}

      {/* REVISI 7: MODERN TOAST */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[1000] px-6 py-3 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl animate-in slide-in-from-top-4">
          {toast.msg}
        </div>
      )}
    </div>
  );
}