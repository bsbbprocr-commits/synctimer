/**
 * BackgroundEngine - Procedural Nature & Ambient Animated Backgrounds
 * 3-4s relaxing loops with seamless crossfade transitions
 */

class NatureBackgroundEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    // Sahneler
    this.scenes = ['waves', 'forest', 'space', 'sunset', 'rain'];
    this.currentScene = 'none'; // 'waves' | 'forest' | 'space' | 'sunset' | 'rain' | 'none'
    this.autoCycle = false;
    this.cycleInterval = 18000; // Otomatik modda her sahne 18 sn
    this.cycleTimer = null;

    // Crossfade (Geçiş) Değişkenleri
    this.isTransitioning = false;
    this.transitionProgress = 1; // 0 -> 1
    this.transitionDuration = 1500; // ms
    this.transitionStartTime = 0;
    this.previousScene = null;

    // Offscreen Canvas (Geçişler için çift tampon)
    this.offCanvas = document.createElement('canvas');
    this.offCtx = this.offCanvas.getContext('2d');

    // Zaman ve Animasyon
    this.startTime = performance.now();
    this.rafId = null;
    this.time = 0;

    // Parçacık / Sahne verileri
    this.initSceneData();

    // Event listenerlar
    this.handleResize = this.resize.bind(this);
    window.addEventListener('resize', this.handleResize);

    this.resize();
  }

  initSceneData() {
    // 1. Yıldızlar & Aurora
    this.stars = [];
    for (let i = 0; i < 160; i++) {
      this.stars.push({
        x: Math.random(),
        y: Math.random() * 0.75,
        size: Math.random() * 2 + 0.6,
        baseAlpha: Math.random() * 0.7 + 0.3,
        twinkleSpeed: (Math.PI * 2) / (3000 + Math.random() * 2000), // ~3-5s döngü
        phase: Math.random() * Math.PI * 2
      });
    }
    this.shootingStars = [];

    // 2. Orman & Ateş Böcekleri
    this.fireflies = [];
    for (let i = 0; i < 45; i++) {
      this.fireflies.push({
        x: Math.random(),
        y: Math.random() * 0.9 + 0.1,
        size: Math.random() * 3 + 1.5,
        vx: (Math.random() - 0.5) * 0.0001,
        vy: (Math.random() - 0.5) * 0.00008,
        pulseSpeed: (Math.PI * 2) / (3200 + Math.random() * 1200), // ~3.5s döngü
        phase: Math.random() * Math.PI * 2,
        color: Math.random() > 0.3 ? 'rgba(167, 243, 208, ' : 'rgba(253, 224, 71, '
      });
    }

    // 3. Gün Batımı Toz Parçacıkları (Golden Dust)
    this.sunDust = [];
    for (let i = 0; i < 35; i++) {
      this.sunDust.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 2.5 + 1,
        speedY: -(Math.random() * 0.00006 + 0.00003),
        phase: Math.random() * Math.PI * 2,
        floatFreq: (Math.PI * 2) / (4000 + Math.random() * 1000)
      });
    }

    // 4. Yağmur & Damlalar
    this.raindrops = [];
    for (let i = 0; i < 90; i++) {
      this.raindrops.push({
        x: Math.random(),
        y: Math.random(),
        length: Math.random() * 25 + 15,
        speed: Math.random() * 0.0012 + 0.0008,
        alpha: Math.random() * 0.4 + 0.2
      });
    }
    this.ripples = [];
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.offCanvas.width = this.width * this.dpr;
    this.offCanvas.height = this.height * this.dpr;
    this.offCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  setScene(sceneName, triggerCrossfade = true) {
    if (sceneName === 'auto') {
      this.autoCycle = true;
      if (this.currentScene === 'none' || this.currentScene === 'auto') {
        this.setScene(this.scenes[0], true);
      }
      this.startAutoCycle();
      return;
    }

    this.autoCycle = false;
    this.stopAutoCycle();

    if (this.currentScene === sceneName && !this.isTransitioning) return;

    if (triggerCrossfade && this.currentScene !== 'none' && sceneName !== 'none') {
      this.previousScene = this.currentScene;
      this.currentScene = sceneName;
      this.isTransitioning = true;
      this.transitionStartTime = performance.now();
      this.transitionProgress = 0;
    } else {
      this.previousScene = null;
      this.isTransitioning = false;
      this.currentScene = sceneName;
    }

    this.updateBodyClass();

    if (this.currentScene !== 'none' && !this.rafId) {
      this.start();
    } else if (this.currentScene === 'none') {
      this.clearCanvas();
    }
  }

  startAutoCycle() {
    this.stopAutoCycle();
    this.cycleTimer = setInterval(() => {
      if (!this.autoCycle) return;
      const idx = this.scenes.indexOf(this.currentScene);
      const nextIdx = (idx + 1) % this.scenes.length;
      const nextScene = this.scenes[nextIdx];

      this.previousScene = this.currentScene;
      this.currentScene = nextScene;
      this.isTransitioning = true;
      this.transitionStartTime = performance.now();
      this.transitionProgress = 0;
      this.updateBodyClass();
    }, this.cycleInterval);
  }

  stopAutoCycle() {
    if (this.cycleTimer) {
      clearInterval(this.cycleTimer);
      this.cycleTimer = null;
    }
  }

  updateBodyClass() {
    const hasBg = this.currentScene !== 'none';
    if (hasBg) {
      document.body.classList.add('has-custom-bg');
      document.body.setAttribute('data-nature-bg', this.currentScene);
    } else {
      document.body.classList.remove('has-custom-bg');
      document.body.removeAttribute('data-nature-bg');
    }
  }

  start() {
    if (this.rafId) return;
    const loop = (now) => {
      this.time = now - this.startTime;
      this.render(now);
      if (this.currentScene !== 'none' || this.isTransitioning) {
        this.rafId = requestAnimationFrame(loop);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  clearCanvas() {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  render(now) {
    if (this.currentScene === 'none' && !this.isTransitioning) {
      this.clearCanvas();
      return;
    }

    // Geçiş Animasyonu (Crossfade)
    if (this.isTransitioning && this.previousScene) {
      const elapsed = now - this.transitionStartTime;
      this.transitionProgress = Math.min(1, elapsed / this.transitionDuration);

      // Smooth step
      const t = this.transitionProgress;
      const alpha = t * t * (3 - 2 * t);

      // 1. Önceki sahneyi ana canvas'a çiz
      this.renderScene(this.previousScene, this.ctx, now);

      // 2. Yeni sahneyi offscreen canvas'a çiz
      this.offCtx.clearRect(0, 0, this.width, this.height);
      this.renderScene(this.currentScene, this.offCtx, now);

      // 3. Yeni sahneyi alpha ile ana canvas üstüne bindir
      this.ctx.save();
      this.ctx.globalAlpha = alpha;
      this.ctx.drawImage(this.offCanvas, 0, 0, this.width, this.height);
      this.ctx.restore();

      if (this.transitionProgress >= 1) {
        this.isTransitioning = false;
        this.previousScene = null;
      }
    } else {
      // Tek sahne çizimi
      this.renderScene(this.currentScene, this.ctx, now);
    }
  }

  renderScene(scene, targetCtx, now) {
    switch (scene) {
      case 'waves':
        this.drawWaves(targetCtx, now);
        break;
      case 'forest':
        this.drawForest(targetCtx, now);
        break;
      case 'space':
        this.drawSpace(targetCtx, now);
        break;
      case 'sunset':
        this.drawSunset(targetCtx, now);
        break;
      case 'rain':
        this.drawRain(targetCtx, now);
        break;
      default:
        break;
    }
  }

  // ==========================================
  // 1. Okyanus Dalgaları (Ocean Waves & Calm Flow)
  // ==========================================
  drawWaves(ctx, now) {
    const w = this.width;
    const h = this.height;

    // Gökyüzü & Deniz degrade arka planı
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#061325');
    skyGrad.addColorStop(0.45, '#0b2545');
    skyGrad.addColorStop(0.7, '#134074');
    skyGrad.addColorStop(1, '#081c34');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Güneş/Ay Işığı Yansıması
    const glowGrad = ctx.createRadialGradient(w * 0.5, h * 0.35, 10, w * 0.5, h * 0.35, w * 0.4);
    glowGrad.addColorStop(0, 'rgba(56, 189, 248, 0.15)');
    glowGrad.addColorStop(0.5, 'rgba(14, 165, 233, 0.05)');
    glowGrad.addColorStop(1, 'rgba(14, 165, 233, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, w, h);

    // 3.5s periyotlu sinüs dalgaları
    const t = (now / 3500) * Math.PI * 2;

    const drawWaveLayer = (baseY, amp, freq, speedMul, color, alpha) => {
      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, baseY);

      for (let x = 0; x <= w; x += 12) {
        const angle = (x * freq) + (t * speedMul);
        const y = baseY + Math.sin(angle) * amp + Math.cos(angle * 0.5) * (amp * 0.3);
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    };

    // Arka Dalga
    drawWaveLayer(h * 0.58, 22, 0.0035, 0.7, '#023e8a', 0.5);
    // Orta Dalga
    drawWaveLayer(h * 0.68, 28, 0.0042, 1.0, '#0077b6', 0.65);
    // Ön Dalga
    drawWaveLayer(h * 0.78, 35, 0.003, 1.2, '#0096c7', 0.8);
    // Köpük Parıltısı (En ön)
    drawWaveLayer(h * 0.88, 18, 0.005, 1.4, '#48cae4', 0.4);
  }

  // ==========================================
  // 2. Mistik Orman & Ateş Böcekleri (Mystic Forest)
  // ==========================================
  drawForest(ctx, now) {
    const w = this.width;
    const h = this.height;

    // Gece orman degrade
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#021814');
    grad.addColorStop(0.5, '#062922');
    grad.addColorStop(1, '#02130e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Sis / Işık Huzmesi
    const mistGrad = ctx.createRadialGradient(w * 0.5, h * 0.6, 20, w * 0.5, h * 0.6, w * 0.6);
    mistGrad.addColorStop(0, 'rgba(52, 211, 153, 0.08)');
    mistGrad.addColorStop(1, 'rgba(52, 211, 153, 0)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, 0, w, h);

    // Ağaç Siluetleri (Arka Katman)
    ctx.fillStyle = 'rgba(2, 24, 18, 0.75)';
    this.drawTreeSilhouette(ctx, w * 0.15, h * 0.45, 120, h * 0.6);
    this.drawTreeSilhouette(ctx, w * 0.35, h * 0.4, 150, h * 0.65);
    this.drawTreeSilhouette(ctx, w * 0.65, h * 0.42, 140, h * 0.62);
    this.drawTreeSilhouette(ctx, w * 0.85, h * 0.48, 110, h * 0.55);

    // 3.5s döngülü Ateş Böcekleri (Fireflies)
    this.fireflies.forEach((f) => {
      const pulse = (Math.sin(now * f.pulseSpeed + f.phase) + 1) / 2; // 0 - 1
      const alpha = 0.2 + pulse * 0.75;
      const floatX = f.x * w + Math.sin(now * 0.001 + f.phase) * 15;
      const floatY = f.y * h + Math.cos(now * 0.0012 + f.phase) * 12;

      ctx.save();
      const glow = ctx.createRadialGradient(floatX, floatY, 0, floatX, floatY, f.size * 3.5);
      glow.addColorStop(0, `${f.color}${alpha})`);
      glow.addColorStop(0.4, `${f.color}${alpha * 0.4})`);
      glow.addColorStop(1, `${f.color}0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(floatX, floatY, f.size * 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(floatX, floatY, f.size * 0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  drawTreeSilhouette(ctx, x, y, width, height) {
    ctx.beginPath();
    ctx.moveTo(x, y + height);
    ctx.lineTo(x + width * 0.5, y);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
  }

  // ==========================================
  // 3. Yıldızlı Gece & Aurora (Starry Night & Aurora)
  // ==========================================
  drawSpace(ctx, now) {
    const w = this.width;
    const h = this.height;

    // Derin Uzay Arka Planı
    const spaceGrad = ctx.createLinearGradient(0, 0, 0, h);
    spaceGrad.addColorStop(0, '#05030a');
    spaceGrad.addColorStop(0.5, '#0b081d');
    spaceGrad.addColorStop(1, '#020108');
    ctx.fillStyle = spaceGrad;
    ctx.fillRect(0, 0, w, h);

    // 3.5s döngülü Kuzey Işıkları (Aurora Waves)
    const t = (now / 3800) * Math.PI * 2;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    for (let i = 0; i < 3; i++) {
      const auroraGrad = ctx.createLinearGradient(0, h * 0.1, 0, h * 0.7);
      if (i === 0) {
        auroraGrad.addColorStop(0, 'rgba(99, 102, 241, 0)');
        auroraGrad.addColorStop(0.4, 'rgba(139, 92, 246, 0.18)');
        auroraGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.12)');
        auroraGrad.addColorStop(1, 'rgba(16, 185, 129, 0)');
      } else if (i === 1) {
        auroraGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
        auroraGrad.addColorStop(0.5, 'rgba(52, 211, 153, 0.15)');
        auroraGrad.addColorStop(1, 'rgba(99, 102, 241, 0)');
      } else {
        auroraGrad.addColorStop(0, 'rgba(236, 72, 153, 0)');
        auroraGrad.addColorStop(0.6, 'rgba(168, 85, 247, 0.12)');
        auroraGrad.addColorStop(1, 'rgba(59, 130, 246, 0)');
      }

      ctx.fillStyle = auroraGrad;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.1);

      for (let x = 0; x <= w; x += 16) {
        const wave = Math.sin((x * 0.003) + (t * (0.8 + i * 0.3)) + i) * 45;
        const wave2 = Math.cos((x * 0.005) - (t * 0.5) + i * 2) * 25;
        const y = (h * (0.28 + i * 0.08)) + wave + wave2;
        ctx.lineTo(x, y);
      }

      ctx.lineTo(w, h * 0.75);
      ctx.lineTo(0, h * 0.75);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Parlayan Yıldızlar (Twinkle)
    this.stars.forEach((s) => {
      const alpha = s.baseAlpha + Math.sin(now * s.twinkleSpeed + s.phase) * 0.35;
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0.1, Math.min(1, alpha))})`;
      ctx.beginPath();
      ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Kayan Yıldız (Shooting Star - Nadir ve rahatlatıcı)
    if (Math.random() < 0.003 && this.shootingStars.length < 1) {
      this.shootingStars.push({
        x: Math.random() * w * 0.8,
        y: Math.random() * h * 0.3,
        len: Math.random() * 80 + 60,
        speed: 14,
        alpha: 1
      });
    }

    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const star = this.shootingStars[i];
      star.x += star.speed;
      star.y += star.speed * 0.6;
      star.alpha -= 0.025;

      if (star.alpha <= 0) {
        this.shootingStars.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${star.alpha})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(star.x, star.y);
      ctx.lineTo(star.x - star.len, star.y - star.len * 0.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ==========================================
  // 4. Sakin Gün Batımı (Golden Sunset)
  // ==========================================
  drawSunset(ctx, now) {
    const w = this.width;
    const h = this.height;

    // Gün Batımı Degrade
    const sunsetGrad = ctx.createLinearGradient(0, 0, 0, h);
    sunsetGrad.addColorStop(0, '#2d112c');
    sunsetGrad.addColorStop(0.3, '#531b40');
    sunsetGrad.addColorStop(0.6, '#a43820');
    sunsetGrad.addColorStop(0.85, '#d97706');
    sunsetGrad.addColorStop(1, '#3b1207');
    ctx.fillStyle = sunsetGrad;
    ctx.fillRect(0, 0, w, h);

    // 3.5s periyotlu nefes alan Güneş Işığı
    const t = (now / 3500) * Math.PI * 2;
    const sunPulse = Math.sin(t) * 15;
    const sunX = w * 0.5;
    const sunY = h * 0.62;

    const sunGlow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 260 + sunPulse);
    sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.45)');
    sunGlow.addColorStop(0.3, 'rgba(249, 115, 22, 0.25)');
    sunGlow.addColorStop(0.7, 'rgba(239, 68, 68, 0.1)');
    sunGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = sunGlow;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 260 + sunPulse, 0, Math.PI * 2);
    ctx.fill();

    // Güneş Diski
    ctx.fillStyle = 'rgba(254, 240, 138, 0.85)';
    ctx.beginPath();
    ctx.arc(sunX, sunY, 45, 0, Math.PI * 2);
    ctx.fill();

    // Altın Toz Parçacıkları (Golden Floating Dust)
    this.sunDust.forEach((p) => {
      const floatX = p.x * w + Math.sin(now * 0.001 + p.phase) * 20;
      let curY = (p.y * h + (now * p.speedY * 100)) % h;
      if (curY < 0) curY += h;

      const alpha = 0.3 + Math.sin(now * p.floatFreq + p.phase) * 0.3;
      ctx.fillStyle = `rgba(254, 215, 170, ${alpha})`;
      ctx.beginPath();
      ctx.arc(floatX, curY, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Ufuk Tepeleri Silueti
    ctx.fillStyle = 'rgba(20, 5, 12, 0.85)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(0, h * 0.72);
    ctx.quadraticCurveTo(w * 0.3, h * 0.68, w * 0.6, h * 0.74);
    ctx.quadraticCurveTo(w * 0.85, h * 0.78, w, h * 0.7);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  // ==========================================
  // 5. Huzurlu Yağmur & Sis (Calm Rain)
  // ==========================================
  drawRain(ctx, now) {
    const w = this.width;
    const h = this.height;

    // Yağmurlu Gri-Mavi Arka Plan
    const rainGrad = ctx.createLinearGradient(0, 0, 0, h);
    rainGrad.addColorStop(0, '#0f172a');
    rainGrad.addColorStop(0.5, '#1e293b');
    rainGrad.addColorStop(1, '#090d16');
    ctx.fillStyle = rainGrad;
    ctx.fillRect(0, 0, w, h);

    // 3.5s periyotlu Sis Dalgaları
    const t = (now / 3500) * Math.PI * 2;
    const mistY = h * 0.65 + Math.sin(t) * 20;
    const mistGrad = ctx.createRadialGradient(w * 0.5, mistY, 30, w * 0.5, mistY, w * 0.7);
    mistGrad.addColorStop(0, 'rgba(148, 163, 184, 0.08)');
    mistGrad.addColorStop(1, 'rgba(148, 163, 184, 0)');
    ctx.fillStyle = mistGrad;
    ctx.fillRect(0, 0, w, h);

    // Yağmur Damlaları Çizimi
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.lineCap = 'round';

    this.raindrops.forEach((drop) => {
      let curY = ((drop.y * h) + (now * drop.speed * 800)) % (h + 50);
      let curX = (drop.x * w) - (curY * 0.15); // Hafif rüzgarlı eğim
      if (curX < 0) curX += w;

      ctx.beginPath();
      ctx.moveTo(curX, curY);
      ctx.lineTo(curX - 4, curY + drop.length);
      ctx.stroke();

      // Zeminde su halkalanması
      if (curY > h * 0.85 && Math.random() < 0.02) {
        this.ripples.push({
          x: curX,
          y: curY + drop.length,
          radius: 1,
          maxRadius: Math.random() * 12 + 6,
          alpha: 0.4
        });
      }
    });

    // Su Halkaları
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const rip = this.ripples[i];
      rip.radius += 0.4;
      rip.alpha -= 0.015;

      if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
        this.ripples.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.strokeStyle = `rgba(186, 230, 253, ${rip.alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(rip.x, rip.y, rip.radius * 2, rip.radius * 0.6, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }
}

// Global olarak tarayıcı ortamına sun
window.NatureBackgroundEngine = NatureBackgroundEngine;
