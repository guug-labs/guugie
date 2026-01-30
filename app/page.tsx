"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { 
  Plus, Send, Paperclip, User, X, Loader2, Trash2,
  PanelLeft, LogOut, MessageSquare, Mic, FileText, Edit3, Shield, FileQuestion
} from "lucide-react"; 
// ^ SPARKLES SUDAH DIHAPUS DARI IMPORT

// --- HELPER BEDAH FILE (TETAP AMAN) ---
const extractTextFromPDF = async (file: File): Promise<string> => {
  try {
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
  } catch (e) { console.error(e); return ""; }
};

const extractTextFromDOCX = async (file: File): Promise<string> => {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (e) { console.error(e); return ""; }
};

interface ChatMessage { id?: string; role: 'user' | 'assistant'; content: string; }
interface ChatHistory { id: string; title: string; created_at: string; user_id: string; }

const GUUGIE_MODELS = {
  "KILAT": { id: "groq-fast", label: "Kilat", points: 0, sub: "Cepat" },
  "NALAR": { id: "groq-reason", label: "Nalar", points: 5, sub: "Logika" },
  "RISET": { id: "groq-pro", label: "Riset", points: 10, sub: "Dokumen" }
} as const;

// Komponen Markdown
const MemoizedMarkdown = memo(({ content }: { content: string }) => {
  return (
    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-sm prose-ul:my-2 prose-li:my-0">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
        {content}
      </ReactMarkdown>
    </div>
  );
});
MemoizedMarkdown.displayName = 'MemoizedMarkdown';

