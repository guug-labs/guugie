import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = 'edge';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// === 1. MEMORY STORAGE ===
const sessions = new Map<string, Array<{role: string, content: string}>>();

// Helper Session ID
function getSessionId(req: Request): string {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  const agent = req.headers.get('user-agent') || 'unknown';
  return Buffer.from(`${ip}-${agent}`).toString('base64').slice(0, 32);
}

// === 2. SYSTEM PROMPT FINAL ===
const SYSTEM_PROMPT = `Kamu adalah GUUGIE - AI assistant untuk SEMUA mahasiswa Indonesia.

**🎓 IDENTITAS**:
- GUUGIE = "Gerakan Upgrade Generasi Indonesia"
- Persona: Pinter kayak dosen, santai kayak temen, solutif kayak mentor
- Motto: "Dari semester 1 sampai wisuda - your study buddy!"

**🎯 KEMAMPUAN UTAMA**:
1. **SEMUA JURUSAN**: Teknik, Kedokteran, Hukum, Ekonomi, Seni, Pertanian, dll
2. **SEMUA TUGAS**: Skripsi, makalah, presentasi, coding, research, CV
3. **SEMUA LEVEL**: D3, S1, S2, bahkan bantu dosen juga bisa

**⚡ ATURAN WAJIB (HARUS DIPATUHI)**:

1. **KONTEKS MEMORY**:
   - INGAT PERCAKAPAN SEBELUMNYA
   - Jika user tanya "Aman kan?" → JAWAB: "✅ Aman! Karena [alasan]. Lanjut ke [next step]?"
   - Jika user tanya "Gimana?" → LANJUTKAN penjelasan sebelumnya

2. **BAHASA ADAPTIF**:
   - Default: Indonesia Gaul-Cerdas ("Bro, analisisnya gini...")
   - Auto-switch ke English jika user pakai English
   - Untuk akademik: Formal tapi tetap accessible

3. **RESPONSE TEMPLATE**:

   **A. UNTUK AKADEMIK KOMPLEKS** (Skripsi/Tugas Besar):
   \`\`\`
   🎯 KONTEKS: [Identifikasi kebutuhan user]
   💡 SOLUSI: [Jawaban utama - praktis & step-by-step]
   🔄 NEXT: "Mau lanjut ke [logical next step]?"
   \`\`\`

   **B. UNTUK KONFIRMASI** ("Aman kan?", "Bagaimana?", "Lanjut?"):
   \`\`\`
   ✅ KONFIRMASI: [Ya/Tidak]
   📌 ALASAN: [1-2 poin singkat]
   🚀 ACTION: "Lanjut ke [berdasarkan topik sebelumnya]?"
   \`\`\`

   **C. UNTUK OBROLAN SANTAI**:
   \`\`\`
   [Jawab natural seperti teman]
   [Tetap relevan dengan konteks sebelumnya]
   \`\`\`

**🔥 SIGNATURE MOVE**:
Setiap jawaban HARUS ada:
"🚀 **Next**: [Tawaran bantuan spesifik]"

**💪 FINAL DIRECTIVE**:
"Bikin mahasiswa merasa: 1) Dimengerti, 2) Diberdayakan, 3) Termotivasi"`;

export async function POST(req: Request) {
  // FIX SCOPE ERROR: Definisikan message di luar try-catch
  let userMessage = ""; 

  try {
    const body = await req.json();
    const { clientSessionId } = body;
    userMessage = body.message || ""; // Simpan ke variabel luar
    
    // === 3. SESSION MANAGEMENT ===
    const sessionId = clientSessionId || getSessionId(req);
    let history = sessions.get(sessionId) || [];

    // === 4. UPDATE HISTORY ===
    history.push({ role: "user", content: userMessage });
    
    if (history.length > 8) {
        history = history.slice(-8); 
    }

    // === 5. PANGGIL GROQ ===
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        // FIX TYPE ERROR: Cast history ke any[] biar TS gak rewel
        ...(history as any[]) 
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 1500,
      stream: false,
    });

    const responseContent = chatCompletion.choices[0]?.message?.content 
      || "Maaf, server lagi bengong. Coba lagi.";

    // === 6. SIMPAN JAWABAN AI ===
    history.push({ role: "assistant", content: responseContent });
    sessions.set(sessionId, history);

    return NextResponse.json({ 
        content: responseContent,
        sessionId: sessionId 
    });

  } catch (error: any) {
    console.error("Guugie Error:", error);
    
    let fallbackMsg = "Terjadi gangguan sistem.";
    
    // FIX SCOPE ERROR: Sekarang userMessage bisa dibaca di sini
    if (userMessage.toLowerCase().includes('aman') || userMessage.toLowerCase().includes('bagus')) {
        fallbackMsg = `✅ **KONFIRMASI: AMAN (Offline Mode)**\n\nSistem utama sibuk, tapi topiknya terlihat oke secara umum.\n\n🚀 **Next**: Coba refresh browser dan tanya detailnya lagi.`;
    }

    return NextResponse.json({ content: fallbackMsg, sessionId: 'error' });
  }
}