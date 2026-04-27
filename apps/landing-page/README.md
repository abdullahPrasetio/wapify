# Wapbolt Landing Page 🌐

Landing page modern untuk Wapbolt, dibangun dengan **React**, **Tailwind CSS**, dan **Framer Motion**. Project ini dirancang untuk menampilkan keunggulan Wapbolt dibanding Postman dan kemampuannya untuk dideploy di perangkat low-resource seperti STB.

## Fitur Utama
- **Modern UI/UX:** Tema gelap dengan aksen Electric Blue.
- **High-End Animations:** Menggunakan Framer Motion untuk transisi yang mulus.
- **Comparison Table:** Menjelaskan kenapa Wapbolt lebih unggul dari Postman.
- **Tech Stack Showcase:** Menampilkan teknologi inti (Go, React, Electron, Ed25519).
- **Responsive:** Optimal di desktop, tablet, maupun mobile.

## Cara Menjalankan (Lokal)

1. Masuk ke folder landing page:
   ```bash
   cd apps/landing-page
   ```
2. Instal dependensi:
   ```bash
   npm install
   ```
3. Jalankan mode development:
   ```bash
   npm run dev
   ```
4. Buka di browser: `http://localhost:5173`

## Cara Deploy di STB (Android/Linux)

Karena STB biasanya memiliki resource terbatas, cara terbaik adalah melakukan **Static Build** dan melayaninya menggunakan server ringan (seperti Nginx atau Python).

1. **Build Project:**
   ```bash
   npm run build
   ```
   Ini akan menghasilkan folder `dist`.

2. **Transfer ke STB:**
   Gunakan SCP atau SFTP untuk mengirim folder `dist` ke STB Anda.

3. **Serve menggunakan Python (Simple):**
   Di terminal STB Anda, masuk ke folder `dist` dan jalankan:
   ```bash
   python3 -m http.server 8080
   ```
   Sekarang landing page dapat diakses di `http://stb-ip-address:8080`.

4. **Serve menggunakan Nginx (Recomended):**
   Copy isi folder `dist` ke `/var/www/html` di STB Anda dan konfigurasi Nginx untuk mengarah ke sana.

---
**Developer:** [abdullahPrasetio](https://github.com/abdullahPrasetio)
**Project:** Wapbolt API Collaboration
