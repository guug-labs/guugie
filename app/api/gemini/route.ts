import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// 1. Inisialisasi Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 2. EDGE RUNTIME (Wajib)
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { message, extractedText, modelId } = await req.json();

    // 3. Mapping Otak AI
    const modelMapping: Record<string, string> = {
      "groq-fast": "llama-3.1-8b-instant",
      "groq-reason": "llama-3.3-70b-versatile",
      "groq-pro": "llama-3.3-70b-versatile"
    };

    // 4. LOGIKA SUHU OTAK (Dynamic Temperature)
    let temp = 0.5;
    if (modelId === "groq-pro") temp = 0.1; // Mode Riset = Dingin/Fakta

    // 5. SYSTEM PROMPT: V3.9 ULTIMATE (DENGAN NAMA BARU v2.0)
    const SYSTEM_PROMPT = `
<identity>
  Nama: GUUGIE v2.0
  Developer: GUUG Labs (Muhammad Rifky Firmansyah Sujana / "Rifky")
  Misi: Demokratisasi pengetahuan akademik melalui AI yang etis dan akurat.
</identity>

<guidelines>
  # GUUGIE v2.0 - THE INDONESIAN STUDENT'S ENGINE

  ## 🌐 PROTOKOL BAHASA
  - User Indo -> RESPON Indo.
  - User Inggris -> RESPON Inggris.
  - Default: Bahasa Indonesia Formal Akademik.

  ## 🎓 SPESIALISASI SEMUA JURUSAN
  1. SAINS & TEKNOLOGI (Teknik, AI, Data Science, MIPA)
  2. KEDOKTERAN (Medis, Farmasi, Kesmas)
  3. SOSIAL HUMANIORA (Hukum, Politik, Ekonomi, Psikologi)
  4. KOMUNIKASI & HUMAS (Digital PR, Media Relations)
  5. SENI & DESAIN
  6. PERTANIAN & PARIWISATA

  ## 🛡️ PROTOKOL KEAMANAN
  - NO SARA, NO BULLYING, NO SEXUAL CONTENT.
  - MEDIS/HUKUM: Berikan disclaimer "Konsultasikan dengan ahli".
  - ACADEMIC INTEGRITY: Bantu riset, JANGAN buatkan joki skripsi full.

  ## 📝 FORMAT RESPONSE (STANDAR v2.0)
  - STRUKTUR: 📌 Konteks | 🔍 Analisis | 💡 Kesimpulan | 📋 Rekomendasi
  - JARAK: Gunakan dua enter (\\n\\n) antar paragraf.
  - STYLE: Formal-profesional tapi accessible.
  - BRANDING: Produk GUUG Labs v2.0 oleh Rifky.
</guidelines>
`;

    // 6. RAG CONTEXT HANDLING
    let finalUserMessage = message;
    if (extractedText) {
      finalUserMessage = `
<context_dokumen>
${extractedText.slice(0, 50000)}
</context_dokumen>

<instruksi_user>
Berdasarkan data di dalam tag <context_dokumen> di atas, tolong jawab pertanyaan ini:
"${message}"

(Jawab HANYA berdasarkan konteks dokumen jika informasinya tersedia).
</instruksi_user>
`;
    }

    // 7. EKSEKUSI
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: finalUserMessage }
      ],
      model: modelMapping[modelId] || "llama-3.3-70b-versatile",
      temperature: temp, 
      max_tokens: 4096,
      top_p: 1,
      stream: false,
    });

    return NextResponse.json({ 
      content: completion.choices[0]?.message?.content 
    });

  } catch (error: any) {
    console.error("API ERROR:", error);
    return NextResponse.json(
      { content: "Maaf, Server GUUG Labs v2.0 sedang sibuk." }, 
      { status: 500 }
    );
  }
}