import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// --- MANTRA SAKTI CLOUDFLARE ---
export const runtime = 'edge'; 

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// --- OPTIMIZED SYSTEM PROMPT (VERSI RINGAN & PADAT) ---
const SYSTEM_PROMPT = `🚀 **GUUGIE v2.0 - Indonesian Student's AI Companion**

**👑 Developer**: Muhammad Rifky Firmansyah Sujana "Rifky"
**🎯 Mission**: Eliminate academic stress with empathetic, smart AI

**🌐 BILINGUAL INTELLIGENCE**:
- Auto-detect language: ID ↔ EN
- Respond in user's language (Indonesian dominant)

**🎓 ACADEMIC EXPERTISE**:
1. ALL MAJORS: Tech, Medicine, Law, Business, Arts, Agriculture
2. THESIS SUPPORT: Chapters 1-5, methodology, analysis
3. ASSIGNMENTS: Papers, presentations, research

**💬 CONVERSATION RULES**:
1. NATURAL FLOW: Like talking to a smart friend.
2. CONTEXT AWARE: Remember topic & user's needs.
3. ANTICIPATE NEXT: "Next step: X or Y?"
4. NO RESET: Continue conversation naturally.

**📝 RESPONSE FORMAT (Use Markdown)**:
\`\`\`
🎯 CONTEXT: [Quick diagnosis of user's need]
💡 SOLUTION: [Main answer - practical & actionable]
🛠️ TOOLS: [Resources/references if needed]
🔄 NEXT: [Anticipate next logical step]
\`\`\`

**❤️ VIBE**: "Smart like professor, chill like friend, reliable like mentor"
**🔥 SIGNATURE**: "Dari semester 1 sampai wisuda - your study buddy!"`;

export async function POST(req: Request) {
  try {
    const { message, extractedText, modelId } = await req.json();

    // 1. VALIDASI API KEY
    if (!process.env.GROQ_API_KEY) {
      console.error("CRITICAL: GROQ_API_KEY is missing!");
      return NextResponse.json(
        { content: "⚠️ System Configuration Error: API Key missing on server." },
        { status: 500 }
      );
    }

    let finalPrompt = message;
    
    // 2. HANDLE DOKUMEN (Safety Limit: 20k karakter biar gak meledak)
    if (extractedText) {
      const truncatedText = extractedText.slice(0, 20000);
      finalPrompt = `
        [DOCUMENT START]
        ${truncatedText}
        [DOCUMENT END]
        
        USER QUESTION: "${message}"
        
        INSTRUCTION: Answer based ONLY on the document above.
      `;
    }

    // 3. MODEL SELECTION
    // Default ke 8b (Kilat) biar irit & cepet. Pake 70b (Nalar) cuma kalau diminta.
    let model = 'llama3-8b-8192'; 
    if (modelId === 'groq-reason') {
      model = 'llama3-70b-8192';
    }

    // 4. KIRIM KE GROQ
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: finalPrompt }
      ],
      model: model,
      temperature: 0.3,
      max_tokens: 2048, // Limit output biar gak abis di tengah jalan
      top_p: 1,
      stream: false,
    });

    const responseContent = chatCompletion.choices[0]?.message?.content 
      || "Maaf, Guugie kehilangan sinyal pikiran. Coba tanya lagi.";

    return NextResponse.json({ content: responseContent });

  } catch (error: any) {
    console.error("Groq API Error:", error);

    // 5. ERROR HANDLING YANG JUJUR (Bukan "Gangguan Saraf" doang)
    let errorMessage = "Terjadi gangguan pada server saraf Guugie v2.0.";
    
    if (error?.status === 429) {
      errorMessage = "⚠️ Server Sibuk (Rate Limit). Tunggu 1 menit lalu coba lagi.";
    } else if (error?.status === 401) {
      errorMessage = "⚠️ Kunci Akses Salah. Cek Environment Variables.";
    } else if (error?.message?.includes('token')) {
      errorMessage = "⚠️ Pertanyaan/Dokumen terlalu panjang. Mohon persingkat.";
    } else {
      errorMessage = `⚠️ System Error: ${error.message}`;
    }

    return NextResponse.json(
      { content: errorMessage },
      { status: error?.status || 500 }
    );
  }
}