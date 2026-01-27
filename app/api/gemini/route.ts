import Groq from "groq-sdk";
import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- 🧠 KONFIGURASI OTAK MASTER (SYNCED WITH GROQ CLOUD 2026) ---
const BRAIN_CONFIGS: Record<string, Record<string, { model: string; system: string; max_tokens: number }>> = {
  "MAHASISWA": {
    "CARI IDE": {
      model: "llama-3.3-70b-versatile", // Stabil & Cerdas buat riset
      system: "Anda adalah Profesor Senior Strategi Riset. Karakter: Dingin, kritis, benci ide pasaran. Fokus pada Novelty. Jawab langsung ke inti.",
      max_tokens: 1500
    },
    "SIMULASI SIDANG": {
      model: "openai/gpt-oss-120b", // Pake model raksasa buat bantaian maksimal!
      system: "Anda adalah Penguji Killer. Karakter: Sinis, tajam, mencari celah metodologi. Bantai user dengan satu pertanyaan tajam.",
      max_tokens: 1200
    },
    "DEFAULT": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Asisten Akademik Doktoral. Gunakan bahasa ilmiah formal.",
      max_tokens: 1500
    }
  },
  "PELAJAR": {
    "TUTOR BIMBEL": {
      model: "meta-llama/llama-4-maverick-17b-128e-instruct", // Model terbaru 2026!
      system: "Anda adalah Kakak Tutor yang asik. Karakter: Sabar, analogi lucu, simpel. Jelasin materi sekolah agar mudah dimengerti.",
      max_tokens: 1000
    },
    "DEFAULT": {
      model: "llama-3.1-8b-instant", // Super Irit & Cepat
      system: "Anda adalah Tutor Sabar. Jawab singkat dan padat untuk level sekolah.",
      max_tokens: 800
    }
  },
  "PROFESIONAL": {
    "CORPORATE TONE": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah CEO Senior. Ubah pesan menjadi email korporat elit, sopan, dan berwibawa.",
      max_tokens: 1000
    },
    "DEFAULT": {
      model: "llama-3.3-70b-versatile",
      system: "Anda adalah Konsultan Bisnis Global. Fokus pada efisiensi dan hasil.",
      max_tokens: 1200
    }
  }
};

export async function POST(req: Request) {
  try {
    const { chatId, message, mode, category } = await req.json();
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

    // 🛡️ Auth & Profile Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Sesi Habis" }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('quota').eq('id', user.id).single();
    if (!profile || profile.quota <= 0) return NextResponse.json({ error: "Poin Habis!" }, { status: 403 });

    // 🧠 Pemilihan Logic Berdasarkan Kasta di Metadata
    const userCategory = category || "MAHASISWA";
    const kastaConfig = BRAIN_CONFIGS[userCategory] || BRAIN_CONFIGS["MAHASISWA"];
    const config = kastaConfig[mode] || kastaConfig["DEFAULT"];

    const completion = await groq.chat.completions.create({
      messages: [{ role: "system", content: config.system }, { role: "user", content: message }],
      model: config.model,
      temperature: 0.5,
      max_tokens: config.max_tokens,
    });

    const aiResponse = completion.choices[0]?.message?.content || "Gagal memproses.";
    const cleanResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // 💾 Update DB & Poin
    await supabase.from('messages').insert([{ chat_id: chatId, role: 'assistant', content: cleanResponse }]);
    await supabase.from('profiles').update({ quota: profile.quota - 1 }).eq("id", user.id);

    return NextResponse.json({ content: cleanResponse });

  } catch (error: any) {
    console.error("Route Error:", error);
    return NextResponse.json({ error: "Sistem Guugie sedang sibuk." }, { status: 500 });
  }
}