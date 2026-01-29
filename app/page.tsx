"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import { 
  Plus, Send, Paperclip, X, Loader2, 
  FileText, Mic, LogOut, MessageSquare
} from "lucide-react"; 

// --- HELPERS: THE BRAIN OF GUUGIE ---
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
  } catch (e) { return "Gagal baca PDF."; }
};

const extractTextFromDOCX = async (file: File): Promise<string> => {
  try {
    const mammoth = await import('mammoth');
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  } catch (e) { return "Gagal baca DOCX."; }
};

const GUUGIE_MODELS = {
  "KILAT": { id: "groq-fast", label: "Guugie Cepat", points: 0 },
  "NALAR": { id: "groq-reason", label: "Guugie Nalar", points: 5 },
  "RISET": { id: "groq-pro", label: "Guugie Riset", points: 10 }
} as const;

export default function GuugieUltimatePage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedKasta, setSelectedKasta] = useState<keyof typeof GUUGIE_MODELS>("KILAT");
  const [attachedFiles, setAttachedFiles] = useState<{name: string, content: string}[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [legalModal, setLegalModal] = useState<{title: string, content: string} | null>(null);
  const [toast, setToast] = useState<{type: 'error' | 'success', msg: string} | null>(null);

  const showToast = (type: 'error' | 'success', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
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
        showToast('success', `${file.name} siap dibedah!`);
      } else { showToast('error', 'Format tidak didukung.'); }
    } catch (e) { showToast('error', 'Gagal proses file.'); }
    finally { setIsProcessingFile(false); }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && attachedFiles.length === 0) return;
    setIsLoading(true);
    const userMsg = inputText;
    const fileContext = attachedFiles.map(f => f.content).join("\n");
    setInputText("");

    try {
      setMessages(prev => [...prev, { role: "user", content: attachedFiles.length > 0 ? `[File: ${attachedFiles[0].name}] ${userMsg}` : userMsg }]);
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, extractedText: fileContext, modelId: GUUGIE_MODELS[selectedKasta].id })
      });
      const data = await res.json();
      if (data.content) {
        setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
        setAttachedFiles([]);
      }
    } catch (e) { showToast('error', 'Gagal kirim.'); }
    finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-[100dvh] bg-[#0a0a0a] text-white overflow-hidden">
      <main className="flex-1 flex flex-col relative">
        <div className="flex-1 overflow-y-auto no-scrollbar p-6">
          <div className="max-w-2xl mx-auto pt-20 pb-40">
            {messages.length === 0 ? (
              <div className="text-center opacity-20 py-20">
                <h1 className="text-6xl font-black italic tracking-tighter italic">Guugie</h1>
                <p className="text-[9px] uppercase tracking-[0.6em] mt-4">Research Engine by GUUG Labs</p>
              </div>
            ) : (
              <div className="space-y-12">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[90%] p-6 rounded-[30px] ${m.role === 'user' ? 'bg-white/5 border border-white/5 text-sm' : 'prose prose-invert text-white/80'}`}>
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="absolute bottom-0 inset-x-0 p-4 lg:p-10 bg-gradient-to-t from-[#0a0a0a] to-transparent">
          <div className="max-w-2xl mx-auto">
            {attachedFiles.length > 0 && (
              <div className="flex gap-2 mb-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center gap-2 bg-white/10 border border-white/20 px-4 py-2 rounded-full">
                  <FileText size={12} className="text-blue-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">{attachedFiles[0].name}</span>
                  <button onClick={() => setAttachedFiles([])} className="text-white/20 hover:text-white"><X size={14}/></button>
                </div>
              </div>
            )}
            <div className="bg-[#111] border border-white/[0.08] rounded-[32px] p-2">
              <textarea value={inputText} onChange={e => setInputText(e.target.value)} placeholder="Tanya riset ke Guugie..." className="w-full bg-transparent border-none focus:ring-0 p-4 resize-none no-scrollbar min-h-[60px]" rows={1} />
              <div className="flex items-center justify-between px-2 pb-2">
                <div className="flex gap-1 items-center">
                  <button onClick={() => fileInputRef.current?.click()} className="p-3 text-white/20 hover:text-white">
                    {isProcessingFile ? <Loader2 className="animate-spin" size={20}/> : <Paperclip size={20}/>}
                  </button>
                  <div className="flex ml-2 bg-white/[0.03] border border-white/[0.05] p-1 rounded-xl">
                    {Object.keys(GUUGIE_MODELS).map((m) => (
                      <button key={m} onClick={() => setSelectedKasta(m as any)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${selectedKasta === m ? 'bg-white text-black shadow-lg' : 'text-white/20 hover:text-white'}`}>{m}</button>
                    ))}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".docx,.pdf,.txt" />
                </div>
                <button onClick={handleSendMessage} disabled={isLoading} className="bg-white text-black w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95"><Send size={20} className="-rotate-12"/></button>
              </div>
            </div>
            <div className="mt-8 flex flex-col items-center gap-4">
              <div className="flex gap-8 opacity-30 text-[9px] font-black uppercase tracking-[0.3em]">
                <button onClick={() => setLegalModal({title: "ToS", content: "Guugie (GUUG Labs) adalah alat riset. Gunakan dengan bijak."})} className="hover:text-white">ToS</button>
                <button onClick={() => setLegalModal({title: "Privacy", content: "Privasi Anda adalah prioritas kami di GUUG Labs."})} className="hover:text-white">Privacy</button>
              </div>
              <p className="text-[8px] font-black opacity-20 uppercase tracking-[0.4em]">GUUGIE PUBLIC BETA • POWERED BY GROQ LPU</p>
            </div>
          </div>
        </div>
      </main>

      {legalModal && (
        <div className="fixed inset-0 z-[2000] bg-black/90 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setLegalModal(null)}>
          <div className="bg-[#111] border border-white/10 rounded-[40px] max-w-sm w-full p-10 relative" onClick={e => e.stopPropagation()}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 mb-4">{legalModal.title}</h3>
            <p className="text-white leading-relaxed text-sm italic">{legalModal.content}</p>
          </div>
        </div>
      )}

      {toast && <div className="fixed top-6 left-1/2 -translate-x-1/2 px-6 py-3 bg-white text-black rounded-full font-black text-[10px] uppercase tracking-widest z-[3000] shadow-2xl">{toast.msg}</div>}
    </div>
  );
}