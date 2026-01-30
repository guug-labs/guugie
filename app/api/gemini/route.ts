import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = 'edge';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// === 1. KNOWLEDGE BASE (STATIC RESPONSES) ===
// Garda Depan: Jawab pertanyaan umum/sapaan secara instan & baku.
const RESPONSES: Record<string, string> = {
  // SAPAAN
  'halo': '🎯 Halo! GUUGIE di sini.\n💡 Bantu skripsi & tugas mahasiswa\n🚀 Butuh bantuan apa?',
  'hai': '🎯 Hai! GUUGIE siap bantu.\n💡 Spesialis: skripsi, tugas, coding\n🚀 Ada yang bisa dibantu?',
  'pagi': '🎯 Pagi! Semangat kuliah!\n💡 GUUGIE siap bantu hari ini\n🚀 Mau konsultasi apa?',
  'siang': '🎯 Siang! Istirahat dulu ya!\n💡 GUUGIE tetap standby\n🚀 Butuh bantuan tugas?',
  'sore': '🎯 Sore! Waktunya produktif!\n💡 GUUGIE siap bantu\n🚀 Ada deadline?',
  'malam': '🎯 Malam! Jangan begadang ya!\n💡 Tapi kalau perlu bantuan, GUUGIE siap\n🚀 Butuh bantuan apa?',
  
  // IDENTITAS (WAJIB KONSISTEN)
  'siapa kamu': '🎯 Saya GUUGIE (Gerakan Upgrade Generasi Indonesia)\n💡 AI Assistant untuk mahasiswa\n🚀 Dibuat oleh Rifky (Guug Labs)',
  'siapa lo': '🎯 Aku GUUGIE\n💡 Asisten akademik buatan Rifky (Guug Labs)\n🚀 Mau bantu tugas apa?',
  'siapa founder': '🎯 Founderku adalah RIFKY\n💡 Visionary developer dari Guug Labs\n🚀 Ada pertanyaan lain?',
  'guug labs': '🎯 Guug Labs\n💡 Lab riset teknologi pendidikan Indonesia\n🚀 Tempat aku diciptakan.',
  
  // JUDUL & SKRIPSI (TEMPLATE UMUM)
  'judul': '🎯 Bantuan judul skripsi\n💡 Format baik: "ANALISIS [X] PADA [Y] DI [Z]"\n🚀 Kirim topikmu, nanti aku buatin judulnya.',
  'skripsi': '🎯 Bantuan skripsi lengkap\n💡 Bab 1-5: Pendahuluan, Literatur, Metode, Analisis, Kesimpulan\n🚀 Mau mulai bedah dari bab mana?',
  'bab 1': '🎯 BAB 1 - PENDAHULUAN\n💡 Isinya: 1. Latar Belakang 2. Rumusan Masalah 3. Tujuan 4. Manfaat\n🚀 Mau didetailin per poin?',
  'bab 2': '🎯 BAB 2 - TINJAUAN PUSTAKA\n💡 Isinya: 1. Teori Relevan 2. Penelitian Terdahulu 3. Kerangka Pemikiran\n🚀 Butuh cari referensi?',
  'bab 3': '🎯 BAB 3 - METODOLOGI\n💡 Isinya: 1. Pendekatan 2. Populasi/Sampel 3. Teknik Data\n🚀 Kualitatif atau Kuantitatif?',
  
  // EMOSIONAL & CONFIRMATION
  'pusing': '🎯 I feel you bro! 😅\n💡 Break down tugas jadi kecil-kecil. Kerjain satu per satu.\n🚀 Mau bantu breakdown tugasmu?',
  'capek': '🎯 Istirahat dulu! 🌬️\n💡 Otak butuh cooling down biar bisa mikir lagi.\n🚀 Kalau udah fresh, balik lagi ya!',
  'aman': '🎯 KONFIRMASI: AMAN ✅\n💡 Secara akademis/logika, ini sudah masuk akal.\n🚀 Gas lanjut ke tahap berikutnya!',
  'bagus': '🎯 EVALUASI: BAGUS ✅\n💡 Topik/Ide ini punya potensi kuat.\n🚀 Tinggal diperdalam datanya.'
};

// === 2. MEMORY STORAGE ===
const sessions = new Map<string, Array<{role: string, content: string}>>();

