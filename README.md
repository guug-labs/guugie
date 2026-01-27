# 🚀 GUUGIE: The Multi-Tier AI Research Platform

**Guugie** adalah platform asisten penelitian cerdas berbasis AI yang dirancang khusus untuk memenuhi kebutuhan spesifik berbagai profil pengguna. Menggunakan arsitektur **Next.js 15**, **Supabase SSR**, dan **Groq Cloud API (2026)**, Guugie menghadirkan pengalaman diskusi yang semulus Gemini dengan kecerdasan model yang disesuaikan berdasarkan "Kasta" pengguna.

---

## ✨ Fitur Unggulan

* **🧠 Brain Hierarchy System**: Otak AI yang dinamis berdasarkan profil pengguna (Mahasiswa, Pelajar, Profesional).
* **⚡ Ultra-Fast Response**: Menggunakan infrastruktur LPU dari Groq untuk latensi yang hampir nol.
* **🔒 Locked Role Identity**: Sekali kasta dipilih, sistem mengunci identitas tersebut di metadata Supabase untuk konsistensi pengalaman.
* **💬 Gemini-Style UI**: Chatbox yang otomatis membesar (Auto-Expand) dan area chat yang mendukung scroll mandiri (Fixed Input).
* **📑 Storage Integration**: Fitur upload file penelitian yang langsung terintegrasi dengan Supabase Storage.
* **🎤 Voice-to-Text**: Mendukung input suara untuk diskusi yang lebih natural.

---

## 🏗️ Tech Stack

* **Framework**: Next.js 15 (App Router)
* **Backend & Auth**: Supabase SSR (Auth & PostgreSQL)
* **AI Engine**: Groq SDK (Llama 4 Maverick, GPT-OSS 120B, Llama 3.3 70B)
* **Styling**: Tailwind CSS & Lucide React Icons
* **Deployment**: Vercel / Cloudflare Pages

---

## 🏛️ Kasta AI & Konfigurasi Model (Update 2026)

| Kasta | Mode Unggulan | Model AI | Karakteristik |
| :--- | :--- | :--- | :--- |
| **MAHASISWA** | Simulasi Sidang | **GPT-OSS 120B** | Akademis, Kritis, Profesor-style |
| **PELAJAR** | Tutor Bimbel | **Llama 4 Maverick** | Sabar, Analogi Lucu, Edukatif |
| **PROFESIONAL** | Corporate Tone | **Llama 3.3 70B** | Elit, Berwibawa, CEO-style |

---

## 🚀 Instalasi Lokal

1. **Clone repositori:**
   ```bash
   git clone [https://github.com/username/guugie.git](https://github.com/username/guugie.git)
   cd guugie

   🛡️ Lisensi & Disclaimer
Guugie dikembangkan oleh GUUG LABS © 2026. Aplikasi ini ditujukan untuk meningkatkan produktivitas riset dan dilarang keras digunakan untuk tindakan plagiarisme atau manipulasi data yang melanggar integritas akademik.