"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mammoth from "mammoth"; 
import { 
  Plus, Send, Mic, Paperclip, User, BookOpen, ShieldCheck, 
  PanelLeftClose, PanelLeftOpen, X, Loader2, Trash2,
  ChevronDown, Check, Shield, AlertCircle, FileText, Download,
  Pencil, GraduationCap, School, Briefcase, LogOut, MessageSquare,
  Mail, Info
} from "lucide-react";

type Message = { id?: string; role: 'user' | 'assistant'; content: string; isFile?: boolean; fileName?: string; fileUrl?: string; };
type Chat = { id: string; title: string; created_at: string; category?: string; };

const CATEGORY_MODES: Record<string, { id: string; desc: string }[]> = {
  "MAHASISWA": [
    { id: "CARI IDE", desc: "Strategi riset & novelty" },
    { id: "RANGKUM MATERI", desc: "Bedah jurnal akademik" },
    { id: "SIMULASI SIDANG", desc: "Bantai logika skripsi" },
    { id: "SEMANGAT REVISI", desc: "Tips perbaikan draf" }
  ],
  "PELAJAR": [
    { id: "TUTOR BIMBEL", desc: "Jelasin materi sekolah" },
    { id: "ESSAY HELPER", desc: "Bantu struktur tugas" },
    { id: "JAGOAN TEKNIS", desc: "Khusus SMK: Troubleshoot" }
  ],
  "PROFESIONAL": [
    { id: "CORPORATE TONE", desc: "Email sopan & profesional" },
    { id: "MEETING DISTILLER", desc: "Rangkum notulensi rapat" },
    { id: "SLIDE BUILDER", desc: "Outline presentasi kerja" }
  ]
};

