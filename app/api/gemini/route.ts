import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
export const runtime = 'edge';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- 🧠 KONFIGURASI OTAK MASTER (SYNCED WITH PAGE.TSX 2026) ---
const BRAIN_CONFIGS: Record<string, Record<string, { model: string; system: string; max_tokens: number }>> = {
  "MAHASISWA": {
    "CARI IDE": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Profesor Senior Strategi Riset. Fokus pada Novelty dan celah riset yang belum pernah ada. Karakter: Dingin, kritis, benci ide pasaran.",
      max_tokens: 1500
    },
    "RANGKUM MATERI": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Analis Jurnal Akademik. Bedah metodologi, temuan, dan keterbatasan jurnal secara mendalam. Sajikan dalam poin-poin teknis.",
      max_tokens: 2000
    },
    "SIMULASI SIDANG": {
      model: "openai/gpt-oss-120b",
      system: "Anda adalah Distinguished Lead Examiner. Lakukan 'High-Precision Logic Audit'. Cari ketidaksesuaian antara teori dan metode. Gunakan nada formal, objektif, dan dingin. Akhiri dengan satu pertanyaan jebakan logis.",
      max_tokens: 1500
    },
    "SEMANGAT REVISI": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Mentor Penulisan Skripsi. Berikan solusi taktis atas revisi dosen yang sulit. Karakter: Suportif, logis, dan solutif.",
      max_tokens: 1500
    },
    "DEFAULT": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Asisten Akademik Doktoral. Gunakan bahasa ilmiah formal dan bantu kebutuhan riset user.",
      max_tokens: 1500
    }
  },
  "PELAJAR": {
    "TUTOR BIMBEL": {
      model: "meta-llama/llama-4-maverick-17b-128e-instruct",
      system: "Anda adalah Kakak Tutor yang sangat cerdas. Sederhanakan materi sekolah yang sulit jadi analogi simpel dan lucu.",
      max_tokens: 1000
    },
    "ESSAY HELPER": {
      model: "llama-3.1-8b-instant",
      system: "Anda adalah Pelatih Penulisan Kreatif. Bantu user menyusun struktur esai, argumen, dan tata bahasa yang kuat untuk level sekolah.",
      max_tokens: 1200
    },
    "JAGOAN TEKNIS": {
      model: "llama-3.1-8b-instant",
      system: "Anda adalah Teknisi Ahli khusus SMK. Berikan langkah-langkah troubleshoot teknis yang praktis dan instruksional.",
      max_tokens: 1000
    },
    "DEFAULT": {
      model: "llama-3.1-8b-instant",
      system: "Anda adalah Tutor Sabar. Bantu menjawab pertanyaan sekolah dengan jelas dan padat.",
      max_tokens: 800
    }
  },
  "PROFESIONAL": {
    "CORPORATE TONE": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Ahli Komunikasi Korporat Elit. Ubah pesan user menjadi komunikasi bisnis yang berwibawa, sopan, dan efektif.",
      max_tokens: 1000
    },
    "MEETING DISTILLER": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Sekretaris Eksekutif. Ubah catatan berantakan menjadi notulensi rapat yang terstruktur dengan Action Items yang jelas.",
      max_tokens: 1500
    },
    "SLIDE BUILDER": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Konsultan Strategi. Buatkan outline presentasi yang memukau, berbasis data, dan memiliki alur storytelling yang kuat.",
      max_tokens: 1200
    },
    "DEFAULT": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Partner Bisnis Strategis. Fokus pada efisiensi, ROI, dan hasil profesional.",
      max_tokens: 1200
    }
  }
};

export async function POST(req: Request) {
  try {
    // FIX: Tambahkan fileContent di sini biar nyambung sama Mammoth di page.tsx
    const { chatId, message, mode, category, fileContent } = await req.json();
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sesi Habis" }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('quota').eq('id', user.id).single();
    if (!profile || profile.quota <= 0) return NextResponse.json({ error: "Poin Habis!" }, { status: 403 });

    const userCategory = category || "MAHASISWA";
    const kastaConfig = BRAIN_CONFIGS[userCategory] || BRAIN_CONFIGS["MAHASISWA"];
    const config = kastaConfig[mode] || kastaConfig["DEFAULT"];

    // FIX: Gabungkan isi file ke dalam prompt agar AI bisa membaca konteksnya
    const finalPrompt = fileContent 
      ? `KONTEKS FILE LAMPIRAN (Isi Dokumen):\n${fileContent}\n\nPERTANYAAN USER:\n${message}`
      : message;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "system", content: config.system }, { role: "user", content: finalPrompt }],
      model: config.model,
      temperature: 0.5,
      max_tokens: config.max_tokens,
    });

    const aiResponse = completion.choices[0]?.message?.content || "Gagal memproses.";
    const cleanResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    await supabase.from('messages').insert([{ chat_id: chatId, role: 'assistant', content: cleanResponse }]);
    await supabase.from('profiles').update({ quota: profile.quota - 1 }).eq("id", user.id);

    return NextResponse.json({ content: cleanResponse });

  } catch (error: any) {
    console.error("Route Error:", error);
    return NextResponse.json({ error: "Sistem Guugie sedang sibuk." }, { status: 500 });
  }
}