import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Node.js Runtime (Wajib agar cookies() berjalan lancar)

export async function POST(req: Request) {
  try {
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
              // Handle in server component context
            }
          },
        },
      }
    );

    // --- 1. VALIDASI INPUT & AUTH ---
    const body = await req.json();
    const { chatId, message, modelId, fileContent, isAdmin } = body;

    if (!message || !modelId) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Sesi habis, silakan login ulang" }, { status: 401 });
    }

    // --- 2. SISTEM POIN (SINKRON DENGAN PAGE.TSX) ---
    const validModels: Record<string, number> = {
      "google/gemini-2.5-flash": 10,
      "deepseek/deepseek-v3.2": 5,
      "xiaomi/mimo-v2-flash": 0
    };

    const cost = validModels[modelId] ?? 0;

    // Admin (guuglabs@gmail.com) bebas biaya
    if (!isAdmin && cost > 0) {
      const { data: profile } = await supabase.from('profiles').select('quota').eq('id', user.id).single();
      
      if (!profile || profile.quota < cost) {
        return NextResponse.json({ error: "Saldo poin tidak cukup" }, { status: 403 });
      }

      await supabase.from('profiles').update({ quota: profile.quota - cost }).eq("id", user.id);
    }

    // --- 3. PROMPT & OPENROUTER API ---
    const systemPrompt = `Anda adalah Guugie, asisten riset akademik profesional. 
    Berikan jawaban yang akurat, santun, dan sangat membantu mahasiswa atau peneliti. 
    Gunakan format markdown untuk struktur yang jelas.`;

    const finalPrompt = fileContent 
      ? `KONTEKS DOKUMEN:\n${fileContent}\n\n---\nPERTANYAAN USER:\n${message}`
      : message;

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
          { role: "user", content: finalPrompt }
        ],
        temperature: 0.6,
      }),
    });

    if (!response.ok) throw new Error("Gagal menghubungi server AI");

    const aiData = await response.json();
    const aiContent = aiData.choices[0]?.message?.content || "Maaf, gagal memproses respons.";
    
    // Hapus tag thinking DeepSeek agar output bersih
    const cleanResponse = aiContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

    // --- 4. SIMPAN KE DATABASE ---
    if (chatId) {
      await supabase.from('messages').insert([{ 
        chat_id: chatId, 
        role: 'assistant', 
        content: cleanResponse,
        created_at: new Date().toISOString()
      }]);
    }

    return NextResponse.json({ content: cleanResponse });

  } catch (error: any) {
    console.error("Route handler error:", error);
    return NextResponse.json({ error: "Sistem sedang sibuk" }, { status: 500 });
  }
}