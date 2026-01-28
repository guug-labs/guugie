"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mammoth from "mammoth"; 
import { 
  Plus, Send, Mic, Paperclip, User, X, Loader2, Trash2,
  Check, Pencil, LogOut, PanelLeftOpen, FileText, Sparkles, Zap, BrainCircuit
} from "lucide-react";

// --- TYPES ---
interface Message { id?: string; role: 'user' | 'assistant'; content: string; }
interface Chat { id: string; title: string; created_at: string; }

const ACADEMIA_MODELS = {
  "MIMO": { id: "xiaomi/mimo-v2-flash", label: "Mimo", points: 0, engine: "Mimo V2", loading: "Guugie sedang berpikir..." },
  "GEMINI": { id: "google/gemini-2.5-flash", label: "Gemini", points: 10, engine: "Gemini 2.5 Flash", loading: "Guugie sedang memproses file..." },
  "DEEPSEEK": { id: "deepseek/deepseek-v3.2", label: "DeepSeek", points: 5, engine: "DeepSeek V3.2", loading: "Guugie sedang mencari argumen..." }
} as const;

export default function GuugieHyperFinalPage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const [isLoadingSession, setIsLoadingSession] = useState(true); 
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); 
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [toastAlert, setToastAlert] = useState<{ show: boolean; msg: string } | null>(null);
  const [inputText, setInputText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [quota, setQuota] = useState(0); 
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState<keyof typeof ACADEMIA_MODELS>("MIMO");
  const [extractedText, setExtractedText] = useState(""); 
  const [pendingFile, setPendingFile] = useState<{ name: string; url: string } | null>(null);

  const currentModel = useMemo(() => ACADEMIA_MODELS[selectedModel], [selectedModel]);

  const triggerAlert = useCallback((msg: string) => {
    setToastAlert({ show: true, msg });
    setTimeout(() => setToastAlert(null), 3000);
  }, []);

  // --- CLEANUP & CLICK OUTSIDE ---
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isProfileOpen && !(e.target as Element).closest('.profile-menu')) setIsProfileOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      if (pendingFile?.url) URL.revokeObjectURL(pendingFile.url);
    };
  }, [isProfileOpen, pendingFile]);

  // --- HANDLERS ---
  const handleModelChange = (key: keyof typeof ACADEMIA_MODELS) => {
    if (pendingFile && key !== "GEMINI") {
      if (!window.confirm("File memerlukan model Gemini untuk analisis optimal. Tetap ganti?")) return;
    }
    setSelectedModel(key);
  };

  const saveMessage = async (chatId: string, role: 'user' | 'assistant', content: string) => {
    try {
      await supabase.from("messages").insert([{ chat_id: chatId, role, content }]);
    } catch (e) { console.error("Save error:", e); }
  };

  // --- LOAD DATA (isMounted Pattern) ---
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) { router.push("/login"); return; }
      if (isMounted) setUser(authUser);
      const [prof, chats] = await Promise.all([
        supabase.from("profiles").select("quota").eq("id", authUser.id).single(),
        supabase.from("chats").select("*").eq("user_id", authUser.id).order('created_at', { ascending: false })
      ]);
      if (isMounted && prof.data) setQuota(prof.data.quota);
      if (isMounted && chats.data) setHistory(chats.data);
      if (isMounted) setIsLoadingSession(false);
    };
    init();
    return () => { isMounted = false; };
  }, [router, supabase]);

  useEffect(() => {
    let isMounted = true;
    if (!currentChatId) { setMessages([]); return; }
    const load = async () => {
      const { data } = await supabase.from("messages").select("*").eq("chat_id", currentChatId).order('created_at', { ascending: true });
      if (isMounted && data) setMessages(data);
    };
    load();
    return () => { isMounted = false; };
  }, [currentChatId, supabase]);

  const handleSendMessage = useCallback(async () => {
    const isAdmin = user?.email === 'guuglabs@gmail.com';
    if (selectedModel === "MIMO" && inputText.length > 100) return triggerAlert("Max 100 karakter");
    if (isLoading || (!inputText.trim() && !extractedText)) return;
    if (!isAdmin && quota < currentModel.points) return triggerAlert("Poin habis");

    setIsLoading(true);
    let cid = currentChatId;
    const msg = inputText;

    try {
      if (!cid) {
        const { data } = await supabase.from("chats").insert([{ user_id: user?.id, title: msg.substring(0, 30) || "Chat Baru" }]).select().single();
        if (data) { cid = data.id; setCurrentChatId(cid); setHistory(h => [data, ...h]); }
      }
      
      setMessages(m => [...m, { role: 'user', content: msg }]);
      setInputText("");
      await saveMessage(cid as string, 'user', msg);

      const res = await fetch('/api/gemini', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: cid, message: msg, modelId: currentModel.id, fileContent: extractedText, isAdmin }),
      });
      const d = await res.json();
      
      if (!d.error) {
        setMessages(m => [...m, { role: 'assistant', content: d.content }]);
        await saveMessage(cid as string, 'assistant', d.content);
        if (!isAdmin) setQuota(q => q - currentModel.points);
        if (pendingFile) {
          URL.revokeObjectURL(pendingFile.url);
          setPendingFile(null); setExtractedText("");
        }
      }
    } catch { triggerAlert("Gagal kirim"); } finally { setIsLoading(false); }
  }, [inputText, extractedText, selectedModel, user, quota, isLoading, currentChatId, currentModel, pendingFile, supabase, triggerAlert]);

  // --- UI RENDER ---
  if (isLoadingSession) return <div className="flex h-screen w-full items-center justify-center bg-[#131314] text-blue-500"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex h-[100dvh] bg-[#131314] text-[#e3e3e3] overflow-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
        * { font-family: 'Inter', sans-serif !important; text-transform: none !important; font-style: normal !important; font-weight: 400; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}</style>

      {toastAlert?.show && <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[500] bg-[#303132] border border-[#444746] px-6 py-2 rounded-lg text-sm shadow-xl">{toastAlert.msg}</div>}

      <aside className={`fixed lg:relative z-[100] h-full transition-all duration-300 bg-[#1e1f20] border-r border-[#444746] ${isSidebarOpen ? "w-64" : "w-0 lg:w-0 overflow-hidden"}`}>
        <div className="w-64 p-4 flex flex-col h-full">
          <button onClick={() => { setCurrentChatId(null); setIsSidebarOpen(false); }} className="flex items-center gap-3 bg-[#303132] hover:bg-[#444746] p-3 rounded-full text-sm font-medium transition-all shadow-sm">
            <Plus size={18} /> Chat Baru
          </button>
          <div className="mt-8 flex-1 overflow-y-auto custom-scrollbar">
            {history.map((c) => (
              <button key={c.id} onClick={() => { setCurrentChatId(c.id); setIsSidebarOpen(false); }} className={`w-full text-left p-3 rounded-lg text-sm truncate transition-colors ${currentChatId === c.id ? 'bg-[#303132] text-white font-medium' : 'text-[#e3e3e3] hover:bg-[#303132]'}`}>
                {c.title}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 h-full relative">
        <header className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <button onClick={(e) => { e.stopPropagation(); setIsSidebarOpen(!isSidebarOpen); }} className="p-2 hover:bg-[#303132] rounded-full transition-all text-[#9aa0a6]"><PanelLeftOpen size={20} /></button>
            <h1 className="text-xl font-medium tracking-tight">Guugie</h1>
          </div>
          <div className="flex items-center gap-4 relative">
            <div className="text-sm font-medium text-[#9aa0a6]">{quota} Pts</div>
            <button onClick={(e) => { e.stopPropagation(); setIsProfileOpen(!isProfileOpen); }} className="p-2 hover:bg-[#303132] rounded-full transition-all text-[#9aa0a6]"><User size={20} /></button>
            {isProfileOpen && (
              <div className="profile-menu absolute right-0 top-12 bg-[#1e1f20] border border-[#444746] rounded-xl shadow-2xl z-[60] overflow-hidden min-w-[150px]">
                <button onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }} className="w-full flex items-center gap-3 p-4 hover:bg-red-500/10 text-red-400 text-sm font-medium transition-colors"><LogOut size={16} /> Keluar</button>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-4">
          <div className="max-w-3xl mx-auto py-10">
            {messages.length === 0 ? (
              <div className="mt-20">
                <h2 className="text-4xl font-medium text-white mb-2">Halo {user?.user_metadata?.name?.split(' ')[0] || 'Guug'},</h2>
                <p className="text-[#9aa0a6] text-xl font-normal leading-relaxed">Ada yang bisa saya bantu hari ini?</p>
              </div>
            ) : (
              <div className="space-y-10 pb-20">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-2xl ${m.role === 'user' ? 'bg-[#303132]' : ''}`}>
                      <div className="prose prose-invert max-w-none text-[15px] leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && <div className="text-sm text-[#9aa0a6] font-medium animate-pulse">{currentModel.loading}</div>}
                <div ref={chatEndRef} />
              </div>
            )}
          </div>
        </div>

        <div className="p-4 lg:p-10">
          <div className="max-w-3xl mx-auto">
            <div className="grid grid-cols-3 gap-3 mb-6">
              {Object.entries(ACADEMIA_MODELS).map(([key, model]) => (
                <button key={key} onClick={() => handleModelChange(key as any)} className={`p-4 rounded-xl border transition-all text-center flex flex-col items-center gap-1 ${selectedModel === key ? 'border-blue-500 bg-[#1e1f20]' : 'border-[#444746] hover:bg-[#1e1f20]'}`}>
                  <span className="text-sm font-medium">{model.label}</span>
                  <span className="text-[10px] text-[#9aa0a6] font-normal">{model.points} Pts</span>
                </button>
              ))}
            </div>
            <div className="bg-[#1e1f20] rounded-[28px] border border-transparent focus-within:border-[#444746] p-2 flex items-end gap-2 shadow-sm transition-all">
              <button onClick={() => fileInputRef.current?.click()} className="p-3 text-[#c4c7c5] hover:bg-[#303132] rounded-full transition-all"><Paperclip size={20} /></button>
              <textarea 
                ref={textAreaRef} rows={1} value={inputText} 
                onChange={(e) => setInputText(e.target.value)} 
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); } }}
                placeholder="Masukkan perintah di sini" 
                className="flex-1 bg-transparent border-none outline-none p-3 text-base text-[#e3e3e3] resize-none max-h-40 custom-scrollbar placeholder:text-[#9aa0a6]" 
              />
              <button onClick={handleSendMessage} disabled={isLoading || (!inputText.trim() && !extractedText)} className={`p-3 rounded-full transition-all ${inputText.trim() || extractedText ? 'text-blue-500 hover:bg-[#303132]' : 'text-[#444746] cursor-not-allowed'}`}>
                {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}