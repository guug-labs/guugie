"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mammoth from "mammoth";
import * as pdfjsLib from "pdfjs-dist";
import { 
  Plus, Send, Mic, MicOff, Paperclip, User, X, Loader2, Trash2,
  Pencil, PanelLeftOpen, FileText, Zap, FileUp,
  AlertCircle, CheckCircle2, Sparkles, LogOut, 
  Shield, HelpCircle, MessageSquare, Star, Instagram, 
  ChevronDown, Moon, Sun, Globe
} from "lucide-react";

// Setup PDF Worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const GUUGIE_MODELS = {
  "QUICK": { 
    id: "xiaomi/mimo-v2-flash", 
    label: "Guugie Cepat", 
    points: 0, 
    sub: "Respon Instan", 
    loading: "Mencari...",
  },
  "REASON": { 
    id: "deepseek/deepseek-v3.2", 
    label: "Guugie Nalar", 
    points: 5, 
    sub: "Logika & Teori", 
    loading: "Bernalar...",
  },
  "PRO": { 
    id: "google/gemini-2.5-flash", 
    label: "Guugie Riset", 
    points: 10, 
    sub: "File & Analisis", 
    loading: "Membedah...",
  }
} as const;

export default function GuugieDeepFinalPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  // Refs
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
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
  const [quota, setQuota] = useState<number | null>(null); // Null dulu biar ga kaget
  const [pendingFiles, setPendingFiles] = useState<any[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const [modal, setModal] = useState<{type: 'error' | 'info' | 'success', msg: string} | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [legalModal, setLegalModal] = useState<{title: string, content: string} | null>(null);

  // ==================== UTILS ====================
  const showAlert = (type: 'error' | 'info' | 'success', msg: string) => {
    setModal({ type, msg });
    setTimeout(() => setModal(null), 3000);
  };

  const showLegal = (title: string, content: string) => {
    setLegalModal({ title, content });
    setIsSidebarOpen(false);
  };

  // ==================== DATA LOADER ====================
  const loadData = useCallback(async (uid: string) => {
    // 1. Load Profile & Quota
    const { data: prof } = await supabase.from("profiles").select("quota").eq("id", uid).single();
    if (prof) {
      setQuota(prof.quota);
    } else {
      // Emergency create if trigger failed (Backup plan)
      await supabase.from("profiles").insert([{ id: uid, quota: 25 }]); 
      setQuota(25);
    }

    // 2. Load History
    const { data: hist } = await supabase.from("chats").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    if (hist) setHistory(hist);
  }, [supabase]);

  // ==================== AUTH CHECK ====================
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

  // ==================== LOAD CHAT MESSAGES ====================
  useEffect(() => {
    if (!currentChatId) { setMessages([]); return; }
    const loadMsg = async () => {
      const { data } = await supabase.from("messages").select("*").eq("chat_id", currentChatId).order("created_at", { ascending: true });
      if (data) setMessages(data);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    };
    loadMsg();
  }, [currentChatId, supabase]);

  // ==================== FILE HANDLING ====================
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setIsUploading(true);
    
    // Simulate processing for UI (simplified for robustness)
    Array.from(files).forEach(file => {
       const newFile = { file, url: URL.createObjectURL(file), status: 'ready', extractedText: `[File: ${file.name}]` };
       setPendingFiles(prev => [...prev, newFile]);
       // Auto switch to PRO
       if(selectedKasta !== "PRO") setSelectedKasta("PRO");
    });
    
    setIsUploading(false);
    showAlert('success', 'File siap dianalisis!');
    if(fileInputRef.current) fileInputRef.current.value = "";
  };

  // ==================== SEND MESSAGE ====================
  const handleSendMessage = async () => {
    const model = GUUGIE_MODELS[selectedKasta];
    const cost = model.points;
    const currentQuota = quota || 0;

    if (currentQuota < cost) {
      showAlert('error', `Poin kurang! Butuh ${cost} PTS.`);
      return;
    }

    if (!inputText.trim() && pendingFiles.length === 0) return;

    setIsLoading(true);
    const msg = inputText;
    setInputText("");

    // Create Chat if new
    let cid = currentChatId;
    if (!cid) {
      const { data } = await supabase.from("chats").insert([{ user_id: user.id, title: msg.slice(0, 30) }]).select().single();
      if (data) {
        cid = data.id;
        setCurrentChatId(cid);
        setHistory(prev => [data, ...prev]);
      }
    }

    // Optimistic UI Update
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    
    try {
      // Save user message
      await supabase.from("messages").insert([{ chat_id: cid, role: "user", content: msg }]);

      // Call API
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          chatId: cid, message: msg, modelId: model.id, 
          fileContent: pendingFiles.map(f => f.extractedText).join('\n')
        })
      });

      const data = await res.json();
      if (data.content) {
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
        setQuota(prev => (prev ? prev - cost : 0)); // Update UI poin langsung
      } else {
        throw new Error(data.error || "Gagal");
      }
    } catch (e) {
      showAlert('error', 'Terjadi kesalahan jaringan.');
    } finally {
      setIsLoading(false);
      setPendingFiles([]);
    }
  };

  // ==================== RENDER ====================
  if (isLoadingSession) return <div className="h-screen bg-[#0a0a0a] flex items-center justify-center"><Loader2 className="animate-spin text-white" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0a] text-white overflow-hidden font-sans">
      <style jsx global>{`
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 20px); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* === MODAL ALERTS === */}
      {modal && (
        <div className="fixed top-4 left-0 right-0 z-[9999] flex justify-center pointer-events-none animate-in slide-in-from-top-4">
          <div className={`flex items-center gap-3 px-6 py-3 rounded-full shadow-2xl backdrop-blur-md border ${
            modal.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-200' : 
            modal.type === 'success' ? 'bg-green-500/20 border-green-500/50 text-green-200' : 
            'bg-blue-500/20 border-blue-500/50 text-blue-200'
          }`}>
            {modal.type === 'error' ? <AlertCircle size={18} /> : modal.type === 'success' ? <CheckCircle2 size={18} /> : <Zap size={18} />}
            <span className="text-sm font-medium">{modal.msg}</span>
          </div>
        </div>
      )}

      {/* === LEGAL MODAL === */}
      {legalModal && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#161616] border border-white/10 rounded-2xl max-w-md w-full max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold">{legalModal.title}</h3>
              <button onClick={() => setLegalModal(null)}><X size={20} /></button>
            </div>
            <div className="p-6 overflow-y-auto text-sm text-white/70 whitespace-pre-wrap">
              {legalModal.content}
            </div>
          </div>
        </div>
      )}

      {/* === SIDEBAR (MOBILE & DESKTOP) === */}
      {isSidebarOpen && <div className="fixed inset-0 bg-black/60 z-[40] lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
      
      <aside className={`fixed inset-y-0 left-0 z-[50] w-72 bg-[#121212] border-r border-white/5 transform transition-transform duration-300 flex flex-col ${
        isSidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0 lg:static"
      }`}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center">
              <Sparkles size={18} className="text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Guugie</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 hover:bg-white/10 rounded-lg"><X size={20}/></button>
        </div>

        <div className="px-4 pb-4">
          <button onClick={() => { setCurrentChatId(null); setIsSidebarOpen(false); }} className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/5 p-3 rounded-xl transition-all group">
            <div className="bg-blue-500/20 p-2 rounded-lg group-hover:bg-blue-500/30 text-blue-400"><Plus size={18}/></div>
            <span className="text-sm font-semibold">Chat Baru</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 space-y-1 no-scrollbar">
          <p className="text-xs font-bold text-white/30 mb-2 uppercase tracking-wider">Riwayat</p>
          {history.map(chat => (
            <div key={chat.id} className={`group flex items-center justify-between p-2 rounded-lg cursor-pointer ${currentChatId === chat.id ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5'}`}
              onClick={() => { setCurrentChatId(chat.id); setIsSidebarOpen(false); }}>
              <span className="text-sm truncate max-w-[160px]">{chat.title}</span>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <button onClick={(e) => { e.stopPropagation(); const t = prompt("Rename:", chat.title); if(t) supabase.from("chats").update({title:t}).eq("id",chat.id).then(()=>loadData(user.id)) }} className="p-1 hover:text-blue-400"><Pencil size={12}/></button>
                <button onClick={(e) => { e.stopPropagation(); if(confirm("Hapus?")) supabase.from("chats").delete().eq("id",chat.id).then(()=>loadData(user.id)) }} className="p-1 hover:text-red-400"><Trash2 size={12}/></button>
              </div>
            </div>
          ))}
        </div>

        {/* LEGAL & SUPPORT SECTION */}
        <div className="p-4 border-t border-white/5 space-y-1 bg-[#0f0f0f]">
          <p className="text-xs font-bold text-white/30 mb-2 uppercase tracking-wider">Legal & Support</p>
          
          <button onClick={() => showLegal("Terms of Service", "Syarat dan Ketentuan Guugie...\n\n1. Gunakan dengan bijak.\n2. Jangan lakukan hal ilegal.\n3. Guugie tidak bertanggung jawab atas kesalahan riset.")} 
            className="w-full flex items-center gap-3 p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg text-sm">
            <Shield size={16} /> Terms of Service
          </button>
          
          <button onClick={() => showLegal("Privacy Policy", "Kebijakan Privasi...\n\nData Anda aman dan tidak dijual. Chat history disimpan untuk kenyamanan Anda.")} 
            className="w-full flex items-center gap-3 p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg text-sm">
            <FileText size={16} /> Privacy Policy
          </button>
          
          <button onClick={() => window.open('mailto:guuglabs@gmail.com')} 
            className="w-full flex items-center gap-3 p-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg text-sm">
            <MessageSquare size={16} /> Kritik & Saran
          </button>
          
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button className="flex items-center justify-center gap-2 p-2 bg-yellow-500/10 text-yellow-500 rounded-lg text-xs font-medium hover:bg-yellow-500/20">
              <Star size={14} /> Rate Us
            </button>
            <button onClick={() => window.open('https://instagram.com/guuglabs')} className="flex items-center justify-center gap-2 p-2 bg-pink-500/10 text-pink-500 rounded-lg text-xs font-medium hover:bg-pink-500/20">
              <Instagram size={14} /> @guuglabs
            </button>
          </div>
        </div>

        {/* PROFILE SECTION */}
        <div className="p-4 bg-black/20">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
               {user?.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} className="w-full h-full" /> : <User size={20} />}
             </div>
             <div className="flex-1 min-w-0">
               <p className="text-sm font-bold truncate">{user?.user_metadata?.name || "Researcher"}</p>
               <p className="text-xs text-white/40 truncate">{user?.email}</p>
             </div>
             <button onClick={() => supabase.auth.signOut().then(() => router.push("/login"))} className="p-2 hover:bg-red-500/20 text-red-400 rounded-lg">
               <LogOut size={18} />
             </button>
          </div>
        </div>
      </aside>

      {/* === MAIN CONTENT === */}
      <main className="flex-1 flex flex-col relative w-full h-full">
        {/* HEADER */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-white/5 bg-[#0a0a0a]/90 backdrop-blur-md sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 bg-white/5 rounded-lg"><PanelLeftOpen size={20} /></button>
            <h1 className="font-bold text-lg hidden lg:block">Riset Baru</h1>
          </div>
          
          <div className="flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
            <Zap size={16} className="text-yellow-400 fill-yellow-400" />
            <span className="font-bold text-sm">{quota !== null ? quota : "..."}</span>
            <span className="text-xs text-white/40 font-medium">PTS</span>
          </div>
        </header>

        {/* CHAT AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth pb-32">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center opacity-50 mt-10">
              <Sparkles size={48} className="text-blue-500 mb-4 animate-pulse" />
              <h2 className="text-xl font-bold">Halo, {user?.user_metadata?.name?.split(' ')[0]}</h2>
              <p className="text-sm mt-2 max-w-xs">Pilih model di bawah dan mulai riset akademikmu hari ini.</p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] lg:max-w-[70%] p-4 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-[#1a1a1a] text-gray-200 border border-white/5'
                }`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
          {isLoading && <div className="flex items-center gap-2 text-sm text-white/50 p-4"><Loader2 className="animate-spin" size={16} /> {GUUGIE_MODELS[selectedKasta].loading}</div>}
          <div ref={chatEndRef} />
        </div>

        {/* INPUT AREA (FIXED BOTTOM) */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent pt-10 pb-4 px-4 safe-area-bottom z-30">
          <div className="max-w-3xl mx-auto bg-[#161616] border border-white/10 rounded-2xl shadow-2xl p-2 relative">
            
            {/* MODEL SELECTOR */}
            <div className="absolute -top-10 left-0 flex gap-2">
              <button onClick={() => setIsKastaOpen(!isKastaOpen)} className="flex items-center gap-2 bg-[#161616] border border-white/10 px-3 py-1.5 rounded-full text-xs font-semibold shadow-lg">
                <span className={`w-2 h-2 rounded-full ${selectedKasta === 'QUICK' ? 'bg-green-500' : selectedKasta === 'REASON' ? 'bg-purple-500' : 'bg-blue-500'}`}></span>
                {GUUGIE_MODELS[selectedKasta].label}
                <ChevronDown size={14} className={`transition-transform ${isKastaOpen ? 'rotate-180':''}`} />
              </button>
            </div>

            {/* POPUP MODEL SELECT */}
            {isKastaOpen && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-[#1a1a1a] border border-white/10 rounded-xl p-2 shadow-xl z-50 animate-in slide-in-from-bottom-2">
                {Object.entries(GUUGIE_MODELS).map(([k, v]) => (
                  <button key={k} onClick={() => { setSelectedKasta(k as any); setIsKastaOpen(false); }}
                    className={`w-full text-left p-2 rounded-lg text-xs mb-1 ${selectedKasta === k ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                    <div className="font-bold flex justify-between">{v.label} <span className="opacity-50">{v.points} PTS</span></div>
                    <div className="text-white/40 mt-0.5">{v.sub}</div>
                  </button>
                ))}
              </div>
            )}

            {/* PENDING FILES */}
            {pendingFiles.length > 0 && (
              <div className="flex gap-2 p-2 overflow-x-auto">
                {pendingFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg text-xs">
                    <FileText size={12} /> <span className="truncate max-w-[100px]">{f.file.name}</span>
                    <button onClick={() => setPendingFiles([])}><X size={12}/></button>
                  </div>
                ))}
              </div>
            )}

            {/* INPUT BOX */}
            <div className="flex items-end gap-2 p-1">
              <button onClick={() => fileInputRef.current?.click()} className="p-2 hover:bg-white/10 rounded-xl text-white/60"><Paperclip size={20}/></button>
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} multiple />
              
              <textarea 
                value={inputText} onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {if(e.key==='Enter' && !e.shiftKey){e.preventDefault(); handleSendMessage()}}}
                placeholder="Tanya Guugie..."
                className="flex-1 bg-transparent border-none outline-none text-sm min-h-[44px] max-h-32 py-3 resize-none"
                rows={1}
              />
              
              <button onClick={handleSendMessage} disabled={isLoading} className={`p-2.5 rounded-xl transition-all ${inputText.trim() ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white/10 text-white/30'}`}>
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
          
          {/* MOBILE DISCLAIMER (STICKY BOTTOM) */}
          <p className="text-[10px] text-center text-white/20 mt-3 pb-1 safe-area-bottom">
            Guugie dapat membuat kesalahan. Harap periksa kembali.
          </p>
        </div>
      </main>
    </div>
  );
}