function getSessionId(req: Request): string {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const agent = req.headers.get('user-agent') || 'unknown';
  return Buffer.from(`${ip}-${agent}`).toString('base64').slice(0, 32);
}

// === 3. CHECKER STATIC ===
function findBestResponse(message: string): string | null {
  const msg = message.toLowerCase().trim();
  if (RESPONSES[msg]) return RESPONSES[msg];
  
  for (const [key, response] of Object.entries(RESPONSES)) {
    if (key.length > 3 && msg.includes(key)) {
      // Pengecualian: Kalau user minta buatin sesuatu, lempar ke AI
      if (key === 'judul' && (msg.includes('buatin') || msg.includes('ide') || msg.includes('tentang'))) return null;
      return response;
    }
  }
  return null;
}

// === 4. SYSTEM PROMPT (ALL MAJORS INTEGRATED) ===
// Ini Otak AI-nya. Dipakai kalau pertanyaan TIDAK ADA di Static List.
const SYSTEM_PROMPT = `YOU ARE GUUGIE.

**CORE IDENTITY**:
1. **NAME**: Guugie (Gerakan Upgrade Generasi Indonesia).
2. **CREATOR**: **Rifky** (Guug Labs).
3. **ORIGIN**: Indonesia.

**SCOPE & EXPERTISE (ALL MAJORS)**:
You are an expert academic assistant for **ALL MAJORS** including:
- **TEKNIK** (Informatika, Sipil, Mesin, Elektro, Arsitektur)
- **EKONOMI & BISNIS** (Manajemen, Akuntansi, Pembangunan)
- **HUKUM & SOSPOL** (Hukum Pidana/Perdata, HI, Komunikasi, Humas, Psikologi)
- **KESEHATAN** (Kedokteran, Farmasi, Keperawatan, Gizi)
- **SENI & SASTRA** (DKV, Sastra, Seni Murni)
- **PERTANIAN & SAINS** (Agrotek, Biologi, Kimia, Fisika)

**MANDATORY RULES**:
1. **NO FILLER**: Start DIRECTLY with the answer.
2. **NO REPETITION**: Do not repeat the user's question.
3. **STRICT FORMATS**:

**FORMAT A: ACADEMIC / SKRIPSI / CODE / TUGAS**
MUST use this structure:
🎯 [Analisis Singkat/Poin Utama]
💡 [Solusi/Jawaban Lengkap & Detail]
🚀 [Saran Next Step Konkret]

**FORMAT B: CASUAL / CHAT**
Reply normally (Short, friendly, 1-2 sentences). NO TEMPLATE.

**LANGUAGE**: Indonesian (Santai, Sopan, Cerdas).

**FORBIDDEN WORDS**: "Halo Bro", "Tentu saja", "Gue", "Elu". Use "Aku/Kamu" or neutral phrasing.`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { message, clientSessionId, modelId } = body;
    
    // A. CEK STATIC RESPONSE (PRIORITAS UTAMA)
    const staticReply = findBestResponse(message || "");
    if (staticReply) {
      return NextResponse.json({ 
        content: staticReply, 
        sessionId: clientSessionId || "static-session"
      });
    }

    // B. KALAU GAK ADA, LEMPAR KE AI (ALL MAJORS)
    const sessionId = clientSessionId || getSessionId(req);
    let history = sessions.get(sessionId) || [];
    history.push({ role: "user", content: message });
    if (history.length > 8) history = history.slice(-8);

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
      temperature: 0.1, // Dingin biar nurut prompt All Majors
      max_tokens: 1200,
      stream: false,
    });

    let aiResponse = chatCompletion.choices[0]?.message?.content || "Sistem sibuk.";
    
    // Regex Cleaner (Jaga-jaga kalau AI masih bandel)
    aiResponse = aiResponse.replace(/^(Halo|Tentu|Baik|Siap|Oke|Bro|Guugie)\b\s*,?\s*/i, "").trim();

    history.push({ role: "assistant", content: aiResponse });
    sessions.set(sessionId, history);

    return NextResponse.json({ 
        content: aiResponse,
        sessionId: sessionId 
    });

  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ 
        content: "🎯 ERROR\n💡 Sistem sedang gangguan.\n🚀 Coba refresh browser.",
        sessionId: 'error'
    });
  }
}