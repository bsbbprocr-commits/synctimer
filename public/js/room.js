/**
 * Room Controller & Real-Time Sync Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. URL Parametreleri ve Kullanıcı Bilgisi
  const urlParams = new URLSearchParams(window.location.search);
  const roomId = (urlParams.get('id') || '').trim().toUpperCase();
  const initialModeParam = urlParams.get('mode');

  if (!roomId) {
    window.location.href = '/';
    return;
  }

  let userName = localStorage.getItem('synctimer_username');
  if (!userName || !userName.trim()) {
    userName = prompt('Lütfen adınızı girin:') || `Misafir-${Math.floor(Math.random() * 900 + 100)}`;
    localStorage.setItem('synctimer_username', userName);
  }

  // 2. DOM Elemanları
  const displayRoomId = document.getElementById('displayRoomId');
  const btnCopyLink = document.getElementById('btnCopyLink');
  const btnModeStopwatch = document.getElementById('btnModeStopwatch');
  const btnModeCountdown = document.getElementById('btnModeCountdown');
  const statusDot = document.getElementById('statusDot');
  const syncLatencyText = document.getElementById('syncLatencyText');

  const timerStatePill = document.getElementById('timerStatePill');
  const displayMain = document.getElementById('displayMain');
  const displayHundredths = document.getElementById('displayHundredths');
  const countdownProgressBar = document.getElementById('countdownProgressBar');
  const countdownProgressFill = document.getElementById('countdownProgressFill');
  const countdownConfigCard = document.getElementById('countdownConfigCard');

  const btnStart = document.getElementById('btnStart');
  const btnStartText = document.getElementById('btnStartText');
  const btnPause = document.getElementById('btnPause');
  const btnReset = document.getElementById('btnReset');
  const btnLap = document.getElementById('btnLap');

  const participantsList = document.getElementById('participantsList');
  const participantCountBadge = document.getElementById('participantCountBadge');
  const editUserNameInput = document.getElementById('editUserNameInput');
  const btnSaveName = document.getElementById('btnSaveName');

  const emptyLapsState = document.getElementById('emptyLapsState');
  const lapsTable = document.getElementById('lapsTable');
  const lapsTableBody = document.getElementById('lapsTableBody');
  const btnCopyLaps = document.getElementById('btnCopyLaps');

  const liveActivityMessage = document.getElementById('liveActivityMessage');
  const soundToggle = document.getElementById('soundToggle');
  const soundIconOn = document.getElementById('soundIconOn');
  const soundIconOff = document.getElementById('soundIconOff');
  const themeToggle = document.getElementById('themeToggle');
  const themeIconDark = document.getElementById('themeIconDark');
  const themeIconLight = document.getElementById('themeIconLight');

  // Süre seçici inputları
  const inputHours = document.getElementById('inputHours');
  const inputMinutes = document.getElementById('inputMinutes');
  const inputSeconds = document.getElementById('inputSeconds');
  const btnApplyDuration = document.getElementById('btnApplyDuration');
  const presetChips = document.querySelectorAll('.preset-chip');

  displayRoomId.innerText = `ODA: ${roomId}`;
  if (editUserNameInput) editUserNameInput.value = userName;

  // 3. Ses ve Tema Başlatma
  const soundEngine = new SoundEngine();
  let soundEnabled = localStorage.getItem('synctimer_sound') !== 'false';
  updateSoundIcon();

  soundToggle.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundEngine.enabled = soundEnabled;
    localStorage.setItem('synctimer_sound', soundEnabled);
    updateSoundIcon();
    showToast(soundEnabled ? 'Sesler açıldı' : 'Sesler kapatıldı', 'info');
  });

  function updateSoundIcon() {
    soundEngine.enabled = soundEnabled;
    if (soundEnabled) {
      soundIconOn.style.display = 'block';
      soundIconOff.style.display = 'none';
    } else {
      soundIconOn.style.display = 'none';
      soundIconOff.style.display = 'block';
    }
  }

  // Tema
  const savedTheme = localStorage.getItem('synctimer_theme') || 'dark';
  applyTheme(savedTheme);
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('synctimer_theme', next);
  });

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (theme === 'light') {
      themeIconDark.style.display = 'none';
      themeIconLight.style.display = 'block';
    } else {
      themeIconDark.style.display = 'block';
      themeIconLight.style.display = 'none';
    }
  }

  // 4. Socket.io ve TimerEngine Kurulumu
  // Eğer Vercel'de barındırılıyorsa Render/Railway backend URL'sini buraya yazabilirsiniz:
  // Örn: const BACKEND_URL = 'https://synctimer-backend.onrender.com';
  const BACKEND_URL = window.SOCKET_SERVER_URL || undefined;

  const socket = io(BACKEND_URL, {
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000
  });

  const serverClock = new ServerClock(socket);
  let currentRoomState = null;
  let hasAlarmFired = false;

  const timerEngine = new TimerEngine(
    serverClock,
    // onTick callback (her animasyon karesinde)
    (tickData) => {
      displayMain.innerText = `${tickData.formatted.hours}:${tickData.formatted.minutes}:${tickData.formatted.seconds}`;
      displayHundredths.innerText = `.${tickData.formatted.hundredths}`;

      if (tickData.mode === 'countdown') {
        countdownProgressFill.style.width = `${Math.max(0, Math.min(100, tickData.percent))}%`;
      }
    },
    // onFinish callback (Geri sayım bittiğinde)
    () => {
      if (!hasAlarmFired) {
        hasAlarmFired = true;
        socket.emit('timer-finished');
        soundEngine.playAlarm();
        updateStateBadge('finished');
      }
    }
  );

  // 5. Socket Olayları ve Bağlantı Yönetimi
  socket.on('connect', () => {
    statusDot.classList.remove('offline');
    syncLatencyText.innerText = 'Senkronize ediliyor...';
    serverClock.sync();

    // Odaya katıl
    socket.emit('join-room', { roomId, userName }, (response) => {
      if (response && response.success) {
        currentRoomState = response.roomState;
        
        // Eğer URL'den özel mod parametresi gelmişse ve oda idle ise uygula
        if (initialModeParam && currentRoomState.state === 'idle' && currentRoomState.mode !== initialModeParam) {
          socket.emit('set-mode', initialModeParam);
        } else {
          renderEntireState(currentRoomState);
        }

        updateLatencyDisplay();
      }
    });
  });

  socket.on('disconnect', () => {
    statusDot.classList.add('offline');
    syncLatencyText.innerText = 'Bağlantı koptu';
    timerStatePill.innerText = 'BAĞLANTI YOK';
  });

  socket.on('reconnect', () => {
    showToast('Yeniden bağlandı!', 'info');
    serverClock.sync();
  });

  // Oda durumu komple güncellendiğinde
  socket.on('room-state-updated', (state) => {
    currentRoomState = state;
    renderEntireState(state);
  });

  // Zamanlayıcı durum değişimi (Start / Pause / Reset)
  socket.on('timer-state-change', (data) => {
    if (!currentRoomState) return;

    currentRoomState.state = data.state;
    currentRoomState.startTimestamp = data.startTimestamp;
    currentRoomState.elapsedBeforePause = data.elapsedBeforePause;
    if (data.laps) currentRoomState.laps = data.laps;

    timerEngine.updateState(currentRoomState);
    updateControlsUI(currentRoomState.state);
    updateStateBadge(currentRoomState.state);

    if (data.action === 'start') {
      soundEngine.playStart();
      hasAlarmFired = false;
    } else if (data.action === 'pause') {
      soundEngine.playPause();
    } else if (data.action === 'reset') {
      soundEngine.playReset();
      hasAlarmFired = false;
      renderLaps(currentRoomState.laps || []);
    }
  });

  // Lap kaydedildiğinde
  socket.on('lap-recorded', (data) => {
    if (!currentRoomState) return;
    currentRoomState.laps = data.laps;
    renderLaps(data.laps);
    soundEngine.playLap();
    showToast(`Tur #${data.lap.id} kaydedildi: ${TimerEngine.formatTime(data.lap.lapTime).shortString}`);
  });

  // Mod değiştiğinde
  socket.on('room-mode-changed', (data) => {
    if (!currentRoomState) return;
    currentRoomState.mode = data.mode;
    currentRoomState.state = data.state;
    currentRoomState.elapsedBeforePause = data.elapsedBeforePause;
    currentRoomState.countdownDuration = data.countdownDuration;
    currentRoomState.laps = data.laps;

    hasAlarmFired = false;
    applyModeUI(data.mode);
    timerEngine.updateState(currentRoomState);
    updateControlsUI(currentRoomState.state);
    updateStateBadge(currentRoomState.state);
    renderLaps(currentRoomState.laps);
  });

  // Geri sayım süresi değiştiğinde
  socket.on('countdown-duration-changed', (data) => {
    if (!currentRoomState) return;
    currentRoomState.countdownDuration = data.countdownDuration;
    currentRoomState.state = data.state;
    currentRoomState.elapsedBeforePause = data.elapsedBeforePause;

    hasAlarmFired = false;
    syncDurationInputs(data.countdownDuration);
    timerEngine.updateState(currentRoomState);
    updateControlsUI(currentRoomState.state);
    updateStateBadge(currentRoomState.state);
  });

  // Geri sayım bittiğinde (Alarm)
  socket.on('timer-alarm', (data) => {
    if (currentRoomState) currentRoomState.state = 'finished';
    timerEngine.updateState(currentRoomState);
    updateControlsUI('finished');
    updateStateBadge('finished');
    soundEngine.playAlarm();
    showToast('⏰ SÜRE DOLDU!', 'error');
  });

  // Katılımcı güncellemeleri
  socket.on('participant-joined', (data) => {
    if (currentRoomState) currentRoomState.participants = data.participants;
    renderParticipants(data.participants);
  });

  socket.on('participant-left', (data) => {
    if (currentRoomState) currentRoomState.participants = data.participants;
    renderParticipants(data.participants);
  });

  socket.on('participant-updated', (data) => {
    if (currentRoomState) currentRoomState.participants = data.participants;
    renderParticipants(data.participants);
  });

  // Canlı aktivite akışı ve reaksiyonlar
  socket.on('system-message', (msg) => {
    if (liveActivityMessage) {
      liveActivityMessage.innerText = msg.text;
    }
  });

  socket.on('room-reaction', (data) => {
    spawnFloatingEmoji(data.emoji);
    if (liveActivityMessage) {
      liveActivityMessage.innerText = `${data.from}: ${data.emoji}`;
    }
  });

  // 6. UI Render Fonksiyonları
  function renderEntireState(state) {
    if (!state) return;

    applyModeUI(state.mode);
    syncDurationInputs(state.countdownDuration);
    timerEngine.updateState(state);
    updateControlsUI(state.state);
    updateStateBadge(state.state);
    renderParticipants(state.participants || []);
    renderLaps(state.laps || []);
    updateLatencyDisplay();
  }

  function applyModeUI(mode) {
    if (mode === 'countdown') {
      btnModeCountdown.classList.add('active');
      btnModeStopwatch.classList.remove('active');
      countdownConfigCard.style.display = 'flex';
      countdownProgressBar.style.display = 'block';
      btnLap.style.display = 'none';
    } else {
      btnModeStopwatch.classList.add('active');
      btnModeCountdown.classList.remove('active');
      countdownConfigCard.style.display = 'none';
      countdownProgressBar.style.display = 'none';
      btnLap.style.display = 'inline-flex';
    }
  }

  function updateControlsUI(state) {
    if (state === 'running') {
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnReset.disabled = false;
      btnLap.disabled = false;
      btnStartText.innerText = 'Çalışıyor';
    } else if (state === 'paused') {
      btnStart.disabled = false;
      btnPause.disabled = true;
      btnReset.disabled = false;
      btnLap.disabled = true;
      btnStartText.innerText = 'Devam Et';
    } else if (state === 'finished') {
      btnStart.disabled = true;
      btnPause.disabled = true;
      btnReset.disabled = false;
      btnLap.disabled = true;
      btnStartText.innerText = 'Tamamlandı';
    } else {
      // idle
      btnStart.disabled = false;
      btnPause.disabled = true;
      btnReset.disabled = true;
      btnLap.disabled = true;
      btnStartText.innerText = 'Başlat';
    }
  }

  function updateStateBadge(state) {
    timerStatePill.className = `timer-state-pill ${state}`;
    if (state === 'running') {
      timerStatePill.innerHTML = `<span>● CANLI</span>`;
    } else if (state === 'paused') {
      timerStatePill.innerHTML = `<span>❚❚ DURAKLATILDI</span>`;
    } else if (state === 'finished') {
      timerStatePill.innerHTML = `<span>🔔 SÜRE DOLDU</span>`;
    } else {
      timerStatePill.innerHTML = `<span>HAZIR</span>`;
    }
  }

  function renderParticipants(list) {
    participantCountBadge.innerText = list.length;
    participantsList.innerHTML = '';

    list.forEach((p) => {
      const isYou = p.id === socket.id;
      const initial = (p.name || 'K').charAt(0).toUpperCase();

      const item = document.createElement('div');
      item.className = 'participant-item';
      item.innerHTML = `
        <div class="participant-left">
          <div class="avatar-initial">${initial}</div>
          <span class="participant-name">${escapeHtml(p.name)}</span>
          ${isYou ? '<span class="you-tag">Siz</span>' : ''}
        </div>
        <div class="online-indicator" title="Çevrimiçi"></div>
      `;
      participantsList.appendChild(item);
    });
  }

  function renderLaps(laps) {
    if (!laps || laps.length === 0) {
      emptyLapsState.style.display = 'block';
      lapsTable.style.display = 'none';
      btnCopyLaps.style.display = 'none';
      lapsTableBody.innerHTML = '';
      return;
    }

    emptyLapsState.style.display = 'none';
    lapsTable.style.display = 'table';
    btnCopyLaps.style.display = 'inline-flex';
    lapsTableBody.innerHTML = '';

    // En hızlı ve en yavaş turları bul (en az 2 tur varsa)
    let minLapTime = Infinity;
    let maxLapTime = -Infinity;

    if (laps.length >= 2) {
      laps.forEach(l => {
        if (l.lapTime < minLapTime) minLapTime = l.lapTime;
        if (l.lapTime > maxLapTime) maxLapTime = l.lapTime;
      });
    }

    // Turları tersten (en son tur en üstte) göster
    [...laps].reverse().forEach((lap) => {
      const tr = document.createElement('tr');
      if (laps.length >= 2) {
        if (lap.lapTime === minLapTime) tr.className = 'lap-best';
        else if (lap.lapTime === maxLapTime) tr.className = 'lap-worst';
      }

      const lapFormatted = TimerEngine.formatTime(lap.lapTime).fullString;
      const splitFormatted = TimerEngine.formatTime(lap.splitTime).fullString;

      tr.innerHTML = `
        <td>#${lap.id}</td>
        <td>${lapFormatted}</td>
        <td>${splitFormatted}</td>
        <td>${escapeHtml(lap.recordedBy || '-')}</td>
      `;
      lapsTableBody.appendChild(tr);
    });
  }

  function syncDurationInputs(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    if (inputHours) inputHours.value = h;
    if (inputMinutes) inputMinutes.value = m;
    if (inputSeconds) inputSeconds.value = s;

    // Preset chipleri güncelle
    presetChips.forEach(chip => {
      const chipSec = parseInt(chip.getAttribute('data-seconds'), 10);
      if (chipSec === totalSec) {
        chip.classList.add('active');
      } else {
        chip.classList.remove('active');
      }
    });
  }

  function updateLatencyDisplay() {
    const ms = Math.round(serverClock.latency || 10);
    syncLatencyText.innerText = `Senkronize (${ms}ms)`;
  }

  // 7. Kullanıcı Etkileşim Butonları (Kontroller)
  btnStart.addEventListener('click', () => {
    soundEngine.init();
    socket.emit('timer-start');
  });

  btnPause.addEventListener('click', () => {
    socket.emit('timer-pause');
  });

  btnReset.addEventListener('click', () => {
    socket.emit('timer-reset');
  });

  btnLap.addEventListener('click', () => {
    socket.emit('timer-lap');
  });

  // Mod Seçimi
  btnModeStopwatch.addEventListener('click', () => {
    if (currentRoomState && currentRoomState.mode !== 'stopwatch') {
      socket.emit('set-mode', 'stopwatch');
    }
  });

  btnModeCountdown.addEventListener('click', () => {
    if (currentRoomState && currentRoomState.mode !== 'countdown') {
      socket.emit('set-mode', 'countdown');
    }
  });

  // Geri Sayım Süresi Ayarlama
  btnApplyDuration.addEventListener('click', () => {
    const h = parseInt(inputHours.value, 10) || 0;
    const m = parseInt(inputMinutes.value, 10) || 0;
    const s = parseInt(inputSeconds.value, 10) || 0;
    const duration = (h * 3600 + m * 60 + s) * 1000;

    if (duration <= 0) {
      showToast('Lütfen geçerli bir süre girin', 'error');
      return;
    }
    socket.emit('set-countdown-duration', duration);
    showToast('Geri sayım süresi güncellendi');
  });

  presetChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const sec = parseInt(chip.getAttribute('data-seconds'), 10);
      socket.emit('set-countdown-duration', sec * 1000);
      showToast(`${chip.innerText} süresi ayarlandı`);
    });
  });

  // İsim Değiştirme
  btnSaveName.addEventListener('click', () => {
    const newName = editUserNameInput.value.trim();
    if (!newName) return;
    localStorage.setItem('synctimer_username', newName);
    userName = newName;
    socket.emit('update-name', newName);
    showToast('Adınız güncellendi');
  });

  // Linki Kopyala
  btnCopyLink.addEventListener('click', () => {
    const shareUrl = window.location.href;
    navigator.clipboard.writeText(shareUrl).then(() => {
      showToast('📋 Oda bağlantısı panoya kopyalandı!');
    }).catch(() => {
      prompt('Bağlantıyı kopyalayın:', shareUrl);
    });
  });

  // Turları Kopyala
  btnCopyLaps.addEventListener('click', () => {
    if (!currentRoomState || !currentRoomState.laps || currentRoomState.laps.length === 0) return;
    let text = `Oda ${roomId} - Tur Kayıtları:\n`;
    currentRoomState.laps.forEach(l => {
      text += `Tur #${l.id}: ${TimerEngine.formatTime(l.lapTime).fullString} (Toplam: ${TimerEngine.formatTime(l.splitTime).fullString}) - ${l.recordedBy}\n`;
    });
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Tur listesi panoya kopyalandı!');
    });
  });

  // Reaksiyonlar
  document.querySelectorAll('.btn-reaction').forEach(btn => {
    btn.addEventListener('click', () => {
      const emoji = btn.getAttribute('data-emoji');
      socket.emit('send-reaction', emoji);
      spawnFloatingEmoji(emoji);
    });
  });

  // Uçuşan Emoji Efekti
  function spawnFloatingEmoji(emoji) {
    const el = document.createElement('div');
    el.className = 'floating-emoji';
    el.innerText = emoji;

    // Rastgele x pozisyonu
    const randomX = Math.floor(Math.random() * (window.innerWidth - 100)) + 50;
    el.style.left = `${randomX}px`;
    el.style.bottom = '80px';

    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  }
});

// Yardımcı HTML Escape
function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

// Toast
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerText = message;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}
