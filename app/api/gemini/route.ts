import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// WAJIB: Biar jalan ngebut di Cloudflare
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    // 1. Setup Cookie & Supabase (Next.js 15 Standard)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch (error) { 
              // Abaikan error di Edge Runtime
            }
          },
        }
      }
    );

    // 2. Ambil Data User & Request
    const { chatId, message, modelId, fileContent } = await req.json();
    const { data: { user } } = await supabase.auth.getUser();

    // 3. Security Check: User Wajib Login
    if (!user || !user.email) {
      return NextResponse.json({ error: "Sesi Habis, silakan login ulang." }, { status: 401 });
    }

    // 4. Cek Status Admin (Hardcode Email Lu biar Aman)
    const isAdmin = user.email === 'guuglabs@gmail.com';

    // 5. Sistem Ekonomi Poin
    const pointsMap: Record<string, number> = { 
      "google/gemini-2.5-flash": 10, 
      "deepseek/deepseek-v3.2": 5, 
      "xiaomi/mimo-v2-flash": 0 
    };
    const cost = pointsMap[modelId] || 0;

    // 6. Proteksi Saldo (Admin Gratis)
    if (!isAdmin && cost > 0) {
      // Cek saldo dulu
      const { data: prof } = await supabase.from('profiles').select('quota').eq('id', user.id).single();
      
      if (!prof || prof.quota < cost) {
        return NextResponse.json({ error: "Poin Habis! Top up dulu, Bang." }, { status: 403 });
      }
      
      // Potong poin pakai RPC database
      const { error: rpcError } = await supabase.rpc('deduct_points', { 
        user_id_input: user.id, 
        cost_input: cost 
      });
      
      if (rpcError) {
        console.error("RPC Error:", rpcError);
        throw new Error("Gagal memproses transaksi poin.");
      }
    }

    // 7. System Prompt (Otak Guugie)
    const systemPrompt = `Anda adalah Guugie (dikembangkan oleh GUUG LABS), asisten riset akademik paling cerdas di Indonesia. 

TUJUAN: Membantu akademisi, mahasiswa, dan peneliti membedah data, proposal, dan jurnal dengan standar intelektual tinggi.

INSTRUKSI KHUSUS:
1. IDENTITAS: Jika percakapan baru dimulai, perkenalkan diri sebagai "Saya Guugie, asisten riset Anda."
2. KETAJAMAN ANALISIS: Jika ada konteks dokumen, bedah secara kritis. Cari research gap, kelemahan metodologi, dan novelty penelitian. Jangan hanya merangkum!
3. FORMAT JAWABAN: Gunakan Markdown (Heading, Bold, List, Table). Pastikan struktur jawaban sistematis dan enak dibaca.
4. GAYA BAHASA: Gunakan Bahasa Indonesia yang profesional, intelek, namun tetap mengalir.
5. KEJUJURAN: Jangan berhalusinasi. Jika data tidak ada, katakan tidak ada.`;

    // 8. Tembak API OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://guugie.pages.dev",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: fileContent ? `[DOKUMEN USER]\n${fileContent}\n\n[PERTANYAAN]\n${message}` : message }
        ],
        temperature: 0.5,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) throw new Error(`OpenRouter Error: ${response.statusText}`);

    const aiData = await response.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "Maaf, sistem sedang sibuk.";
    
    // 9. Bersihkan Tag <think> (Khusus DeepSeek)
    const cleanContent = rawContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // 10. Simpan Jawaban AI ke Database
    if (chatId) {
      await supabase.from('messages').insert([{ 
        chat_id: chatId, 
        role: 'assistant', 
        content: cleanContent,
      }]);
    }

    // 11. Kirim Jawaban ke Frontend
    return NextResponse.json({ content: cleanContent });

  } catch (e) { 
    console.error("Backend Error:", e);
    return NextResponse.json({ error: "Maaf, server sedang sibuk atau terjadi kesalahan jaringan." }, { status: 500 }); 
  }
}