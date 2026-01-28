import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = 'edge'; // WAJIB ADA UNTUK CLOUDFLARE PAGES

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
            // Di Edge POST, cookies biasanya di-handle middleware
            // Tapi kita biarkan pattern ini agar tidak error
          },
        },
      }
    );

    const body = await req.json();
    const { chatId, message, modelId, fileContent, isAdmin } = body;

    if (!message || !modelId) {
      return NextResponse.json({ error: "Data tidak lengkap" }, { status: 400 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Sesi habis, silakan login" }, { status: 401 });
    }

    const validModels: Record<string, number> = {
      "google/gemini-2.5-flash": 10,
      "deepseek/deepseek-v3.2": 5,
      "xiaomi/mimo-v2-flash": 0
    };

    const cost = validModels[modelId] ?? 0;

    if (!isAdmin && cost > 0) {
      const { data: profile } = await supabase.from('profiles').select('quota').eq('id', user.id).single();
      if (!profile || profile.quota < cost) {
        return NextResponse.json({ error: "Saldo poin tidak cukup" }, { status: 403 });
      }
      await supabase.from('profiles').update({ quota: profile.quota - cost }).eq("id", user.id);
    }

    const systemPrompt = `Anda adalah Guugie, asisten riset akademik profesional. 
    Berikan jawaban akurat, santun, dan formal dalam Bahasa Indonesia. 
    Gunakan markdown untuk struktur yang jelas.`;

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
    const aiContent = aiData.choices[0]?.message?.content || "Maaf, gagal memproses.";
    const cleanResponse = aiContent.replace(/<think>[\s\S]*?<\/think>/g, "").trim();

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
    console.error("Route error:", error);
    return NextResponse.json({ error: "Sistem sibuk" }, { status: 500 });
  }
}