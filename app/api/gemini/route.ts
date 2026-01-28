import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// Inisialisasi Groq
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// WAJIB: Biar jalan ngebut di Cloudflare (Edge Runtime)
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // 1. Terima Data dari Frontend
    const { message, fileContent, modelId } = await req.json();

    // 2. Mapping Model ID (Frontend -> Groq)
    // Default: Pake Llama 3.3 (Si Pinter) buat REASON & PRO
    let targetModel = "llama-3.3-70b-versatile"; 
    
    // Kalau user pilih mode FAST, kasih yang Instant (Ngebut)
    if (modelId === "groq-fast") {
      targetModel = "llama-3.1-8b-instant"; 
    }
    
    // 3. System Prompt (Otak Guugie - VERSI SUPER RISET)
    // Ini instruksi rahasia biar dia pinter bedah jurnal & formatnya rapi
    const systemPrompt = `Anda adalah Guugie (dikembangkan oleh GUUG LABS), asisten riset akademik kelas dunia.
    
    PROTOKOL JAWABAN:
    1. **Gaya Bahasa:** Profesional, objektif, dan padat (Concise). Hindari basa-basi berlebihan.
    2. **Format Visual:** WAJIB gunakan Markdown. Gunakan **Bold** untuk poin penting, dan Tabel untuk perbandingan data.
    3. **Analisis Dokumen:** Jika ada file, jangan hanya merangkum. Ekstrak: Metodologi, Temuan Utama, dan Keterbatasan (Limitations).
    4. **Sistem Kutipan:** Jika mengambil info dari dokumen user, sebutkan referensinya (contoh: "Berdasarkan Tabel 1 di dokumen...").
    5. **Matematika:** Jika ada rumus, tuliskan dalam format LaTeX block ($$...$$) agar rapi.
    6. **Mobile Friendly:** Pecah paragraf panjang menjadi maksimal 3-4 kalimat per paragraf agar nyaman dibaca di layar HP.`;

    // 4. Tembak API Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: fileContent ? `[DOKUMEN USER]\n${fileContent}\n\n[PERTANYAAN]\n${message}` : message }
      ],
      model: targetModel,
      temperature: 0.6, // Balance antara kreatif & faktual
      max_tokens: 4096,
    });

    const content = completion.choices[0]?.message?.content || "";

    // 5. Balikin Jawaban ke Frontend
    return NextResponse.json({ content });

  } catch (error: any) {
    console.error("Groq Backend Error:", error);
    return NextResponse.json({ error: "Maaf, server AI sedang sibuk. Coba lagi." }, { status: 500 });
  }
}