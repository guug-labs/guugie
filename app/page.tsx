"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { 
  Plus, Send, Paperclip, X, Loader2, Trash2,
  PanelLeft, LogOut, MessageSquare, Mic, FileText, Edit3, Shield, FileQuestion
} from "lucide-react"; 

// --- 1. HELPER EXTRACTION (PDF/DOCX) ---
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

// --- 2. LEGAL CONTENT (FULL & PADAT) ---
const LEGAL_CONTENT = {
  TOS: `SYARAT & KETENTUAN (TERMS OF SERVICE)\n\n1. TUJUAN PENGGUNAAN:\nLayanan ini adalah alat bantu riset akademik berbasis AI. Pengguna bertanggung jawab penuh atas penggunaan output yang dihasilkan dalam karya ilmiah.\n\n2. LARANGAN PLAGIASI:\nDilarang keras menyalin mentah (copy-paste) output AI sebagai tugas akhir atau skripsi tanpa proses validasi, penyuntingan, dan pengecekan fakta.\n\n3. BATASAN TANGGUNG JAWAB:\nPengembang (Guug Labs) tidak bertanggung jawab atas halusinasi AI, kesalahan data, atau sanksi akademik yang diterima pengguna akibat kelalaian verifikasi.\n\n4. FAIR USE & KUOTA:\nSistem menerapkan kuota harian (reset tiap 00:00 WIB) untuk menjamin ketersediaan server bagi seluruh mahasiswa Indonesia.\n\n5. HAK CIPTA:\nDokumen yang diunggah pengguna tetap menjadi hak milik pengguna.`,

  PRIVACY: `KEBIJAKAN PRIVASI (PRIVACY POLICY)\n\n1. DATA PRIBADI:\nKami hanya menyimpan data autentikasi dasar (Email/Google Auth) dari Supabase. Kami TIDAK menjual data Anda ke pihak ketiga.\n\n2. KEAMANAN DOKUMEN (RAG):\nDokumen (PDF/DOCX) yang Anda upload diproses sementara di memori server (Edge Runtime) hanya untuk menjawab pertanyaan saat itu. Dokumen TIDAK disimpan secara permanen di database kami.\n\n3. RIWAYAT PERCAKAPAN:\nChat disimpan di database Supabase agar Anda bisa mengakses histori riset. Anda memiliki kendali penuh untuk MENGHAPUS chat kapan saja.\n\n4. MIKROFON & SUARA:\nFitur suara diproses langsung di browser (Client Side) dan diubah menjadi teks sebelum dikirim ke AI. Kami tidak menyimpan rekaman audio Anda.`
};

// --- 3. TIPE DATA ---
interface ChatMessage { id?: string; role: 'user' | 'assistant'; content: string; }
interface ChatHistory { id: string; title: string; created_at: string; user_id: string; }

const GUUGIE_MODELS = {
  "KILAT": { id: "groq-fast", label: "Kilat", points: 0, sub: "Cepat" },
  "NALAR": { id: "groq-reason", label: "Nalar", points: 5, sub: "Logika" },
  "RISET": { id: "groq-pro", label: "Riset", points: 10, sub: "Dokumen" }
} as const;

