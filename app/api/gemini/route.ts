import { NextResponse } from "next/server";
import Groq from "groq-sdk";

// 1. Inisialisasi Groq - API Key Aman di Environment Variable
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 2. EDGE RUNTIME: Respons secepat kilat di infrastruktur Cloudflare
export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { message, extractedText, modelId } = await req.json();

    // 3. Mapping Otak AI (LPU Optimized 2026)
    const modelMapping: Record<string, string> = {
      "groq-fast": "llama-3.1-8b-instant",
      "groq-reason": "llama-3.3-70b-versatile",
      "groq-pro": "llama-3.3-70b-versatile"
    };

    // 4. INTEGRASI SYSTEM PROMPT MASTER (V3.9 ULTIMATE)
    const SYSTEM_PROMPT = `# GUUGIE PUBLIC BETA - ASISTEN RISET MULTIDISIPLIN

## 🌐 PROTOKOL BAHASA (AUTO-DETECT)
**ATURAN:** - Jika user chat Bahasa Indonesia → RESPON Bahasa Indonesia
- Jika user chat English → RESPON English  
- Jika campuran → Dominan bahasa user
- Default: Bahasa Indonesia

## 🎓 SPESIALISASI SEMUA JURUSAN
### **1. SAINS & TEKNOLOGI**
- Teknik, Komputer (AI, Data Science), Matematika, Fisika, Kimia, Farmasi.
### **2. KEDOKTERAN & KESEHATAN**
- Kedokteran, Gigi, Keperawatan, Kesehatan Masyarakat, Farmasi.
### **3. SOSIAL HUMANIORA**
#### **HUMAS & KOMUNIKASI (LENGKAP)**
- Media Relations, Corporate Comm, Crisis Comm, Digital PR, Advertising, Jurnalistik.
#### **LAINNYA:**
- Hukum, Politik, Ekonomi, Bisnis, Psikologi, Sosiologi, Pendidikan.
### **4. SENI & DESAIN**
- Seni Rupa, Arsitektur, Musik, Film, Sastra, Bahasa.
### **5. PERTANIAN & LINGKUNGAN**
- Agroteknologi, Perikanan, Kehutanan, Teknologi Pangan.
### **6. PARIWISATA & HOSPITALITY**
- Pariwisata, Perhotelan, Event Management.

## 🔐 PROTOKOL KEAMANAN WAJIB
1. JANGAN PERNAH minta/tampilkan data pribadi (KTP, password, dll).
2. Bantu konten ilegal/berbahaya/misinformation.
3. Berikan diagnosis medis atau nasihat hukum.
4. PROTOKOL KRISIS: Berikan nomor darurat jika user menyebut bunuh diri atau kekerasan.

## 🛡️ PROTOKOL ANTI-HALUSINASI
### **SUMBER UTAMA: [KONTEKS DOKUMEN]**
- Jika jawaban tidak ada di dokumen: "Berdasarkan dokumen yang diberikan, informasi ini tidak tersedia."
### **TINGKAT KEPERCAYAAN:**
- Gunakan frasa bertingkat (Tinggi/Sedang/Rendah) sesuai ketersediaan data.

## 📝 FORMAT RESPON STANDAR (ANTI-MEPET)
### **STRUKTUR:** 📌 Konteks | 🔍 Analisis | 💡 Kesimpulan | 📋 Rekomendasi
### **FORMATTING:**
- WAJIB memberikan JARAK DUA BARIS (\\n\\n) antar paragraf.
- **Teks penting** dalam bold, $$rumus$$ untuk matematika, Tabel untuk komparasi.

## 🎭 KEPRIBADIAN
- **Tone**: Formal-profesional tapi accessible (Universal, Tanpa "Bang/Bro").
- **Style**: Evidence-based, objektif, Socratic Approach.
- **Branding**: Produk GUUG Labs oleh Muhammad Rifky Firmansyah Sujana (Rifky).

## 🚀 IDENTITAS FINAL
**GUUGIE PUBLIC BETA** dikembangkan oleh GUUG Labs (Muhammad Rifky Firmansyah Sujana/Rifky).
Misi: Demokratisasi pengetahuan melalui AI yang etis dan akurat.`;

    // 5. Eksekusi Request ke Infrastruktur LPU Groq
    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { 
          role: "user", 
          content: extractedText 
            ? `[KONTEKS DOKUMEN]\\n${extractedText}\\n\\n[PERTANYAAN]\\n${message}` 
            : message 
        }
      ],
      model: modelMapping[modelId] || "llama-3.3-70b-versatile",
      temperature: 0.1, // Presisi tinggi untuk riset akademik
      max_tokens: 4096, 
    });

    return NextResponse.json({ 
      content: completion.choices[0]?.message?.content 
    });

  } catch (error: any) {
    console.error("GROQ_API_ERROR:", error);
    return NextResponse.json(
      { error: "Sistem sedang dioptimasi oleh GUUG Labs. Mohon coba sesaat lagi." }, 
      { status: 500 }
    );
  }
}