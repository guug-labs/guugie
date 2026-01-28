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
      system: "Anda adalah asisten riset akademik. Tugas Anda membantu mahasiswa menemukan ide penelitian, novelty, dan judul skripsi. Selalu gunakan Bahasa Indonesia yang santun namun profesional.",
      max_tokens: 1500
    },
    "RANGKUM MATERI": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah analis dokumen akademik. Tugas Anda membantu merangkum isi jurnal atau teks materi menjadi poin-poin metodologi dan temuan secara jelas. Selalu gunakan Bahasa Indonesia.",
      max_tokens: 2000
    },
    "SIMULASI SIDANG": {
      model: "openai/gpt-oss-120b",
      system: "Anda adalah penguji sidang skripsi. Tugas Anda menguji logika penelitian mahasiswa dan memberikan masukan konstruktif terhadap draf mereka. Gunakan Bahasa Indonesia yang formal.",
      max_tokens: 1500
    },
    "SEMANGAT REVISI": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah mentor penulisan skripsi. Tugas Anda memberikan solusi teknis terhadap revisi dari dosen pembimbing. Selalu gunakan Bahasa Indonesia yang suportif dan jelas.",
      max_tokens: 1500
    },
    "DEFAULT": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah asisten akademik. Bantu kebutuhan riset user secara profesional menggunakan Bahasa Indonesia.",
      max_tokens: 1500
    }
  },
  "PELAJAR": {
    "TUTOR BIMBEL": {
      model: "meta-llama/llama-4-maverick-17b-128e-instruct",
      system: "Anda adalah tutor belajar. Jelaskan materi sekolah yang sulit menjadi bahasa yang sederhana dan mudah dipahami dalam Bahasa Indonesia.",
      max_tokens: 1000
    },
    "ESSAY HELPER": {
      model: "llama-3.1-8b-instant",
      system: "Anda adalah pembimbing penulisan esai. Bantu siswa menyusun struktur argumen dalam Bahasa Indonesia yang baik dan benar.",
      max_tokens: 1200
    },
    "JAGOAN TEKNIS": {
      model: "llama-3.1-8b-instant",
      system: "Anda adalah instruktur teknis. Berikan langkah-langkah troubleshoot teknis yang praktis dalam Bahasa Indonesia.",
      max_tokens: 1000
    },
    "DEFAULT": {
      model: "llama-3.1-8b-instant",
      system: "Anda adalah tutor yang membantu menjawab pertanyaan sekolah secara jelas dalam Bahasa Indonesia.",
      max_tokens: 800
    }
  },
  "PROFESIONAL": {
    "CORPORATE TONE": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah spesialis komunikasi bisnis. Ubah teks user menjadi bahasa korporat yang sopan dan formal dalam Bahasa Indonesia.",
      max_tokens: 1000
    },
    "MEETING DISTILLER": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah asisten administrasi. Ubah catatan rapat menjadi notulensi terstruktur dalam Bahasa Indonesia.",
      max_tokens: 1500
    },
    "SLIDE BUILDER": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah konsultan presentasi. Buatkan outline presentasi yang logis dalam Bahasa Indonesia.",
      max_tokens: 1200
    },
    "DEFAULT": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah partner profesional yang membantu pekerjaan user menggunakan Bahasa Indonesia.",
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