export default function GuugieHyperFinalPage() {
  const router = useRouter();
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [isLoadingSession, setIsLoadingSession] = useState(true); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [toastAlert, setToastAlert] = useState<{ show: boolean; msg: string } | null>(null);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [quota, setQuota] = useState(0); 
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const [userCategory, setUserCategory] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [pendingFile, setPendingFile] = useState<{ name: string; url: string } | null>(null);
  const [extractedText, setExtractedText] = useState(""); 
  const [researchMode, setResearchMode] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const triggerAlert = (msg: string) => {
    setToastAlert({ show: true, msg });
    setTimeout(() => setToastAlert(null), 4000);
  };

  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600&display=swap');
      * { font-family: 'Outfit', sans-serif !important; font-style: normal !important; letter-spacing: -0.01em; }
      .font-bold { font-weight: 600 !important; }
      @media screen and (max-width: 768px) { 
        textarea, input { font-size: 16px !important; transform: scale(1) !important; } 
      }
      table { display: block; width: 100%; overflow-x: auto; border-collapse: collapse; margin: 1.5rem 0; border-radius: 12px; }
      th, td { border: 1px solid rgba(255,255,255,0.1); padding: 12px 16px; text-align: left; min-width: 140px; }
      th { background: rgba(59, 130, 246, 0.1); font-weight: 600; color: #3b82f6; text-transform: uppercase; font-size: 10px; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
  }, []);

  const handleMicClick = async () => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        startListening();
      } catch (err) { triggerAlert("Izinkan Mic di Settings browser"); }
    } else { startListening(); }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { triggerAlert("Browser gak support Mic."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.onstart = () => { setIsListening(true); triggerAlert("Mendengarkan..."); };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInputText(prev => prev + (prev ? " " : "") + transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); } catch (err) { triggerAlert("Gagal memulai Mic."); }
  };

  const handleSelectChat = async (chatId: string) => {
    setIsSidebarOpen(false);
    if (currentChatId === chatId) return;
    setIsInitialLoad(true);
    setCurrentChatId(chatId);
    setMessages([]);
    const { data } = await supabase.from("messages").select("*").eq("chat_id", chatId).order('created_at', { ascending: true });
    if (data) {
      setMessages(data as Message[]);
      setTimeout(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
        setIsInitialLoad(false);
      }, 50);
    }
  };

  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? 'hidden' : 'auto';
    return () => { document.body.style.overflow = 'auto'; };
  }, [isSidebarOpen]);

  useEffect(() => {
    if (messages.length > 0 && !isInitialLoad) {
      const timer = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  useEffect(() => {
    const initGuard = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setUser(user);
      const category = user.user_metadata?.category;
      if (!category) { setIsCategoryModalOpen(true); } else {
        setUserCategory(category);
        setResearchMode(CATEGORY_MODES[category][0].id);
      }
      const { data: profile } = await supabase.from("profiles").select("quota").eq("id", user.id).single();
      if (profile) setQuota(profile.quota);
      const { data: chats } = await supabase.from("chats").select("*").eq("user_id", user.id).order('created_at', { ascending: false });
      if (chats) setHistory(chats);
      setIsLoadingSession(false);
    };
    initGuard();
  }, [router, supabase]);

  const handleSendMessage = async () => {
    if (isLoading || (!inputText.trim() && !pendingFile) || quota <= 0) return;
    setIsLoading(true);
    setIsInitialLoad(false);
    let chatId = currentChatId;
    try {
      if (!chatId) {
        const { data: newChat } = await supabase.from("chats").insert([{ user_id: user.id, title: inputText.substring(0, 30) || pendingFile?.name.substring(0, 30) }]).select().single();
        if (newChat) { chatId = newChat.id; setCurrentChatId(chatId); setHistory([newChat, ...history]); }
      }
      let finalContent = inputText;
      if (pendingFile) finalContent += `\n\n> 📄 **File Terlampir:** [${pendingFile.name}](${pendingFile.url})`;
      await supabase.from("messages").insert([{ chat_id: chatId, role: 'user', content: finalContent }]);
      setMessages(prev => [...prev, { role: 'user', content: finalContent }]);
      setInputText("");
      setPendingFile(null);
      
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chatId, 
          message: finalContent, 
          mode: researchMode, 
          category: userCategory,
          fileContent: extractedText 
        }),
      });
      const data = await response.json();
      if (!data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        setQuota(prev => prev - 1);
        // FIX: Hapus setExtractedText("") agar teks file bertahan di sesi chat
      }
    } catch (error) { triggerAlert("Server AI sibuk."); } 
    finally { setIsLoading(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      try {
        const result = await mammoth.extractRawText({ arrayBuffer });
        setExtractedText(result.value);
        triggerAlert("Isi file dibaca!");
      } catch (err) { triggerAlert("Gagal baca file."); }
    };
    reader.readAsArrayBuffer(file);

    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${user.id}/${fileName}`;
    try {
      const { error: uploadError } = await supabase.storage.from('research-files').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('research-files').getPublicUrl(filePath);
      setPendingFile({ name: file.name, url: publicUrl });
    } catch (error) { triggerAlert("Gagal upload."); } 
    finally { 
      setIsUploading(false); 
      // FIX: Reset input agar bisa upload file yang sama berulang kali
      e.target.value = ""; 
    }
  };

  const handleDeleteChat = async (id: string) => {
    const { error } = await supabase.from("chats").delete().eq("id", id);
    if (!error) {
      setHistory(history.filter(c => c.id !== id));
      if (currentChatId === id) { setCurrentChatId(null); setMessages([]); setIsInitialLoad(true); }
    }
  };

  const handleRenameChat = async (id: string) => {
    if (!editTitle.trim()) { setEditingChatId(null); return; }
    const { error } = await supabase.from("chats").update({ title: editTitle }).eq("id", id);
    if (!error) {
      setHistory(history.map(c => c.id === id ? { ...c, title: editTitle } : c));
      setEditingChatId(null);
      triggerAlert("Nama chat diperbarui!");
    }
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.push("/login"); };

  const Modal = ({ title, type }: { title: string, type: string }) => (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-[#0B101A]/95 backdrop-blur-2xl">
      <div className="bg-[#1E293B] border border-white/10 w-full max-w-2xl rounded-[30px] overflow-hidden shadow-2xl relative">
        <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white z-10"><X size={20}/></button>
        <div className="p-6 border-b border-white/5 bg-white/5"><h3 className="text-[11px] font-bold uppercase tracking-widest text-blue-500">{title}</h3></div>
        <div className="p-6 max-h-[60vh] overflow-y-auto text-sm text-slate-300 custom-scrollbar leading-relaxed">
          {type === 'terms' ? (
            <div className="space-y-4">
              <p className="font-semibold text-white">Ketentuan Layanan Guugie</p>
              <p>1. Layanan Guugie adalah platform asisten riset berbasis AI.</p>
              <p>2. Setiap interaksi pesan akan mengurangi saldo Poin (Quota).</p>
              <p>3. Dilarang menggunakan sistem ini untuk konten ilegal.</p>
              <p>4. Hasil AI mungkin tidak akurat 100%. Lakukan verifikasi mandiri.</p>
            </div>
          ) : type === 'privacy' ? (
            <div className="space-y-4">
              <p className="font-semibold text-white">Kebijakan Privasi</p>
              <p>1. Data percakapan Anda dienkripsi.</p>
              <p>2. Kami tidak membagikan data pribadi Anda.</p>
              <p>3. File yang diunggah diproses secara aman.</p>
            </div>
          ) : type === 'tips' ? (
            <div className="space-y-4">
              <p className="font-semibold text-white">Tips Maksimalkan Guugie</p>
              <p>• Gunakan mode <strong>Cari Ide</strong> untuk novelty riset.</p>
              <p>• Gunakan mode <strong>Rangkum Materi</strong> untuk bedah jurnal.</p>
              <p>• Gunakan mode <strong>Simulasi Sidang</strong> untuk melatih jawaban.</p>
            </div>
          ) : type === 'feedback' ? (
            <div className="text-center py-6 space-y-4">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/5 inline-block mx-auto"><Mail size={32} className="text-blue-500" /></div>
              <h4 className="text-white font-semibold">Kritik & Saran</h4>
              <p className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-400 font-medium">guuglabs@gmail.com</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  if (isLoadingSession) return <div className="flex h-screen w-full items-center justify-center bg-[#0B101A]"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#0B101A] text-slate-200 overflow-hidden">
      
      {activeModal && <Modal title={activeModal === 'feedback' ? 'KRITIK & SARAN' : activeModal === 'terms' ? 'TERMS OF SERVICE' : activeModal === 'privacy' ? 'PRIVACY POLICY' : 'TIPS RISET'} type={activeModal} />}
      {toastAlert?.show && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[500] bg-blue-600 px-6 py-2 rounded-full text-[10px] font-bold uppercase shadow-2xl animate-in slide-in-from-top-4">{toastAlert.msg}</div>}

      <aside className={`fixed lg:relative z-[100] h-[100dvh] lg:h-full top-0 left-0 transition-all duration-500 bg-[#0F172A] border-r border-white/5 flex flex-col ${isSidebarOpen ? "w-72 shadow-2xl translate-x-0" : "w-72 -translate-x-full lg:w-0 lg:translate-x-0 overflow-hidden"}`}>
        <div className="w-72 flex flex-col h-full p-6 shrink-0">
          <button onClick={() => { setCurrentChatId(null); setMessages([]); setIsSidebarOpen(false); setIsInitialLoad(true); }} className="w-full flex items-center justify-center gap-3 bg-blue-600 p-4 rounded-2xl font-bold text-[10px] uppercase shadow-xl transition-all"><Plus size={16} /> New Chat</button>
          
          <div className="mt-10 flex-1 overflow-y-auto custom-scrollbar">
            <h3 className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-6 px-2">Riwayat Percakapan</h3>
            {history.map((chat) => (
              <div key={chat.id} className="group flex items-center gap-2 mb-3">
                {editingChatId === chat.id ? (
                  <div className="flex-1 flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-blue-500/30">
                    <input autoFocus className="bg-transparent border-none outline-none text-[11px] w-full" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameChat(chat.id)} />
                    <button onClick={() => handleRenameChat(chat.id)} className="text-blue-500"><Check size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => handleSelectChat(chat.id)} className={`flex-1 text-left p-4 rounded-xl text-[11px] border transition-all ${currentChatId === chat.id ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-white/5 border-transparent'}`}>
                    <span className="truncate w-32 inline-block font-medium">{chat.title}</span>
                  </button>
                )}
                <div className="flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-all"> 
                  <button onClick={() => {setEditingChatId(chat.id); setEditTitle(chat.title);}} className="p-2 text-slate-500 hover:text-white"><Pencil size={14} /></button>
                  <button onClick={(e) => {e.stopPropagation(); handleDeleteChat(chat.id);}} className="p-2 text-red-500"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-white/5 space-y-4">
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[10px] font-bold uppercase text-slate-500">
              <button onClick={() => setActiveModal('tips')} className="hover:text-blue-500">Tips</button>
              <button onClick={() => setActiveModal('terms')} className="hover:text-blue-500">Terms</button>
              <button onClick={() => setActiveModal('privacy')} className="hover:text-blue-500">Privacy</button>
              <button onClick={() => setActiveModal('feedback')} className="hover:text-blue-400">Kritik & Saran</button>
            </div>
            <p className="text-[8px] opacity-20 font-bold uppercase tracking-widest">© 2026 GUUG LABS</p>
          </div>
        </div>
      </aside>

      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-[90] lg:hidden backdrop-blur-sm"></div>}

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative h-full">
        <header className="shrink-0 flex items-center justify-between p-4 lg:p-6 bg-[#0B101A]/80 backdrop-blur-xl border-b border-white/5 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400"><PanelLeftOpen size={22} /></button>
            <div className="flex flex-col">
              <h1 className="text-lg lg:text-xl font-bold text-white">Guugie</h1>
              <span className="text-[8px] font-bold text-blue-500 uppercase tracking-widest">{userCategory}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full text-[9px] font-bold text-orange-500 uppercase">Poin: {quota}</div>
            <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="p-2 border border-white/10 rounded-xl hover:bg-white/5 transition-all"><User size={20} /></button>
            {isProfileOpen && (
              <div className="absolute right-6 mt-48 w-56 bg-[#1E293B] border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-white/5 bg-white/5"><p className="text-[10px] font-bold uppercase text-blue-500 mb-1">{userCategory}</p><p className="text-xs font-medium truncate text-slate-400">{user?.email}</p></div>
                <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 hover:bg-red-500/10 text-red-400 text-xs font-bold uppercase"><LogOut size={16} /> Keluar</button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div ref={scrollContainerRef} key={`chat-container-${currentChatId || 'new'}`} className="absolute inset-0 overflow-y-auto custom-scrollbar touch-pan-y overscroll-contain scroll-smooth">
            <div className="max-w-4xl mx-auto p-4 lg:p-8 flex flex-col items-center">
              {messages.length === 0 ? (
                <div className="mt-20 text-center animate-in fade-in duration-1000">
                  <h2 className="text-3xl lg:text-5xl font-bold text-white">Halo {user?.user_metadata?.full_name?.split(' ')[0] || 'Researcher'},</h2>
                  <p className="text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-[0.4em] mt-6">Asisten riset Anda siap membantu draf pekerjaan Anda.</p>
                </div>
              ) : (
                <div className="w-full space-y-6 pb-40">
                  {messages.map((m, i) => (
                    <div key={`${currentChatId}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} ${!isInitialLoad ? 'animate-in fade-in duration-300' : 'animate-in slide-in-from-bottom-4'}`}>
                      <div className={`max-w-[88%] lg:max-w-[80%] p-4 md:p-5 lg:p-6 rounded-[24px] md:rounded-[30px] text-[13px] lg:text-[14px] border shadow-xl ${m.role === 'user' ? 'bg-[#1E293B] border-white/5 rounded-tr-none' : 'bg-blue-600/5 border-blue-500/10 rounded-tl-none'}`}>
                        <div className="prose prose-invert prose-sm lg:prose-base max-w-none text-slate-100 leading-relaxed overflow-x-auto">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start animate-pulse">
                      <div className="bg-blue-600/5 p-4 rounded-2xl border border-blue-500/10 text-xs text-blue-400 font-bold uppercase tracking-widest">Guugie sedang berpikir...</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 p-3 lg:p-8 pb-4 lg:pb-6 bg-gradient-to-t from-[#0B101A] via-[#0B101A] to-transparent z-40">
          <div className="max-w-4xl mx-auto relative flex flex-col items-center">
            {pendingFile && (
              <div className="w-full mb-3 p-4 bg-[#1E293B] border border-blue-500/30 rounded-2xl flex items-center gap-4 shadow-2xl backdrop-blur-xl animate-in slide-in-from-bottom-2">
                <FileText className="text-blue-500" size={18} />
                <p className="text-[10px] font-bold uppercase truncate flex-1">{pendingFile.name}</p>
                <button onClick={() => { setPendingFile(null); setExtractedText(""); }}><X size={16} /></button>
              </div>
            )}
            
            <div className="w-full flex justify-start mb-3">
              <button onClick={() => setIsModeMenuOpen(!isModeMenuOpen)} className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] border border-white/10 rounded-xl text-[9px] font-bold uppercase shadow-xl hover:border-blue-500/30 transition-all">
                <span className="text-blue-500">{researchMode}</span><ChevronDown size={12} className={isModeMenuOpen ? 'rotate-180' : ''} />
              </button>
              {isModeMenuOpen && userCategory && (
                <div className="absolute bottom-full mb-3 left-0 w-64 bg-[#1E293B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 z-[200]">
                  {CATEGORY_MODES[userCategory].map((mode) => (
                    <button key={mode.id} onClick={() => { setResearchMode(mode.id); setIsModeMenuOpen(false); }} className="w-full text-left p-4 hover:bg-white/5 border-b border-white/5 last:border-0">
                      <p className="text-[10px] font-bold uppercase text-slate-200">{mode.id}</p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tight">{mode.desc}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="w-full bg-[#1E293B] border border-white/10 rounded-[28px] md:rounded-[34px] p-1.5 md:p-2 shadow-2xl flex items-end gap-1.5">
              <button onClick={() => fileInputRef.current?.click()} className="p-3.5 text-slate-500 hover:bg-white/5 rounded-2xl transition-all"><Paperclip size={20} /></button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <textarea ref={textAreaRef} rows={1} value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} placeholder="Diskusi..." className="flex-1 bg-transparent border-none outline-none p-3 text-[16px] md:text-[14px] resize-none max-h-40 custom-scrollbar placeholder:text-slate-600" />
              <button onClick={handleMicClick} className={`p-3.5 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-500 hover:text-red-500'}`}><Mic size={20} /></button>
              <button onClick={handleSendMessage} disabled={isLoading} className="p-4 bg-blue-600 text-white rounded-[22px] shadow-xl">{isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : <Send size={20} />}</button>
            </div>
            <p className="mt-3 text-[10px] text-slate-500 font-medium hidden lg:block text-center opacity-60">Guugie bisa saja salah, jadi tolong dicek lagi ya jawabannya.</p>
          </div>
        </div>
      </main>
    </div>
  );
}