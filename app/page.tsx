"use client";

import { useState, useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [researchMode, setResearchMode] = useState("");

  const triggerAlert = (msg: string) => {
    setToastAlert({ show: true, msg });
    setTimeout(() => setToastAlert(null), 4000);
  };

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
      if (!category) {
        setIsCategoryModalOpen(true);
      } else {
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

  const lockCategory = async (category: string) => {
    const { error } = await supabase.auth.updateUser({ data: { category: category } });
    if (!error) {
      setUserCategory(category);
      setResearchMode(CATEGORY_MODES[category][0].id);
      setIsCategoryModalOpen(false);
      triggerAlert(`Role terkunci: ${category}!`);
    } else {
      triggerAlert("Gagal mengunci role.");
    }
  };

  useEffect(() => {
    if (currentChatId) {
      const fetchMessages = async () => {
        const { data } = await supabase.from("messages").select("*").eq("chat_id", currentChatId).order('created_at', { ascending: true });
        if (data) setMessages(data as Message[]);
      };
      fetchMessages();
    }
  }, [currentChatId, supabase]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isLoading]);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { triggerAlert("Gunakan Chrome."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.onresult = (e: any) => setInputText(prev => prev + " " + e.results[0][0].transcript);
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setIsUploading(true);
    const fileName = `${Date.now()}-${file.name}`;
    const filePath = `${user.id}/${fileName}`;
    try {
      const { error: uploadError } = await supabase.storage.from('research-files').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('research-files').getPublicUrl(filePath);
      setPendingFile({ name: file.name, url: publicUrl });
      triggerAlert(`${file.name} Siap Dikirim!`);
    } catch (error) { triggerAlert("Gagal upload file."); } 
    finally { setIsUploading(false); }
  };

  const handleSendMessage = async () => {
    if (isLoading || (!inputText.trim() && !pendingFile) || quota <= 0) return;
    
    setIsLoading(true);
    let chatId = currentChatId;
    
    try {
      if (!chatId) {
        const { data: newChat } = await supabase.from("chats").insert([{ user_id: user.id, title: inputText.substring(0, 30) || pendingFile?.name.substring(0, 30) }]).select().single();
        if (newChat) { chatId = newChat.id; setCurrentChatId(chatId); setHistory([newChat, ...history]); }
      }
      let finalContent = inputText;
      if (pendingFile) finalContent += `\n\n> 📄 **File Terlampir:** [${pendingFile.name}](${pendingFile.url})`;
      const userMsg: Message = { role: 'user', content: finalContent, isFile: !!pendingFile, fileName: pendingFile?.name, fileUrl: pendingFile?.url };
      
      await supabase.from("messages").insert([{ chat_id: chatId, role: 'user', content: finalContent }]);
      setMessages(prev => [...prev, userMsg]);
      setInputText("");
      setPendingFile(null);

      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, message: finalContent, mode: researchMode, category: userCategory }),
      });
      const data = await response.json();
      if (data.error) { triggerAlert(data.error); } 
      else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        setQuota(prev => prev - 1);
      }
    } catch (error) { triggerAlert("Server AI Sibuk."); } 
    finally { setIsLoading(false); }
  };

  const handleDeleteChat = async (id: string) => {
    const { error } = await supabase.from("chats").delete().eq("id", id);
    if (!error) {
      setHistory(history.filter(c => c.id !== id));
      if (currentChatId === id) { setCurrentChatId(null); setMessages([]); }
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

  const Modal = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-[#0B101A]/95 backdrop-blur-2xl animate-in fade-in duration-300">
      <div className="bg-[#1E293B] border border-white/10 w-full max-w-2xl rounded-[30px] md:rounded-[40px] overflow-hidden shadow-2xl relative">
        <button onClick={() => setActiveModal(null)} className="absolute top-4 right-4 md:top-6 md:right-6 p-2 md:p-3 hover:bg-white/10 rounded-2xl transition-all text-slate-400 hover:text-white z-10"><X size={20}/></button>
        <div className="p-6 md:p-10 border-b border-white/5 bg-white/5">
          <h3 className="text-xs font-black uppercase tracking-[0.3em] text-blue-500">{title}</h3>
        </div>
        <div className="p-6 md:p-10 max-h-[60vh] overflow-y-auto text-sm text-slate-300 custom-scrollbar leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );

  if (isLoadingSession) return <div className="flex h-screen w-full items-center justify-center bg-[#0B101A]"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#0B101A] text-slate-200 overflow-hidden font-sans">
      
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[300] bg-[#0B101A] flex items-center justify-center p-4">
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full" />
            <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-600/5 blur-[120px] rounded-full" />
          </div>
          <div className="w-full max-w-5xl text-center relative z-10 animate-in fade-in zoom-in duration-700">
            <h2 className="text-3xl md:text-5xl lg:text-7xl font-black italic uppercase tracking-tighter mb-4 text-white drop-shadow-2xl">SIAPA ANDA?</h2>
            <p className="text-[8px] md:text-xs font-black uppercase tracking-[0.3em] text-blue-500/60 mb-8 md:mb-16">PILIHAN INI PERMANEN UNTUK AKUN ANDA</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-8 px-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <button onClick={() => lockCategory('MAHASISWA')} className="group relative p-6 md:p-10 bg-[#1E293B]/40 border border-white/5 rounded-[30px] md:rounded-[45px] hover:border-blue-500/50 transition-all hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-16 h-16 md:w-20 md:h-20 bg-blue-600/10 rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-8 group-hover:bg-blue-600 group-hover:text-white transition-all text-blue-500 shadow-xl"><GraduationCap size={32} className="md:w-10 md:h-10"/></div>
                <h3 className="font-black uppercase tracking-widest text-base md:text-lg mb-2 md:mb-3 text-white text-center">Mahasiswa</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed text-center">Riset & Sidang</p>
              </button>
              <button onClick={() => lockCategory('PELAJAR')} className="group relative p-6 md:p-10 bg-[#1E293B]/40 border border-white/5 rounded-[30px] md:rounded-[45px] hover:border-orange-500/50 transition-all hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-16 h-16 md:w-20 md:h-20 bg-orange-600/10 rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-8 group-hover:bg-orange-600 group-hover:text-white transition-all text-orange-500 shadow-xl"><School size={32} className="md:w-10 md:h-10"/></div>
                <h3 className="font-black uppercase tracking-widest text-base md:text-lg mb-2 md:mb-3 text-white text-center">Pelajar</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed text-center">SD-SMA & SMK</p>
              </button>
              <button onClick={() => lockCategory('PROFESIONAL')} className="group relative p-6 md:p-10 bg-[#1E293B]/40 border border-white/5 rounded-[30px] md:rounded-[45px] hover:border-emerald-500/50 transition-all hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="w-16 h-16 md:w-20 md:h-20 bg-emerald-600/10 rounded-3xl flex items-center justify-center mx-auto mb-4 md:mb-8 group-hover:bg-emerald-600 group-hover:text-white transition-all text-emerald-500 shadow-xl"><Briefcase size={32} className="md:w-10 md:h-10"/></div>
                <h3 className="font-black uppercase tracking-widest text-base md:text-lg mb-2 md:mb-3 text-white text-center">Profesional</h3>
                <p className="text-[10px] font-bold text-slate-500 uppercase leading-relaxed text-center">Email & Meeting</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {toastAlert?.show && (
        <div className="fixed top-8 left-4 right-4 lg:left-1/2 lg:-translate-x-1/2 z-[200] animate-in slide-in-from-top-4">
          <div className="bg-[#1E293B] border border-blue-500/20 px-6 py-4 rounded-2xl flex items-center gap-4 shadow-2xl">
            <AlertCircle className="text-blue-500" size={20} />
            <p className="text-[11px] font-black uppercase tracking-widest leading-tight">{toastAlert.msg}</p>
          </div>
        </div>
      )}

      {activeModal === 'library' && <Modal title="Library Riset"><div className="space-y-4"><p className="font-bold text-white">Penyimpanan Terpusat</p><p>Kelola semua dokumen riset Anda di sini.</p></div></Modal>}
      {activeModal === 'tos' && <Modal title="Terms of Service"><div className="space-y-4"><p className="font-bold text-white">Ketentuan Penggunaan</p><p>Dilarang keras menggunakan AI ini untuk plagiarisme.</p></div></Modal>}
      {activeModal === 'privacy' && <Modal title="Privacy Policy"><div className="space-y-4"><p className="font-bold text-white">Keamanan Data</p><p>Privasi Anda adalah prioritas kami.</p></div></Modal>}
      {activeModal === 'feedback' && <Modal title="Kritik & Saran"><div className="space-y-6"><div className="bg-white/5 p-6 rounded-2xl border border-white/10"><p className="text-[10px] font-black uppercase text-blue-500 mb-2">Hubungi Kami Melalui Email</p><p className="text-lg font-bold">guuglabs@gmail.com</p></div></div></Modal>}

      <aside className={`fixed lg:relative z-[100] h-full transition-all duration-500 bg-[#0F172A] border-r border-white/5 flex flex-col ${isSidebarOpen ? "w-72 shadow-2xl translate-x-0" : "w-72 -translate-x-full lg:w-0 lg:translate-x-0 overflow-hidden"}`}>
        <div className="w-72 flex flex-col h-full p-6 shrink-0">
          <button onClick={() => {setCurrentChatId(null); setMessages([]); setIsSidebarOpen(false);}} className="w-full flex items-center justify-center gap-3 bg-blue-600 p-4 rounded-2xl font-black text-[10px] uppercase shadow-xl active:scale-95 transition-all">
            <Plus size={16} /> New Chat
          </button>
          <div className="mt-10 flex-1 overflow-y-auto custom-scrollbar">
            <h3 className="text-[10px] uppercase tracking-widest text-slate-500 font-black mb-6 flex items-center gap-2 px-2">History {userCategory}</h3>
            {history.map((chat) => (
              <div key={chat.id} className="group flex items-center gap-2 mb-3">
                {editingChatId === chat.id ? (
                  <div className="flex-1 flex items-center gap-2 bg-white/5 p-2 rounded-xl border border-blue-500/30">
                    <input autoFocus className="bg-transparent border-none outline-none text-[11px] font-bold w-full" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleRenameChat(chat.id)} />
                    <button onClick={() => handleRenameChat(chat.id)} className="text-blue-500"><Check size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => {setCurrentChatId(chat.id); setIsSidebarOpen(false);}} className={`flex-1 text-left p-4 rounded-xl text-[11px] border transition-all font-bold ${currentChatId === chat.id ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                    <span className="truncate w-32 inline-block">{chat.title}</span>
                  </button>
                )}
                <div className="flex gap-1">
                  <button onClick={() => {setEditingChatId(chat.id); setEditTitle(chat.title);}} className="opacity-0 group-hover:opacity-100 p-2 text-slate-500 hover:bg-white/10 rounded-lg transition-all"><Pencil size={14} /></button>
                  <button onClick={(e) => {e.stopPropagation(); handleDeleteChat(chat.id);}} className="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all"><Trash2 size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {isSidebarOpen && <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-black/50 z-[90] lg:hidden backdrop-blur-sm"></div>}

      <main className="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden">
        <header className="shrink-0 flex items-center justify-between p-4 lg:p-6 bg-[#0B101A]/80 backdrop-blur-xl border-b border-white/5 z-40">
          <div className="flex items-center gap-3 lg:gap-6">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-xl text-slate-400 transition-all">
              {isSidebarOpen ? <PanelLeftClose size={22} /> : <PanelLeftOpen size={22} />}
            </button>
            <div className="flex flex-col">
                <h1 className="text-lg lg:text-2xl font-black italic uppercase tracking-tighter">Guugie</h1>
                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{userCategory} MODE</span>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 relative">
            <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 md:px-4 rounded-full"><span className="text-[9px] md:text-[10px] font-black text-orange-500 uppercase tracking-widest">Poin: {quota}</span></div>
            <div className="relative">
              <button onClick={() => setIsProfileOpen(!isProfileOpen)} className="p-2 border border-white/10 rounded-xl hover:bg-white/5 transition-all active:scale-95"><User size={20} /></button>
              {isProfileOpen && (
                <div className="absolute right-0 mt-3 w-56 bg-[#1E293B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-[60]">
                  <div className="p-4 border-b border-white/5 bg-white/5">
                    <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1">{userCategory}</p>
                    <p className="text-xs font-bold truncate text-slate-400">{user?.email}</p>
                  </div>
                  <button onClick={handleLogout} className="w-full flex items-center gap-3 p-4 hover:bg-red-500/10 text-red-400 text-xs font-black uppercase transition-all"><LogOut size={16} /> Keluar Sesi</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8 custom-scrollbar scroll-smooth">
          <div className="max-w-4xl mx-auto space-y-8 pb-10 flex flex-col items-center">
            {messages.length === 0 ? (
              <div className="mt-10 md:mt-20 text-center max-w-xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
                <h2 className="text-3xl lg:text-6xl font-black uppercase italic tracking-tighter text-white">Halo {user?.user_metadata?.full_name?.split(' ')[0] || 'Researcher'},</h2>
                <p className="text-[10px] lg:text-sm text-slate-500 font-black uppercase tracking-[0.4em] mt-4 md:mt-6">Siap Bekerja Sebagai {userCategory}?</p>
              </div>
            ) : (
              <div className="w-full space-y-6 md:space-y-8 pb-20">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4`}>
                    <div className={`max-w-[95%] lg:max-w-[85%] p-4 md:p-5 lg:p-7 rounded-[24px] md:rounded-[28px] lg:rounded-[36px] text-[13px] lg:text-[15px] border shadow-2xl ${m.role === 'user' ? 'bg-[#1E293B] border-white/5 rounded-tr-none' : 'bg-blue-600/5 border-blue-500/10 rounded-tl-none'}`}>
                      {/* FIX: leading-[1.6] (Gak LDR), prose-li:my-0.5 (Rapet list-nya) */}
                      <div className="prose prose-invert prose-sm lg:prose-base max-w-none text-slate-100 leading-[1.6] md:leading-[1.7] break-words prose-li:my-0.5 md:prose-li:my-2 prose-p:my-2 md:prose-p:my-3 prose-headings:text-blue-400 prose-strong:text-white">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start animate-in fade-in duration-500">
                    <div className="bg-blue-600/5 border border-blue-500/10 p-6 rounded-[32px] rounded-tl-none flex gap-2 items-center">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-.3s]" /><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:-.5s]" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* FIX: Padding bottom diperbesar buat iPhone Swipe Bar */}
        <div className="shrink-0 p-3 md:p-4 lg:p-8 pb-8 md:pb-12 bg-gradient-to-t from-[#0B101A] via-[#0B101A] to-transparent">
          <div className="max-w-4xl mx-auto relative">
            {pendingFile && (
              <div className="absolute -top-24 left-0 w-full animate-in slide-in-from-bottom-2 duration-300 px-2">
                <div className="bg-[#1E293B] border border-blue-500/30 p-4 rounded-2xl flex items-center gap-4 shadow-2xl backdrop-blur-xl">
                  <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500"><FileText size={20} /></div>
                  <div className="flex-1 min-w-0"><p className="text-[10px] font-black uppercase text-slate-200 truncate">{pendingFile.name}</p><p className="text-[8px] font-bold text-blue-500 uppercase tracking-widest mt-0.5">Siap Dikirim Ke Awan</p></div>
                  <button onClick={() => setPendingFile(null)} className="p-2 hover:bg-white/10 rounded-lg text-slate-400"><X size={16} /></button>
                </div>
              </div>
            )}
            
            <div className="absolute -top-10 md:-top-12 left-2 z-50">
              <button onClick={() => setIsModeMenuOpen(!isModeMenuOpen)} className="flex items-center gap-3 px-3 py-1.5 md:px-4 md:py-2 bg-[#1E293B] border border-white/10 rounded-xl text-[9px] font-black uppercase shadow-xl hover:border-blue-500/30 transition-all">
                <span className="text-blue-500">{researchMode}</span><ChevronDown size={12} className={`transition-transform duration-300 ${isModeMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {isModeMenuOpen && userCategory && (
                <div className="absolute bottom-12 left-0 w-64 bg-[#1E293B] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  {CATEGORY_MODES[userCategory].map((mode) => (
                    <button key={mode.id} onClick={() => { setResearchMode(mode.id); setIsModeMenuOpen(false); }} className="w-full text-left p-4 hover:bg-white/5 flex items-center justify-between border-b border-white/5 last:border-0 transition-all group">
                      <div><p className={`text-[10px] font-black uppercase transition-colors ${researchMode === mode.id ? 'text-blue-500' : 'text-slate-200 group-hover:text-blue-400'}`}>{mode.id}</p><p className="text-[8px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">{mode.desc}</p></div>
                      {researchMode === mode.id && <Check size={14} className="text-blue-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#1E293B] border border-white/10 rounded-[24px] md:rounded-[28px] lg:rounded-[38px] p-2 md:p-2.5 lg:p-3.5 shadow-2xl focus-within:ring-2 focus-within:ring-blue-500/20 transition-all flex items-end gap-1 md:gap-3 backdrop-blur-sm">
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading || !!pendingFile} className="p-2.5 md:p-3 lg:p-4 text-slate-500 hover:bg-white/5 rounded-2xl transition-all active:scale-90">{isUploading ? <Loader2 size={20} className="animate-spin text-blue-500" /> : <Paperclip size={20} />}</button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              <textarea 
                ref={textAreaRef}
                rows={1} 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} 
                placeholder={`Diskusi...`} 
                className="flex-1 bg-transparent border-none outline-none py-3 px-1 md:p-3 lg:p-4 text-[14px] lg:text-[16px] font-medium resize-none max-h-48 custom-scrollbar placeholder:text-slate-600" 
              />
              <button onClick={startListening} className={`p-2.5 md:p-3 lg:p-4 rounded-2xl transition-all duration-300 ${isListening ? 'bg-red-500 text-white animate-pulse shadow-[0_0_25px_rgba(239,68,68,0.5)]' : 'text-slate-500 hover:bg-white/5 hover:text-red-500 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]'}`}><Mic size={20} /></button>
              <button onClick={handleSendMessage} disabled={isLoading} className="p-2.5 md:p-3 lg:p-5 bg-blue-600 text-white rounded-[18px] md:rounded-[20px] lg:rounded-[24px] flex items-center justify-center min-w-[50px] md:min-w-[55px] lg:min-w-[70px] transition-all active:scale-95 shadow-xl hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send size={20} />}</button>
            </div>

            {/* FIX: Footer Compact (Gap diperkecil, Margin atas diperkecil) */}
            <footer className="mt-4 md:mt-6 flex flex-wrap justify-center items-center gap-x-4 md:gap-x-6 gap-y-2 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] text-white/20 transition-all hover:text-white/40">
              <button onClick={() => setActiveModal('library')} className="hover:text-blue-500 transition-all">Library</button>
              <button onClick={() => setActiveModal('tos')} className="hover:text-blue-500 transition-all">Terms</button>
              <button onClick={() => setActiveModal('privacy')} className="hover:text-blue-500 transition-all">Privacy</button>
              <div className="h-3 w-[1px] bg-white/10 hidden md:block" />
              <button onClick={() => setActiveModal('feedback')} className="hover:text-blue-400 transition-all">Kritik & Saran</button>
              <p className="w-full text-center mt-1 text-[8px] md:text-[9px] text-white/10 select-none tracking-[0.3em]">© 2026 GUUG LABS</p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
}