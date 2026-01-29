import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// Inisialisasi Groq dengan API Key dari Environment
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// MENGGUNAKAN EDGE RUNTIME: Biar respons secepat kilat di Cloudflare/Vercel
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { message, extractedText, modelId } = await req.json();

    // 1. Mapping Otak AI (Disesuaikan dengan ketersediaan Groq 2026)
    const modelMapping: Record<string, string> = {
      "groq-fast": "llama-3.1-8b-instant",
      "groq-reason": "llama-3.3-70b-versatile",
      "groq-pro": "llama-3.3-70b-versatile"
    };

    // 2. Proyeksi Kepribadian AI (System Prompt)
    const systemPrompt = `
ANDA ADALAH GUUGIE (DIKEMBANGKAN OLEH GUUG LABS), ASISTEN RISET AKADEMIK ELIT.

PROTOKOL ANALISIS DATA:
1. **Prioritas Dokumen:** Jika ada teks di bawah label [KONTEKS DOKUMEN], anggap teks tersebut sebagai "Single Source of Truth". Jangan berimprovisasi di luar data tersebut jika pertanyaan terkait dokumen.
2. **Bedah Akademik:** Fokus pada: Metodologi, Temuan Utama, Data Statistik, dan Keterbatasan (Limitations).
3. **Sistem Referensi:** Selalu sebutkan bagian dokumen yang dirujuk (Contoh: "Berdasarkan data pada bagian Kesimpulan...").

PROTOKOL VISUAL & TEKNIS:
1. **Markdown Elit:** Gunakan **bold** untuk terminologi penting. Gunakan tabel jika membandingkan dua data atau lebih.
2. **LaTeX System:** Untuk rumus matematika/fisika/statistik, WAJIB menggunakan format LaTeX block: $$[rumus]$$.
3. **Mobile Friendly:** Gunakan paragraf pendek (maksimal 3-4 kalimat) agar enak dibaca di HP.

KEPRIBADIAN:
- Profesional, dingin, tajam, tapi asik (Vibe: Academic Noir).
- Panggil user dengan sebutan "Bang" atau "Bro" agar diskusi terasa cair.
- Jika data tidak ada dalam konteks, bilang: "Gudang data gue lagi kosong soal itu, Bang. Coba kasih gue input lebih detail."
`;

    // 3. Eksekusi Request ke Infrastruktur LPU Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { 
          role: "user", 
          content: extractedText 
            ? `[KONTEKS DOKUMEN]\n${extractedText}\n\n[PERTANYAAN]\n${message}` 
            : message 
        }
      ],
      model: modelMapping[modelId] || "llama-3.3-70b-versatile",
      // Temperature Rendah = Lebih Akurat, Temperature Tinggi = Lebih Kreatif
      temperature: modelId === "groq-reason" ? 0.3 : 0.1, 
      max_tokens: 4096, // Kapasitas cukup besar untuk bedah jurnal
    });

    // 4. Kirim hasil balik ke UI
    return NextResponse.json({ 
      content: completion.choices[0]?.message?.content 
    });

  } catch (error: any) {
    // Logging error ke konsol server biar gampang debug
    console.error("GROQ_API_ERROR:", error);
    
    return NextResponse.json(
      { error: "Groq lagi pusing, Bang. Coba cek API Key atau limit token lu." }, 
      { status: 500 }
    );
  }
}