// --- 4. KOMPONEN MARKDOWN (MODERN & RAPI) ---
const MemoizedMarkdown = memo(({ content }: { content: string }) => {
  return (
    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-sm prose-ul:my-2 prose-li:my-0 prose-table:border-separate prose-table:border-spacing-0 prose-table:w-full prose-table:rounded-xl prose-table:overflow-hidden prose-table:border prose-table:border-white/10 prose-th:bg-white/5 prose-th:p-3 prose-th:text-white prose-td:p-3 prose-td:border-t prose-td:border-white/5 font-sans">
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

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null); // Ref untuk Mic Instance

  // State Utama
  const [sessionId, setSessionId] = useState<string | null>(null); // <-- SESSION FRONTEND
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [history, setHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKasta, setSelectedKasta] = useState<keyof typeof GUUGIE_MODELS>("KILAT");
  
  // UI State
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

  // --- INIT SESSION & USER ---
  useEffect(() => {
    // Cek LocalStorage untuk Session ID
    if (typeof window !== 'undefined') {
      const savedSession = localStorage.getItem('guugie_session');
      if (savedSession) setSessionId(savedSession);
    }

    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return router.push("/login");
      setUser(authUser); 
      await loadData(authUser.id);
    };
    init();
  }, [router, supabase]);

  const showToast = (type: 'error' | 'success', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async (uid: string) => {
    const { data: prof } = await supabase.from("profiles").select("quota, last_reset").eq("id", uid).single();
    const todayStr = new Date().toDateString();
    let currentQuota = 25;
    
    // Logika Reset Harian
    if (prof) {
      if (prof.last_reset !== todayStr) {
        await supabase.from("profiles").update({ quota: 25, last_reset: todayStr }).eq("id", uid);
      } else { 
        currentQuota = prof.quota; 
      }
    }
    setQuota(currentQuota);

    const { data: hist } = await supabase.from("chats").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (hist) setHistory(hist as ChatHistory[]);
  }, [supabase]);

  // Auto Scroll
  useEffect(() => {
    setTimeout(() => {
      chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100);
  }, [messages, isLoading]);

  // Load Messages per Chat
  useEffect(() => {
    if (!currentChatId) { setMessages([]); return; }
    const loadMsg = async () => {
      const { data } = await supabase.from("messages").select("*").eq("chat_id", currentChatId).order("created_at", { ascending: true });
      if (data) setMessages(data as ChatMessage[]);
    };
    loadMsg();
  }, [currentChatId, supabase]);

  // --- 5. LOGIKA MIC (FIX IPHONE/SAFARI) ---
  const toggleMic = useCallback(() => {
    // Deteksi Support Browser (Termasuk WebKit prefix untuk iOS)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        return showToast('error', 'Browser ini tidak support fitur suara (Coba Chrome/Safari terbaru).');
    }

    if (isListening) { 
      if (recognitionRef.current) recognitionRef.current.stop(); 
      setIsListening(false); 
      return; 
    }

    try {
        const rec = new SpeechRecognition();
        rec.lang = 'id-ID'; // Wajib Bahasa Indonesia
        rec.continuous = false; // Mobile friendly: stop after one sentence
        rec.interimResults = false;

        rec.onstart = () => { 
            setIsListening(true); 
            // Feedback Haptic kalau di mobile (opsional)
            if (navigator.vibrate) navigator.vibrate(50);
        };
        
        rec.onresult = (e: any) => {
            const transcript = e.results[0][0].transcript;
            if (transcript) {
               setInputText(prev => (prev + " " + transcript).trim());
            }
            setIsListening(false);
        };
        
        rec.onerror = (e: any) => { 
            setIsListening(false); 
            console.error("Mic Error:", e);
            if (e.error === 'not-allowed') showToast('error', 'Izinkan akses Mikrofon di pengaturan browser.'); 
            else if (e.error === 'no-speech') showToast('error', 'Tidak ada suara terdeteksi.');
            else showToast('error', 'Gagal memproses suara.');
        };
        
        rec.onend = () => setIsListening(false);
        
        rec.start(); 
        recognitionRef.current = rec;
        showToast('success', 'Silakan bicara...');
    } catch (e) { 
        console.error(e); 
        setIsListening(false);
        showToast('error', 'Gagal inisialisasi mikrofon.');
    }
  }, [isListening]);

  // Handle File
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
        showToast('success', 'Dokumen siap dianalisis.');
      } else { showToast('error', 'Format tidak didukung (Gunakan PDF/DOCX).'); }
    } catch (e) { console.error(e); showToast('error', 'Gagal membaca file.'); } 
    finally { 
      setIsProcessingFile(false); 
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // --- 6. SEND MESSAGE (LINK KE ROUTE BARU) ---
  const handleSendMessage = async () => {
    const model = GUUGIE_MODELS[selectedKasta];
    if ((quota ?? 0) < model.points) return showToast('error', 'Poin harian habis. Kembali besok!');
    if (!inputText.trim() && attachedFiles.length === 0) return;

    const msgContent = inputText;
    const currentFiles = [...attachedFiles];
    const fileContext = currentFiles.map(f => f.content).join("\n\n");
    const displayMsg = currentFiles.length > 0 ? `[File: ${currentFiles[0].name}] ${msgContent}` : msgContent;

    setInputText("");
    setAttachedFiles([]);
    setIsLoading(true);

    let cid = currentChatId;

    try {
      setMessages(prev => [...prev, { role: "user", content: displayMsg }]);
      
      // Buat Chat ID Baru di Supabase kalau belum ada
      if (!cid) {
        const { data } = await supabase.from("chats").insert([{ 
            user_id: user.id, 
            title: msgContent.slice(0, 30) || "Riset Baru" 
        }]).select().single();
        if (data) { 
            cid = data.id; 
            setCurrentChatId(cid); 
            setHistory(prev => [data, ...prev] as ChatHistory[]); 
        }
      }

      if (cid) {
        // Simpan User Message ke Supabase
        await supabase.from("messages").insert([{ chat_id: cid, role: "user", content: displayMsg }]);

        // KIRIM KE BACKEND (PENTING: KIRIM clientSessionId)
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message: msgContent, 
            extractedText: fileContext || null, 
            modelId: model.id,
            clientSessionId: sessionId // <--- INI KUNCI MEMORI AGAR GAK PIKUN
          })
        });

        const data = await res.json();
        
        // Cek Session ID Baru dari Server
        if (data.sessionId && !sessionId) {
            setSessionId(data.sessionId);
            localStorage.setItem('guugie_session', data.sessionId);
        }

        if (data.content) {
          setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
          // Simpan AI Response ke Supabase
          await supabase.from("messages").insert([{ chat_id: cid, role: "assistant", content: data.content }]);
          
          // Potong Kuota
          const newQ = Math.max(0, (quota ?? 0) - model.points);
          setQuota(newQ); await supabase.from("profiles").update({ quota: newQ }).eq("id", user.id);
        }
      }
    } catch (e) { 
      showToast('error', 'Koneksi terganggu. Coba lagi.'); 
      setInputText(msgContent); // Balikin teks biar gak ngetik ulang
    }
    finally { setIsLoading(false); }
  };

  // Rename & Delete Logic
  const handleRename = async () => {
    if (!activeModal?.id || !modalInputValue.trim()) return;
    const { error } = await supabase.from("chats").update({ title: modalInputValue }).eq("id", activeModal.id);
    if (!error) { await loadData(user.id); showToast('success', 'Judul diubah.'); }
    setActiveModal(null);
  };

  const handleDelete = async () => {
    if (!activeModal?.id) return;
    const { error } = await supabase.from("chats").delete().eq("id", activeModal.id);
    if (!error) { if (currentChatId === activeModal.id) setCurrentChatId(null); await loadData(user.id); showToast('success', 'Riset dihapus.'); }
    setActiveModal(null);
  };

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0a] text-[#ededed] overflow-hidden font-sans">
      <style jsx global>{`
        body { background-color: #0a0a0a; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        
        /* TABLE STYLING - MODERN & ROUNDED */
        table { width: 100%; border-collapse: separate; border-spacing: 0; border-radius: 12px; overflow: hidden; margin: 1rem 0; border: 1px solid rgba(255,255,255,0.1); }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .chat-animate { animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
      `}</style>

      {/* SIDEBAR */}
      <aside className={`fixed lg:relative inset-y-0 left-0 z-[100] transition-all duration-300 ease-in-out flex flex-col bg-[#0a0a0a] border-r border-white/[0.04] overflow-hidden ${isSidebarOpen ? "w-[280px] translate-x-0" : "w-0 -translate-x-full lg:w-0"}`}>
        <div className="min-w-[280px] flex flex-col h-full">
          
          {/* HEADER SIDEBAR (NO ITALIC) */}
          <div className="p-6 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-xl font-bold text-white uppercase tracking-tight">RISET BARU</span> 
              <span className="text-[10px] text-white/40 tracking-[0.2em] uppercase mt-1">Research Engine</span>
            </div>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-white/40"><X size={20}/></button>
          </div>

          <div className="px-4 pb-4">
            <button onClick={() => { setCurrentChatId(null); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-200 text-black font-bold p-3 rounded-xl shadow-lg text-sm active:scale-95 transition-all">
              <Plus size={18}/> RISET BARU
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 no-scrollbar">
            {history.map(chat => (
              <div key={chat.id} onClick={() => { setCurrentChatId(chat.id); if(window.innerWidth < 1024) setIsSidebarOpen(false); }} className={`group flex items-center justify-between p-3 rounded-xl mb-1 cursor-pointer transition-all ${currentChatId === chat.id ? 'bg-white/10 text-white font-medium' : 'text-white/40 hover:bg-white/5'}`}>
                <div className="flex items-center gap-3 truncate min-w-0">
                  <MessageSquare size={14}/>
                  <span className="text-sm truncate font-medium">{chat.title || "Riset Tanpa Judul"}</span>
                </div>
                <div className="flex items-center gap-2 opacity-60 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                  <Edit3 size={13} onClick={(e) => { e.stopPropagation(); setModalInputValue(chat.title); setActiveModal({type: 'rename', id: chat.id, title: chat.title}); }} className="hover:text-white" />
                  <Trash2 size={13} onClick={(e) => { e.stopPropagation(); setActiveModal({type: 'delete', id: chat.id}); }} className="hover:text-red-400" />
                </div>
              </div>
            ))}
          </div>

          {/* FOOTER SIDEBAR (TOS/PRIVACY) */}
          <div className="p-4 border-t border-white/[0.04] bg-[#0a0a0a] space-y-4">
             <div className="flex justify-center gap-6 px-2">
                <button onClick={() => setLegalModal({title: 'Privacy Policy', content: LEGAL_CONTENT.PRIVACY})} className="text-[10px] text-white/30 hover:text-white flex items-center gap-1.5 uppercase tracking-wider font-bold transition-colors">
                   <Shield size={12} /> Privacy
                </button>
                <div className="w-px h-3 bg-white/10 self-center"></div>
                <button onClick={() => setLegalModal({title: 'Terms of Service', content: LEGAL_CONTENT.TOS})} className="text-[10px] text-white/30 hover:text-white flex items-center gap-1.5 uppercase tracking-wider font-bold transition-colors">
                   <FileQuestion size={12} /> ToS
                </button>
             </div>

            <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate uppercase tracking-tight">{user?.user_metadata?.name || 'Mahasiswa'}</p>
                <p className="text-[10px] text-white/50 font-bold tracking-tight uppercase">{quota ?? 0} Poin Tersisa</p>
              </div>
              <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} className="p-2 text-white/20 hover:text-red-500 transition-colors"><LogOut size={16}/></button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative w-full h-full bg-[#0a0a0a]">
        {/* TOP BAR */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/[0.04] sticky top-0 z-50">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 text-white/60 hover:text-white transition-all">
              <PanelLeft size={20} className={isSidebarOpen ? "rotate-180" : ""} />
            </button>
            <h1 className="text-[10px] font-bold text-white/80 uppercase tracking-[0.2em]">{currentChatId ? "Sesi Aktif" : "GUUGIE v2.0"}</h1>
          </div>
        </header>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto no-scrollbar scroll-smooth">
          <div className="max-w-3xl mx-auto px-4 lg:px-0 pt-8 pb-[200px]">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center px-4 animate-in fade-in zoom-in duration-500">
                <h2 className="text-5xl font-bold text-white mb-6 tracking-tighter uppercase">
                  GUUGIE v2.0
                </h2>
                <div className="space-y-2 opacity-40 max-w-md">
                   <p className="text-sm font-bold tracking-[0.2em] uppercase">The Indonesian Student's Engine</p>
                   <p className="text-xs font-medium text-white/60">Siap Memulai Riset Akademik?</p>
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                {messages.map((m, i) => (
                  <div key={i} className={`flex w-full chat-animate ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] lg:max-w-[85%] ${
                      m.role === 'assistant' 
                        ? 'w-full' 
                        : 'bg-[#1a1a1a] p-4 lg:p-6 rounded-[24px] rounded-tr-none border border-white/10 shadow-lg text-white'
                    }`}>
                      {m.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-3 opacity-50">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Guugie v2.0</span>
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
                           <Loader2 size={14} className="animate-spin"/> Sedang Menganalisis...
                        </div>
                      </div>
                   </div>
                )}
                <div ref={chatEndRef} className="h-4" />
              </div>
            )}
          </div>
        </div>

        {/* INPUT AREA + DISCLAIMER FOOTER */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent p-4 lg:p-8 z-40">
          <div className="max-w-3xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="flex gap-2 mb-3 animate-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full border border-white/10">
                  <FileText size={14} className="text-white" />
                  <span className="text-[10px] font-bold text-white truncate max-w-[200px]">{attachedFiles[0].name}</span>
                  <button onClick={() => setAttachedFiles([])} className="ml-2 text-white/40 hover:text-white"><X size={14}/></button>
                </div>
              </div>
            )}

            <div className="bg-[#121212] border border-white/10 rounded-[32px] p-2 shadow-2xl focus-within:border-white/30 transition-all relative group">
              <textarea 
                value={inputText} 
                onChange={e => setInputText(e.target.value)} 
                onKeyDown={e => { if(e.key === 'Enter' && !e.shiftKey && !isLoading) { e.preventDefault(); handleSendMessage(); } }} 
                placeholder="Ketik pertanyaan atau upload jurnal..." 
                className="w-full bg-transparent border-none focus:ring-0 text-[15px] text-white px-4 py-3 resize-none min-h-[50px] max-h-[140px] no-scrollbar placeholder:text-white/20 font-medium" 
                rows={1}
              />
              <div className="flex items-center justify-between px-2 pb-1">
                <div className="flex gap-1 items-center">
                  <button onClick={toggleMic} className={`p-2.5 rounded-xl transition-all ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-white/30 hover:bg-white/10 hover:text-white'}`}><Mic size={18}/></button>
                  <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl text-white/30 hover:bg-white/10 hover:text-white transition-all">
                    {isProcessingFile ? <Loader2 className="animate-spin" size={18}/> : <Paperclip size={18}/>}
                  </button>
                  
                  <div className="flex ml-2 bg-black/40 border border-white/5 p-1 rounded-lg">
                    {(Object.keys(GUUGIE_MODELS) as Array<keyof typeof GUUGIE_MODELS>).map((m) => (
                      <button
                        key={m}
                        onClick={() => setSelectedKasta(m)}
                        className={`px-3 py-1 rounded-md text-[8px] font-bold uppercase tracking-wider transition-all ${
                          selectedKasta === m ? 'bg-white/20 text-white border border-white/10' : 'text-white/20 hover:text-white'
                        }`}
                      >
                        {GUUGIE_MODELS[m].label}
                      </button>
                    ))}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".docx,.pdf,.txt" />
                </div>
                <button onClick={handleSendMessage} disabled={isLoading || (!inputText.trim() && attachedFiles.length === 0)} className="bg-white text-black w-10 h-10 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  <Send size={18} className="translate-x-[1px]"/> 
                </button>
              </div>
            </div>
            
            <div className="mt-6 flex flex-col items-center justify-center opacity-40 space-y-1">
              <p className="text-[9px] font-bold text-white uppercase tracking-[0.3em]">POWERED BY GUUG LABS 2026</p>
              <p className="text-[8px] text-white/50 font-medium">Guugie dapat membuat kesalahan. Cek informasi penting.</p>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL EDIT/DELETE (NO ITALIC) */}
      {activeModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-[#121212] border border-white/10 rounded-[32px] max-w-sm w-full p-8 shadow-2xl">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white mb-6">{activeModal.type === 'rename' ? 'Ubah Judul' : 'Hapus Sesi?'}</h3>
            {activeModal.type === 'rename' ? (
              <input value={modalInputValue} onChange={e => setModalInputValue(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white text-sm focus:ring-1 focus:ring-white/30 outline-none mb-6 font-medium" autoFocus />
            ) : (
              <p className="text-white/50 text-sm mb-6 leading-relaxed font-medium">Data riset ini akan dihapus secara permanen dan tidak bisa dikembalikan.</p>
            )}
            <div className="flex gap-3">
              <button onClick={() => setActiveModal(null)} className="flex-1 p-4 rounded-2xl bg-white/5 text-white/40 text-xs font-bold uppercase tracking-widest hover:bg-white/10">Batal</button>
              <button onClick={activeModal.type === 'rename' ? handleRename : handleDelete} className={`flex-1 p-4 rounded-2xl text-xs font-bold uppercase tracking-widest ${activeModal.type === 'rename' ? 'bg-white text-black' : 'bg-red-500/10 text-red-500'}`}>
                {activeModal.type === 'rename' ? 'Simpan' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEGAL MODAL (FULL CONTENT - PRE-WRAP) */}
      {legalModal && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLegalModal(null)}>
          <div className="bg-[#161616] border border-white/10 rounded-[32px] max-w-md w-full p-8 shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button onClick={() => setLegalModal(null)} className="absolute top-6 right-6 text-white/20 hover:text-white"><X size={20}/></button>
            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white mb-6">Legal: {legalModal.title}</h3>
            <p className="text-white/60 leading-relaxed text-xs font-medium whitespace-pre-wrap">{legalModal.content}</p>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[2000] px-6 py-3 rounded-full bg-white text-black text-[10px] font-bold uppercase tracking-[0.2em] shadow-2xl animate-in slide-in-from-top-4">
          {toast.msg}
        </div>
      )}
    </div>
  );
}