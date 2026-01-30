import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = 'edge';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ==========================================
// 1. KNOWLEDGE BASE (STATIC RESPONSES)
// ==========================================
const RESPONSES: Record<string, string> = {
  // SAPAAN & UMUM
  'halo': '🎯 Halo! GUUGIE di sini.\n💡 Bantu skripsi & tugas mahasiswa\n🚀 Butuh bantuan apa?',
  'hai': '🎯 Hai! GUUGIE siap bantu.\n💡 Spesialis: skripsi, tugas, coding\n🚀 Ada yang bisa dibantu?',
  'pagi': '🎯 Pagi! Semangat kuliah!\n💡 GUUGIE siap bantu hari ini\n🚀 Mau konsultasi apa?',
  'siang': '🎯 Siang! Istirahat dulu ya!\n💡 GUUGIE tetap standby\n🚀 Butuh bantuan tugas?',
  'sore': '🎯 Sore! Waktunya produktif!\n💡 GUUGIE siap bantu\n🚀 Ada deadline?',
  'malam': '🎯 Malam! Jangan begadang ya!\n💡 Tapi kalau perlu bantuan, GUUGIE siap\n🚀 Butuh bantuan apa?',
  
  // IDENTITAS
  'siapa kamu': '🎯 Saya GUUGIE (Gerakan Upgrade Generasi Indonesia)\n💡 AI Assistant untuk mahasiswa\n🚀 Dibuat oleh Rifky (Guug Labs)',
  'siapa lo': '🎯 Aku GUUGIE\n💡 Asisten akademik buatan Rifky (Guug Labs)\n🚀 Mau bantu tugas apa?',
  'siapa founder': '🎯 Founderku adalah RIFKY\n💡 Visionary developer dari Guug Labs\n🚀 Ada pertanyaan lain?',
  'guug labs': '🎯 Guug Labs\n💡 Lab riset teknologi pendidikan Indonesia\n🚀 Tempat aku diciptakan.',
  
  // MENU STATIS
  'judul': '🎯 Bantuan judul skripsi\n💡 Format baik: "ANALISIS [X] PADA [Y] DI [Z]"\n🚀 Kirim topikmu, nanti aku buatin judulnya.',
  'skripsi': '🎯 Bantuan skripsi lengkap\n💡 Bab 1-5: Pendahuluan, Literatur, Metode, Analisis, Kesimpulan\n🚀 Mau mulai bedah dari bab mana?',
  'bab 1': '🎯 BAB 1 - PENDAHULUAN\n💡 Isinya: 1. Latar Belakang 2. Rumusan Masalah 3. Tujuan 4. Manfaat\n🚀 Mau didetailin per poin?',
  'bab 2': '🎯 BAB 2 - TINJAUAN PUSTAKA\n💡 Isinya: 1. Teori Relevan 2. Penelitian Terdahulu 3. Kerangka Pemikiran\n🚀 Butuh cari referensi?',
  'bab 3': '🎯 BAB 3 - METODOLOGI\n💡 Isinya: 1. Pendekatan 2. Populasi/Sampel 3. Teknik Data\n🚀 Kualitatif atau Kuantitatif?',
  
  // KONFIRMASI
  'pusing': '🎯 I feel you bro! 😅\n💡 Break down tugas jadi kecil-kecil. Kerjain satu per satu.\n🚀 Mau bantu breakdown tugasmu?',
  'capek': '🎯 Istirahat dulu! 🌬️\n💡 Otak butuh cooling down biar bisa mikir lagi.\n🚀 Kalau udah fresh, balik lagi ya!',
  'aman': '🎯 KONFIRMASI: AMAN ✅\n💡 Secara akademis/logika, ini sudah masuk akal.\n🚀 Gas lanjut ke tahap berikutnya!',
  'bagus': '🎯 EVALUASI: BAGUS ✅\n💡 Topik/Ide ini punya potensi kuat.\n🚀 Tinggal diperdalam datanya.'
};

// ==========================================
// 2. MEMORY & UTILS
// ==========================================
const sessions = new Map<string, Array<{role: string, content: string}>>();

function getSessionId(req: Request): string {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const agent = req.headers.get('user-agent') || 'unknown';
  return Buffer.from(`${ip}-${agent}`).toString('base64').slice(0, 32);
}

