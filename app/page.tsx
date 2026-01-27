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
  const [researchMode, setResearchMode] = useState("");
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const triggerAlert = (msg: string) => {
    setToastAlert({ show: true, msg });
    setTimeout(() => setToastAlert(null), 4000);
  };

  // FIX: Custom Hook untuk prevent iOS Zoom (Ref Poin 5)
  useEffect(() => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    if (isIOS) {
      const style = document.createElement('style');
      style.innerHTML = `
        @media screen and (max-width: 768px) {
          textarea, input {
            font-size: 16px !important;
            transform: scale(1) !important;
          }
        }
      `;
      document.head.appendChild(style);
      return () => { document.head.removeChild(style); };
    }
  }, []);

  // Mic Fix iOS
  const handleMicClick = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        startListening();
      } catch (err) { triggerAlert("Izin Mic ditolak."); }
    } else { startListening(); }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { triggerAlert("Browser gak support Mic."); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.onstart = () => { setIsListening(true); triggerAlert("🎤 Mendengarkan..."); };
    recognition.onend = () => { setIsListening(false); recognitionRef.current = null; };
    recognition.onresult = (e: any) => {
      const transcript = e.results[0][0].transcript;
      setInputText(prev => prev + (prev ? " " : "") + transcript);
      triggerAlert("✓ Berhasil!");
    };
    recognition.onerror = () => setIsListening(false);
    recognitionRef.current = recognition;
    try { recognition.start(); } catch (err) { triggerAlert("Gagal!"); }
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
      const lastMsg = messages[messages.length - 1];
      if (isLoading || lastMsg.role === 'assistant') {
        setTimeout(() => {
          chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }, 100);
      }
    }
  }, [messages, isLoading, isInitialLoad]);

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
        body: JSON.stringify({ chatId, message: finalContent, mode: researchMode, category: userCategory }),
      });
      const data = await response.json();
      if (!data.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
        setQuota(prev => prev - 1);
      }
    } catch (error) { triggerAlert("Server AI Sibuk."); } 
    finally { setIsLoading(false); }
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
      triggerAlert(`${file.name} Siap!`);
    } catch (error) { triggerAlert("Gagal!"); } 
    finally { setIsUploading(false); }
  };

  if (isLoadingSession) return <div className="flex h-screen w-full items-center justify-center bg-[#0B101A]"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#0B101A] text-slate-200 overflow-hidden font-sans">
      <aside className={`fixed lg:relative z-[100] h-[100dvh] lg:h-full top-0 left-0 transition-all duration-500 bg-[#0F172A] border-r border-white/5 flex flex-col ${isSidebarOpen ? "w-72 shadow-2xl translate-x-0" : "w-72 -translate-x-full lg:w-0 lg:translate-x-0 overflow-hidden"}`}>
        <div className="w-72 flex flex-col h-full p-6 shrink-0">
          <button onClick={() => { setCurrentChatId(null); setMessages([]); setIsSidebarOpen(false); setIsInitialLoad(true); }} className="w-full flex items-center justify-center gap-3 bg-blue-600 p-4 rounded-2xl font-black text-[10px] uppercase shadow-xl transition-all"><Plus size={16} /> New Chat</button>
          <div className="mt-10 flex-1 overflow-y-auto custom-scrollbar">
            {history.map((chat) => (
              <button key={chat.id} onClick={() => handleSelectChat(chat.id)} className={`w-full text-left mb-3 p-4 rounded-xl text-[11px] border transition-all font-bold ${currentChatId === chat.id ? 'bg-blue-600/10 border-blue-500/50 text-blue-400' : 'bg-white/5 border-transparent'}`}>
                <span className="truncate w-48 inline-block">{chat.title}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative h-full">
        <header className="shrink-0 flex items-center justify-between p-4 lg:p-6 bg-[#0B101A]/80 backdrop-blur-xl border-b border-white/5 z-40">
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-white/5 rounded-xl"><PanelLeftOpen size={22} /></button>
          <h1 className="text-lg font-black italic uppercase">Guugie</h1>
          <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-1.5 rounded-full text-[9px] font-black text-orange-500">Poin: {quota}</div>
        </header>

        <div className="flex-1 min-h-0 relative overflow-hidden">
          <div ref={scrollContainerRef} className="absolute inset-0 overflow-y-auto custom-scrollbar touch-pan-y overscroll-contain">
            <div className="max-w-4xl mx-auto p-4 flex flex-col items-center">
              {messages.length === 0 ? (
                <div className="mt-20 text-center animate-in fade-in duration-1000">
                  <h2 className="text-3xl font-black uppercase italic text-white">Halo {user?.user_metadata?.full_name?.split(' ')[0] || 'Researcher'},</h2>
                  <p className="text-[10px] text-slate-500 font-black uppercase mt-4">Siap Bekerja Sebagai {userCategory}?</p>
                </div>
              ) : (
                <div className="w-full space-y-4 pb-32">
                  {messages.map((m, i) => (
                    <div key={`${currentChatId}-${i}`} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} ${!isInitialLoad ? 'animate-in fade-in duration-300' : 'animate-in slide-in-from-bottom-4'}`}>
                      <div className={`max-w-[88%] p-3 md:p-5 rounded-[24px] text-[13px] border shadow-2xl ${m.role === 'user' ? 'bg-[#1E293B] border-white/5 rounded-tr-none' : 'bg-blue-600/5 border-blue-500/10 rounded-tl-none'}`}>
                        <div className="prose prose-invert prose-sm max-w-none text-slate-100 leading-tight !prose-p:m-0 [&_p]:!m-0 [&_p]:!mb-1">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 p-3 pb-10 bg-gradient-to-t from-[#0B101A] to-transparent z-40">
          <div className="max-w-4xl mx-auto relative">
            <div className="bg-[#1E293B] border border-white/10 rounded-[30px] p-2 flex items-end gap-2 backdrop-blur-sm">
              <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-500"><Paperclip size={20} /></button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
              {/* FIX ZOOM: text-[16px] & inline style */}
              <textarea 
                ref={textAreaRef} 
                rows={1} 
                value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())} 
                placeholder="Diskusi..." 
                className="flex-1 bg-transparent border-none outline-none p-3 text-[16px] md:text-[14px] resize-none max-h-40 custom-scrollbar" 
                style={{ fontSize: '16px', WebkitTextSizeAdjust: '100%' }}
              />
              <button onClick={handleMicClick} className={`p-3 rounded-2xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-500'}`}><Mic size={20} /></button>
              <button onClick={handleSendMessage} className="p-4 bg-blue-600 text-white rounded-[20px] shadow-xl"><Send size={20} /></button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}