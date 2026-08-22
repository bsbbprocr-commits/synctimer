# ⏱️ SyncTimer — Eş Zamanlı Gerçek Zamanlı Kronometre & Geri Sayım Uygulaması

Birden fazla kullanıcının aynı odaya katılıp aynı kronometreyi veya geri sayım zamanlayıcısını **gerçek zamanlı ve milisaniye hassasiyetinde senkronize** olarak takip edebildiği web uygulaması.

---

## 🌟 Öne Çıkan Özellikler

- 🌐 **Oda Tabanlı Çoklu Kullanıcı**: Benzersiz 6 haneli oda kodları (ör. `ABC-123`) veya tek tıkla kopyalanabilen direkt bağlantı linki.
- ⚡ **Kusursuz Senkronizasyon (Zero-Drift)**:
  - İstemciler bağımsız `setInterval` sayacı kullanmaz; sunucu zaman damgası (`startTimestamp`) ve duraklatma süresi (`elapsedBeforePause`) referans alınır.
  - NTP benzeri saat kalibrasyonu (ServerClock Sync) ile istemci cihaz saatlerindeki farklar ve ağ gecikmesi hesaba katılır.
  - 60/120 FPS akıcı gösterim için `requestAnimationFrame` kullanılır.
- 🔄 **İki Farklı Mod**:
  - **Kronometre**: İleriye doğru sayım ve Lap / Tur zamanı kaydı.
  - **Geri Sayım (Zamanlayıcı)**: Hızlı ön ayarlar (1 Dk, 5 Dk, 25 Dk Pomodoro vb.) veya özel saat:dakika:saniye ayarı. Kalan süre yüzdesini gösteren dinamik ilerleme çubuğu.
- 🏁 **Lap / Tur Zamanı Tablosu**: En hızlı tur (Yeşil) ve en yavaş tur (Kırmızı) akıllı tespiti, tüm turları panoya kopyalama desteği.
- 👥 **Katılımcı Listesi**: Odadaki anlık kullanıcı sayısı, kullanıcı adları ve isim değiştirme.
- 🔊 **Dahili Web Audio API Ses Motoru**: Harici ses dosyası yüklemeden saf osilatörle kristal netliğinde Başlat, Duraklat, Sıfırla, Tur ve Süre Doldu alarm sesleri.
- 🎨 **Modern Tasarım (UI/UX)**:
  - Glassmorphism & High-Contrast dijital sayaç (`00:00:00.00`).
  - Karanlık (Dark) ve Aydınlık (Light) tema desteği.
  - Canlı reaksiyon butonları (ekranda süzülen 👏, 🔥, ⚡, 🎉, 🚀 emojileri).
  - %100 Mobil ve tablet uyumlu (Responsive).

---

## 🚀 Hızlı Başlangıç (Lokal Kurulum)

### Gereksinimler
- [Node.js](https://nodejs.org/) (v16 veya üzeri)
- npm

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Uygulamayı Başlatın
```bash
# Normal çalıştırma
npm start

# veya otomatik yenilemeli geliştirme modu (nodemon)
npm run dev
```

### 3. Tarayıcıda Açın
Tarayıcınızdan `http://localhost:3000` adresine gidin. Farklı sekmelerde veya cihazlarda aynı odaya girerek gerçek zamanlı senkronizasyonu test edebilirsiniz.

---

## 🌐 Deploy (Canlıya Alma) Rehberi

### Seçenek 1: Render.com (Önerilen — Ücretsiz & Tek Tıkla)
1. GitHub reponuzu [render.com](https://render.com)'a bağlayın.
2. **New Web Service** seçin.
3. Ayarları yapın:
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. **Deploy** butonuna tıklayın.

### Seçenek 2: Railway.app
1. [railway.app](https://railway.app)'e giriş yapın ve **New Project > Deploy from GitHub repo** deyin.
2. Railway projenizi otomatik algılayıp `npm start` ile ayağa kaldıracaktır.

### Seçenek 3: Vercel Uyumluluk Notu
> [!IMPORTANT]
> **Vercel & WebSocket Uyumluluğu**:  
> Vercel sunucusuz (Serverless Edge) bir mimariye sahiptir ve kalıcı WebSocket (Socket.io) bağlantılarını tek bir sunucuda doğrudan desteklemez.
> 
> Uygulamanızı Vercel ekosisteminde kullanmak istiyorsanız:
> 1. Backend (`server.js`) kodunuzu **Render** veya **Railway** üzerinde barındırın (örneğin: `https://synctimer-backend.onrender.com`).
> 2. `public/js/room.js` dosyasındaki `io()` bağlantısını backend URL'nize yönlendirin:
>    ```javascript
>    const socket = io('https://synctimer-backend.onrender.com');
>    ```
> 3. Frontend `public` klasörünü Vercel'e statik site olarak yükleyin.

---

## 📁 Proje Dizin Yapısı

```
├── server.js               # Express + Socket.io backend ve oda yönetimi
├── package.json            # Bağımlılıklar ve npm scriptleri
├── .gitignore              # Git tarafından yoksayılan dosyalar
├── README.md               # Proje ve kurulum dokümantasyonu
└── public/                 # Statik frontend dosyaları
    ├── index.html          # Karşılama ve oda oluşturma / katılma sayfası
    ├── room.html           # Eş zamanlı kronometre / zamanlayıcı odası
    ├── css/
    │   └── style.css       # Tasarım sistemi, cam efektleri ve temalar
    └── js/
        ├── timer-engine.js # Drift-free saat motoru ve ses efektleri
        ├── room.js         # Oda istemci yönetimi ve Socket.io dinleyicileri
        └── main.js         # Ana sayfa mantığı ve yönlendirmeler
```

---

## 🛠️ Lisans
MIT