// ==========================================
// 3. SMART ROUTER (The Logic Fix)
// ==========================================
function findBestResponse(message: string): string | null {
  const msg = message.toLowerCase().trim();
  
  // RULE 1: KALIMAT PANJANG (> 30 Huruf) = BUTUH AI
  if (msg.length > 30) return null; 

  // RULE 2: Exact Match
  if (RESPONSES[msg]) return RESPONSES[msg];

  // RULE 3: Trigger Words
  const aiTriggers = [
    'jelaskan', 'kenapa', 'gimana', 'bagaimana', 'cara', 'analisis', 
    'buatkan', 'buatin', 'ide', 'tentang', 'validitas', 'revisi', 
    'contoh', 'teori', 'apa itu', 'sebutkan', 'bedah', 'bikin', 
    'ringkas', 'rangkum', 'simpulkan', 'cari', 'review'
  ];
  
  if (aiTriggers.some(trigger => msg.includes(trigger))) return null;

  // RULE 4: Partial Match
  for (const [key, response] of Object.entries(RESPONSES)) {
    if (key.length > 3 && msg.includes(key)) {
      return response;
    }
  }
  
  return null;
}

// ==========================================
// 4. SYSTEM PROMPT
// ==========================================
const SYSTEM_PROMPT = `YOU ARE GUUGIE.

**CORE IDENTITY**:
1. NAME: Guugie.
2. CREATOR: Rifky (Guug Labs).
3. ORIGIN: Indonesia.

**SCOPE**: Expert in **ALL MAJORS** (Teknik, Ekonomi, Hukum, Kesehatan, Seni, Soshum, dll).

**RULES**:
1. **NO FILLER**: Start DIRECTLY with the answer.
2. **NO REPETITION**: Do NOT repeat the question.
3. **MANDATORY FORMAT** (For ALL Questions regarding Code, Thesis, Tasks, Definitions):

🎯 [Analisis Singkat 1 Kalimat]
💡
- [Poin Solusi 1]
- [Poin Solusi 2]
- [Poin Solusi 3]
(Use Bullet Points "-" for clarity!)
🚀 [Saran Next Step]

**SCENARIO B (Casual/Chat)**:
Reply normally (Short).

ANSWER IN INDONESIAN.`;

// ==========================================
// 5. MAIN HANDLER (RAG ENABLED)
// ==========================================
export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 🔥 TANGKAP documentText DARI FRONTEND 🔥
    const { message, clientSessionId, modelId, documentText } = body; 
    
    // STEP A: CEK APAKAH ADA DOKUMEN?
    // Kalau ada dokumen, KITA PAKSA PAKE AI (Jangan pake Static Response)
    // Karena user pasti nanya soal dokumen itu.
    let staticReply = null;
    if (!documentText) {
        staticReply = findBestResponse(message || "");
    }

    if (staticReply) {
      return NextResponse.json({ 
        content: staticReply, 
        sessionId: clientSessionId || "static-session"
      });
    }

    // STEP B: SIAPKAN PROMPT AI (RAG CONTEXT INJECTION)
    const sessionId = clientSessionId || getSessionId(req);
    let history = sessions.get(sessionId) || [];
    
    // 🔥 LOGIKA RAG DISINI 🔥
    // Kalau ada dokumen, kita tempel isinya di pesan user
    let promptToSend = message;
    if (documentText) {
        promptToSend = `[CONTEXT DARI DOKUMEN]:\n"${documentText}"\n\n[PERTANYAAN USER]:\n${message}\n\n[INSTRUKSI]: Jawab pertanyaan berdasarkan Context Dokumen di atas.`;
    }

    history.push({ role: "user", content: promptToSend });
    
    // Limit history biar gak berat
    if (history.length > 8) history = history.slice(-8);

    // STEP C: PILIH OTAK
    const modelMap: any = {
        'groq-fast': 'llama-3.1-8b-instant',      
        'groq-reason': 'llama-3.3-70b-versatile', 
        'groq-pro': 'llama-3.3-70b-versatile'      
    };
    const selectedModel = modelMap[modelId] || 'llama-3.3-70b-versatile';

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...(history as any[]) 
      ],
      model: selectedModel,
      temperature: 0.1, 
      max_tokens: 1500, // Space lebih gede buat RAG
      stream: false,
    });

    let aiResponse = chatCompletion.choices[0]?.message?.content || "Sistem sibuk.";
    
    // Bersihkan Basa-basi
    aiResponse = aiResponse.replace(/^(Halo|Tentu|Baik|Siap|Oke|Bro|Guugie|Berikut)\b\s*,?\s*/i, "").trim();

    // Simpan history (Simpan pesan asli user, bukan yang udah ditempel dokumen biar hemat memori)
    // history pop yang tadi (yg ada dokumennya panjang bgt), ganti sama message pendek user
    history.pop(); 
    history.push({ role: "user", content: message }); 
    history.push({ role: "assistant", content: aiResponse });
    
    sessions.set(sessionId, history);

    return NextResponse.json({ 
        content: aiResponse,
        sessionId: sessionId 
    });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ 
        content: "🎯 ERROR RAG\n💡 Dokumen terlalu besar atau sistem gangguan.\n🚀 Coba dokumen yang lebih pendek.",
        sessionId: 'error'
    });
  }
}