export default function GuugiePublicPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKasta, setSelectedKasta] = useState<keyof typeof GUUGIE_MODELS>("KILAT");
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [user, setUser] = useState<any>(null);
  const [quota, setQuota] = useState<number | null>(null);
  
  const [attachedFiles, setAttachedFiles] = useState<{name: string, content: string}[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  const [toast, setToast] = useState<{type: 'error' | 'success', msg: string} | null>(null);
  const [legalModal, setLegalModal] = useState<{title: string, content: string} | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [activeModal, setActiveModal] = useState<{type: 'rename' | 'delete', id: string, title?: string} | null>(null);
  const [modalInputValue, setModalInputValue] = useState("");

  const showToast = (type: 'error' | 'success', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

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

  // --- UX POLISH: AUTO SCROLL ---
  const scrollToBottom = () => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Handle Rename & Delete
  const handleRename = async () => {
    if (!activeModal?.id || !modalInputValue.trim()) return;
    const { error } = await supabase.from("chats").update({ title: modalInputValue }).eq("id", activeModal.id);
    if (!error) { await loadData(user.id); showToast('success', 'Judul berhasil diubah.'); }
    setActiveModal(null);
  };

  const handleDelete = async () => {
    if (!activeModal?.id) return;
    const { error } = await supabase.from("chats").delete().eq("id", activeModal.id);
    if (!error) { if (currentChatId === activeModal.id) setCurrentChatId(null); await loadData(user.id); showToast('success', 'Percakapan dihapus.'); }
    setActiveModal(null);
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return router.push("/login");
      setUser(authUser); await loadData(authUser.id);
    };
    init();
  }, [router, supabase, loadData]);

  useEffect(() => {
    if (!currentChatId) { setMessages([]); return; }
    const loadMsg = async () => {
      const { data } = await supabase.from("messages").select("*").eq("chat_id", currentChatId).order("created_at", { ascending: true });
      if (data) {
        setMessages(data as ChatMessage[]);
        scrollToBottom();
      }
    };
    loadMsg();
  }, [currentChatId, supabase]);

  // --- LOGIC MIC ---
  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return showToast('error', 'Browser Anda tidak mendukung fitur Mic.');

    if (isListening) { 
      recognitionRef.current?.stop(); 
      setIsListening(false); 
      return; 
    }

    const rec = new SpeechRecognition();
    rec.lang = 'id-ID';
    rec.continuous = false;
    rec.interimResults = false;

    rec.onstart = () => { setIsListening(true); showToast('success', 'Mendengarkan...'); };
    rec.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInputText(prev => (prev + " " + transcript).trim());
    };
    rec.onerror = (e: any) => { 
        setIsListening(false); 
        if(e.error === 'not-allowed') showToast('error', 'Izinkan akses Mikrofon.'); 
        else showToast('error', 'Suara tidak terdeteksi.');
    };
    rec.onend = () => setIsListening(false);
    
    try { rec.start(); recognitionRef.current = rec; } catch (e) { console.error(e); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsProcessingFile(true);
    const file = files[0];
    let text = "";
    
    try {
      if (file.name.endsWith('.docx')) text = await extractTextFromDOCX(file);
      else if (file.name.endsWith('.pdf')) text = await extractTextFromPDF(file);
      else if (file.name.endsWith('.txt')) text = await file.text();
      
      if (text) {
        setAttachedFiles([{ name: file.name, content: text }]);
        showToast('success', 'Dokumen berhasil diunggah.');
      } else { showToast('error', 'Format file tidak didukung.'); }
    } catch (e) { console.error(e); showToast('error', 'Gagal membaca file.'); } 
    finally { 
      setIsProcessingFile(false); 
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- LOGIC KIRIM PESAN ---
  const handleSendMessage = async () => {
    const model = GUUGIE_MODELS[selectedKasta];
    if ((quota ?? 0) < model.points) return showToast('error', 'Poin harian habis. Kembali besok!');
    if (!inputText.trim() && attachedFiles.length === 0) return;

    // Capture State
    const msgContent = inputText;
    const currentFiles = [...attachedFiles];
    const fileContext = currentFiles.map(f => f.content).join("\n\n");
    const displayMsg = currentFiles.length > 0 ? `[File: ${currentFiles[0].name}] ${msgContent}` : msgContent;

    // Reset UI Langsung (Optimistic)
    setInputText("");
    setAttachedFiles([]);
    setIsLoading(true);

    let cid = currentChatId;

    try {
      setMessages(prev => [...prev, { role: "user", content: displayMsg }]);
      
      if (!cid) {
        const { data } = await supabase.from("chats").insert([{ user_id: user.id, title: msgContent.slice(0, 30) || "Percakapan Baru" }]).select().single();
        if (data) { cid = data.id; setCurrentChatId(cid); setHistory(prev => [data, ...prev] as ChatHistory[]); }
      }

      if (cid) {
        await supabase.from("messages").insert([{ chat_id: cid, role: "user", content: displayMsg }]);

        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msgContent, extractedText: fileContext || null, modelId: model.id })
        });

        const data = await res.json();
        
        if (data.content) {
          setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
          await supabase.from("messages").insert([{ chat_id: cid, role: "assistant", content: data.content }]);
          
          const newQ = Math.max(0, (quota ?? 0) - model.points);
          setQuota(newQ); await supabase.from("profiles").update({ quota: newQ }).eq("id", user.id);
        }
      }
    } catch (e) { 
      showToast('error', 'Terjadi kesalahan sistem.'); 
      setInputText(msgContent); 
    }
    finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0a] text-[#ededed] overflow-hidden font-sans">
      <style jsx global>{`
        body { background-color: #0a0a0a; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* SIDEBAR */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-[100] transition-all duration-300 ease-in-out flex flex-col bg-[#0a0a0a] border-r border-white/[0.04] overflow-hidden ${isSidebarOpen ? "w-[280px] translate-x-0" : "w-0 -translate-x-full lg:w-0"}`}>
        <div className="min-w-[280px] flex flex-col h-full">
          {/* BRANDING PUBLIC v2.0 */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xl font-black text-white italic uppercase tracking-tighter">GUUGIE <span className="text-blue-500">v2.0</span></span>
              <span className="text-[9px] text-white/40 tracking-[0.2em] uppercase">The Student's Engine</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-white/40"><X size={20}/></button>
          </div>

          <div className="px-4 pb-4">
            <button onClick={() => { setCurrentChatId(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full flex items-center justify-center gap-2 bg-white text-black font-black p-3 rounded-xl shadow-lg text-sm active:scale-95 transition-transform">
              <Plus size={18}/> Percakapan Baru
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
            {history.map(chat => (
              <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`group flex items-center justify-between p-3 rounded-xl mb-1 cursor-pointer transition-all ${currentChatId === chat.id ? 'bg-white/5 text-white' : 'text-white/40 hover:bg-white/5'}`}>
                <div className="flex items-center gap-3 truncate min-w-0">
                  <MessageSquare size={14}/>
                  <span className="text-sm truncate font-medium">{chat.title || "Percakapan"}</span>
                </div>
                <div className="flex items-center gap-2 opacity-60 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <Edit3 size={13} onClick={(e) => { e.stopPropagation(); setModalInputValue(chat.title); setActiveModal({type: 'rename', id: chat.id, title: chat.title}); }} className="hover:text-white" />
                  <Trash2 size={13} onClick={(e) => { e.stopPropagation(); setActiveModal({type: 'delete', id: chat.id}); }} className="hover:text-red-400" />
                </div>
              </div>
            ))}
          </div>

          {/* Footer Sidebar */}
          <div className="p-4 border-t border-white/[0.04] bg-[#0a0a0a] space-y-4">
             <div className="flex justify-between px-2">
                <button onClick={() => setLegalModal({title: 'Privacy', content: 'Data Anda aman dan terenkripsi. Kami tidak menjual data pengguna.'})} className="text-[10px] text-white/20 hover:text-white flex items-center gap-1 uppercase tracking-wider font-bold">
                   <Shield size={10} /> Privacy
                </button>
                <button onClick={() => setLegalModal({title: 'Terms', content: 'Gunakan Guugie untuk tujuan akademik yang etis.'})} className="text-[10px] text-white/20 hover:text-white flex items-center gap-1 uppercase tracking-wider font-bold">
                   <FileQuestion size={10} /> ToS
                </button>
             </div>

            <div className="flex items-center gap-3 p-3 bg-white/[0.02] border border-white/[0.04] rounded-2xl shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-white truncate uppercase italic tracking-tighter">{user?.user_metadata?.name || 'Mahasiswa'}</p>
                <p className="text-[10px] text-yellow-500 font-black tracking-tighter uppercase">{quota ?? 0} Poin Tersisa</p>
              </div>
              <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} className="p-2 text-white/20 hover:text-red-400 transition-colors"><LogOut size={16}/></button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative w-full h-full bg-[#0a0a0a]">
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/[0.04] sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white/60 hover:text-white transition-all">
              <PanelLeft size={20} className={isSidebarOpen ? "rotate-180" : ""} />
            </button>
            <h1 className="text-[10px] font-black text-white/90 uppercase tracking-[0.3em]">{currentChatId ? "Sesi Aktif" : "GUUG LABS v2.0"}</h1>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 lg:px-0 pt-8 pb-[200px]">
            {messages.length === 0 ? (
              // --- EMPTY STATE (TEXT ONLY - NO LOGO, NO SPARKLES) ---
              <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4 animate-in fade-in zoom-in duration-500">
                <h2 className="text-4xl font-black text-white mb-4 tracking-tighter italic uppercase">
                  GUUGIE <span className="text-blue-500">v2.0</span>
                </h2>
                <div className="space-y-1 opacity-40 max-w-md">
                   <p className="text-sm font-bold tracking-widest uppercase mb-1">The Indonesian Student's Engine</p>
                   <p className="text-xs font-medium">Siap Memulai Riset Akademik?</p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {messages.map((m, i) => (
                  <div key={i} className={`flex w-full ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] lg:max-w-[85%] ${m.role === 'assistant' ? 'w-full' : 'bg-blue-600/20 p-4 lg:p-6 rounded-[24px] rounded-tr-none border border-blue-500/20 shadow-lg text-white'}`}>
                      {m.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-3 opacity-50">
                          <span className="text-[9px] font-black uppercase tracking-widest text-blue-400">Guugie v2.0</span>
                        </div>
                      )}
                      <MemoizedMarkdown content={m.content} />
                    </div>
                  </div>
                ))}
                {isLoading && (
                   <div className="flex items-start gap-3 animate-pulse">
                      <div className="w-full max-w-[85%] bg-white/5 p-6 rounded-[28px]">
                        <div className="flex items-center gap-2 text-white/30 text-xs font-bold uppercase tracking-widest">
                           <Loader2 size={14} className="animate-spin"/> Menganalisis...
                        </div>
                      </div>
                   </div>
                )}
                <div ref={chatEndRef} className="h-4" />
              </div>
            )}
          </div>
        </div>

        {/* INPUT AREA */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent p-4 lg:p-8 z-40">
          <div className="max-w-3xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="flex gap-2 mb-3 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 bg-blue-500/10 px-4 py-2 rounded-full border border-blue-500/20">
                  <FileText size={14} className="text-blue-400" />
                  <span className="text-[10px] font-bold text-blue-100 truncate max-w-[200px]">{attachedFiles[0].name}</span>
                  <button onClick={() => setAttachedFiles([])} className="ml-2 text-white/40 hover:text-white"><X size={14}/></button>
                </div>
              </div>
            )}

            <div className="bg-[#121212] border border-white/10 rounded-[32px] p-2 shadow-2xl focus-within:border-blue-500/50 transition-all relative group">
              <textarea 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(); } }} 
                // PLACEHOLDER NETRAL & PUBLIC
                placeholder="Ketik pertanyaan atau upload jurnal..." 
                className="w-full bg-transparent border-none focus:ring-0 text-[15px] text-white px-4 py-3 resize-none min-h-[50px] max-h-[140px] no-scrollbar placeholder:text-white/20" 
                rows={1}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex gap-1 items-center">
                  <button onClick={toggleMic} className={`p-2.5 rounded-xl transition-all ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-white/30 hover:bg-white/5 hover:text-white'}`}><Mic size={18}/></button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl text-white/30 hover:bg-white/5 hover:text-white transition-all">
                    {isProcessingFile ? <Loader2 className="animate-spin" size={18}/> : <Paperclip size={18}/>}
                  </button>
                  
                  <div className="flex ml-2 bg-black/40 border border-white/5 p-1 rounded-lg">
                    {(Object.keys(GUUGIE_MODELS) as Array<keyof typeof GUUGIE_MODELS>).map((m) => (
                      <button
                        key={m}
                        onClick={() => setSelectedKasta(m)}
                        className={`px-3 py-1 rounded-md text-[8px] font-black uppercase tracking-wider transition-all ${
                          selectedKasta === m ? 'bg-white/10 text-white shadow-sm border border-white/10' : 'text-white/20 hover:text-white'
                        }`}
                      >
                        {GUUGIE_MODELS[m].label}
                      </button>
                    ))}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".docx,.pdf,.txt" />
                </div>
                <button onClick={handleSendMessage} disabled={isLoading || (!inputText.trim() && attachedFiles.length === 0)} className="bg-white text-black w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send size={18} className="-rotate-12 translate-x-[1px]"/> 
                </button>
              </div>
            </div>
            
            <div className="mt-4 flex justify-center opacity-30">
              <p className="text-[9px] font-bold text-white uppercase tracking-[0.3em]">POWERED BY GUUG LABS 2026</p>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL EDIT/DELETE (PUBLIC FRIENDLY) */}
      {activeModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#121212] border border-white/10 rounded-[32px] max-w-sm w-full p-8 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-6">{activeModal.type === 'rename' ? 'Ubah Judul' : 'Hapus Sesi?'}</h3>
            {activeModal.type === 'rename' ? (
              <input value={modalInputValue} onChange={e => setModalInputValue(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:ring-1 focus:ring-blue-500 outline-none mb-6" autoFocus />
            ) : (
              <p className="text-white/40 text-sm mb-6 leading-relaxed italic">Data riset ini akan dihapus secara permanen dan tidak bisa dikembalikan.</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setActiveModal(null)} className="flex-1 p-4 rounded-2xl bg-white/5 text-white/40 text-xs font-black uppercase tracking-widest hover:bg-white/10">Batal</button>
              <button onClick={activeModal.type === 'rename' ? handleRename : handleDelete} className={`flex-1 p-4 rounded-2xl text-xs font-black uppercase tracking-widest ${activeModal.type === 'rename' ? 'bg-white text-black' : 'bg-red-500/10 text-red-500'}`}>
                {activeModal.type === 'rename' ? 'Simpan' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEGAL MODAL */}
      {legalModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLegalModal(null)}>
          <div className="bg-[#161616] border border-white/10 rounded-[32px] max-w-md w-full p-8 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLegalModal(null)} className="absolute top-6 right-6 text-white/20 hover:text-white"><X size={20}/></button>
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white mb-6">Legal: {legalModal.title}</h3>
            <p className="text-white/40 leading-relaxed italic text-sm">{legalModal.content}</p>
          </div>
        </div>
      )}

      {/* TOAST Notification */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] px-6 py-3 rounded-full bg-white text-black text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl animate-in slide-in-from-top-4">
          {toast.msg}
        </div>
      )}
    </div>
  );
}