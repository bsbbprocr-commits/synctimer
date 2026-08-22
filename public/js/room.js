/**
 * Room Controller & Real-Time Sync Logic
 * - Independent Dual Timers (Stopwatch & Countdown never interfere)
 * - Real-Time In-Room Live Chat
 * - Animated Nature Backgrounds & Seamless Crossfades
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

  // 2. Aktif Görüntülenen Mod ('stopwatch' | 'countdown')
  let activeMode = (initialModeParam === 'countdown' || initialModeParam === 'stopwatch') 
    ? initialModeParam 
    : (localStorage.getItem('synctimer_active_mode') || 'stopwatch');

  // 3. DOM Elemanları
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

  // Katılımcılar
  const participantsList = document.getElementById('participantsList');
  const participantCountBadge = document.getElementById('participantCountBadge');
  const editUserNameInput = document.getElementById('editUserNameInput');
  const btnSaveName = document.getElementById('btnSaveName');

  // Chat Elemanları
  const chatMessagesContainer = document.getElementById('chatMessagesContainer');
  const chatEmptyState = document.getElementById('chatEmptyState');
  const chatCountBadge = document.getElementById('chatCountBadge');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  // Turlar
  const emptyLapsState = document.getElementById('emptyLapsState');
  const lapsTable = document.getElementById('lapsTable');
  const lapsTableBody = document.getElementById('lapsTableBody');
  const btnCopyLaps = document.getElementById('btnCopyLaps');

  // Aktivite ve Tema
  const liveActivityMessage = document.getElementById('liveActivityMessage');
  const soundToggle = document.getElementById('soundToggle');
  const soundIconOn = document.getElementById('soundIconOn');
  const soundIconOff = document.getElementById('soundIconOff');
  const themeToggle = document.getElementById('themeToggle');
  const themeIconDark = document.getElementById('themeIconDark');
  const themeIconLight = document.getElementById('themeIconLight');

  // Arka plan seçici
  const natureBgCanvas = document.getElementById('natureBgCanvas');
  const bgPickerToggle = document.getElementById('bgPickerToggle');
  const bgPickerDropdown = document.getElementById('bgPickerDropdown');
  const btnNextBg = document.getElementById('btnNextBg');
  const bgOptionButtons = document.querySelectorAll('.bg-option-btn');

  // Geri Sayım Süre Seçicileri
  const inputHours = document.getElementById('inputHours');
  const inputMinutes = document.getElementById('inputMinutes');
  const inputSeconds = document.getElementById('inputSeconds');
  const btnApplyDuration = document.getElementById('btnApplyDuration');
  const presetChips = document.querySelectorAll('.preset-chip');

  displayRoomId.innerText = `ODA: ${roomId}`;
  if (editUserNameInput) editUserNameInput.value = userName;

  // 4. Doğa Arka Plan Motoru (NatureBackgroundEngine)
  let bgEngine = null;
  if (natureBgCanvas && window.NatureBackgroundEngine) {
    bgEngine = new NatureBackgroundEngine(natureBgCanvas);
    const savedBg = localStorage.getItem('synctimer_bg') || 'none';
    bgEngine.setScene(savedBg, false);
    updateBgOptionUI(savedBg);
  }

  function updateBgOptionUI(activeBg) {
    bgOptionButtons.forEach(btn => {
      if (btn.getAttribute('data-bg') === activeBg) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  if (bgPickerToggle && bgPickerDropdown) {
    bgPickerToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const isHidden = bgPickerDropdown.style.display === 'none';
      bgPickerDropdown.style.display = isHidden ? 'block' : 'none';
    });

    document.addEventListener('click', (e) => {
      if (!bgPickerDropdown.contains(e.target) && !bgPickerToggle.contains(e.target)) {
        bgPickerDropdown.style.display = 'none';
      }
    });

    bgOptionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const selectedBg = btn.getAttribute('data-bg');
        if (bgEngine) {
          bgEngine.setScene(selectedBg, true);
          localStorage.setItem('synctimer_bg', selectedBg);
          updateBgOptionUI(selectedBg);
          showToast(`Arkaplan: ${btn.innerText.trim()}`);
        }
      });
    });

    if (btnNextBg && bgEngine) {
      btnNextBg.addEventListener('click', (e) => {
        e.stopPropagation();
        const scenes = bgEngine.scenes;
        const currentIdx = scenes.indexOf(bgEngine.currentScene);
        const nextScene = scenes[(currentIdx + 1) % scenes.length];
        bgEngine.setScene(nextScene, true);
        localStorage.setItem('synctimer_bg', nextScene);
        updateBgOptionUI(nextScene);
        showToast(`Doğa Geçişi: ${nextScene.toUpperCase()}`);
      });
    }
  }

  // 5. Ses ve Tema Başlatma
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

  // 6. Socket.io ve Bağımsız TimerEngine Kurulumu
  const BACKEND_URL = window.SOCKET_SERVER_URL || undefined;

  const socket = io(BACKEND_URL, {
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000
  });

  const serverClock = new ServerClock(socket);
  let currentRoomState = null;
  let hasAlarmFired = false;
  let totalChatCount = 0;

  const timerEngine = new TimerEngine(
    serverClock,
    // onTick callback (her animasyon karesinde)
    (tickData) => {
      displayMain.innerText = `${tickData.formatted.hours}:${tickData.formatted.minutes}:${tickData.formatted.seconds}`;
      displayHundredths.innerText = `.${tickData.formatted.hundredths}`;

      if (tickData.activeMode === 'countdown') {
        countdownProgressFill.style.width = `${Math.max(0, Math.min(100, tickData.percent))}%`;
      }
    },
    // onFinish callback (Geri sayım bittiğinde)
    () => {
      if (!hasAlarmFired) {
        hasAlarmFired = true;
        socket.emit('timer-finished');
        soundEngine.playAlarm();
        if (activeMode === 'countdown') {
          updateStateBadge('finished');
          updateControlsUI('finished');
        }
      }
    }
  );

  timerEngine.setActiveMode(activeMode);

  // 7. Socket Olayları ve Bağlantı Yönetimi
  socket.on('connect', () => {
    statusDot.classList.remove('offline');
    syncLatencyText.innerText = 'Senkronize ediliyor...';
    serverClock.sync();

    // Odaya katıl
    socket.emit('join-room', { roomId, userName }, (response) => {
      if (response && response.success) {
        currentRoomState = response.roomState;
        renderEntireState(currentRoomState);
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

  // Zamanlayıcı durum değişimi (Start / Pause / Reset) - Bağımsız Mod
  socket.on('timer-state-change', (data) => {
    if (!currentRoomState) return;

    const mode = data.mode || 'stopwatch';
    if (mode === 'stopwatch') {
      currentRoomState.stopwatch = {
        state: data.state,
        startTimestamp: data.startTimestamp,
        elapsedBeforePause: data.elapsedBeforePause,
        laps: data.laps !== undefined ? data.laps : currentRoomState.stopwatch.laps
      };
      timerEngine.updateStopwatch(currentRoomState.stopwatch);
      if (data.laps !== undefined) {
        renderLaps(currentRoomState.stopwatch.laps);
      }
    } else {
      currentRoomState.countdown = {
        state: data.state,
        startTimestamp: data.startTimestamp,
        elapsedBeforePause: data.elapsedBeforePause,
        duration: data.duration !== undefined ? data.duration : currentRoomState.countdown.duration
      };
      timerEngine.updateCountdown(currentRoomState.countdown);
    }

    // Eğer aktif görüntülenen mod değiştiyse kontrolleri tazele
    if (mode === activeMode) {
      updateControlsUI(data.state);
      updateStateBadge(data.state);
    }

    if (data.action === 'start') {
      soundEngine.playStart();
      if (mode === 'countdown') hasAlarmFired = false;
    } else if (data.action === 'pause') {
      soundEngine.playPause();
    } else if (data.action === 'reset') {
      soundEngine.playReset();
      if (mode === 'countdown') hasAlarmFired = false;
    }
  });

  // Lap kaydedildiğinde (Sadece Kronometre)
  socket.on('lap-recorded', (data) => {
    if (!currentRoomState) return;
    currentRoomState.stopwatch.laps = data.laps;
    renderLaps(data.laps);
    soundEngine.playLap();
    showToast(`Tur #${data.lap.id} kaydedildi: ${TimerEngine.formatTime(data.lap.lapTime).shortString}`);
  });

  // Geri Sayım Süresi Değiştiğinde
  socket.on('countdown-duration-changed', (data) => {
    if (!currentRoomState) return;
    currentRoomState.countdown.duration = data.duration;
    currentRoomState.countdown.state = data.state;
    currentRoomState.countdown.elapsedBeforePause = data.elapsedBeforePause;
    currentRoomState.countdown.startTimestamp = null;

    timerEngine.updateCountdown(currentRoomState.countdown);
    syncDurationInputs(data.duration);

    if (activeMode === 'countdown') {
      updateControlsUI(data.state);
      updateStateBadge(data.state);
    }
    hasAlarmFired = false;
  });

  // Geri sayım bittiğinde (Alarm)
  socket.on('timer-alarm', (data) => {
    if (currentRoomState && currentRoomState.countdown) {
      currentRoomState.countdown.state = 'finished';
    }
    timerEngine.updateCountdown({ state: 'finished' });
    if (activeMode === 'countdown') {
      updateControlsUI('finished');
      updateStateBadge('finished');
    }
    soundEngine.playAlarm();
    showToast('⏰ SÜRE DOLDU!', 'error');
  });

  // Canlı Chat Mesajı Alındığında
  socket.on('new-chat-message', (msg) => {
    appendChatMessage(msg, true);
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

  // 8. UI Render Fonksiyonları
  function renderEntireState(state) {
    if (!state) return;

    if (state.stopwatch) timerEngine.updateStopwatch(state.stopwatch);
    if (state.countdown) timerEngine.updateCountdown(state.countdown);

    applyModeUI(activeMode);

    if (state.countdown) {
      syncDurationInputs(state.countdown.duration);
    }

    const currentModeState = activeMode === 'stopwatch' 
      ? (state.stopwatch ? state.stopwatch.state : 'idle')
      : (state.countdown ? state.countdown.state : 'idle');

    updateControlsUI(currentModeState);
    updateStateBadge(currentModeState);

    renderParticipants(state.participants || []);
    renderLaps(state.stopwatch ? state.stopwatch.laps : []);
    renderAllChatMessages(state.messages || []);
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

    if (currentRoomState) {
      const curState = mode === 'stopwatch'
        ? (currentRoomState.stopwatch ? currentRoomState.stopwatch.state : 'idle')
        : (currentRoomState.countdown ? currentRoomState.countdown.state : 'idle');
      updateControlsUI(curState);
      updateStateBadge(curState);
    }
  }

  function updateControlsUI(state) {
    if (state === 'running') {
      btnStart.disabled = true;
      btnPause.disabled = false;
      btnReset.disabled = false;
      btnLap.disabled = activeMode !== 'stopwatch';
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
    const modeName = activeMode === 'stopwatch' ? 'KRONOMETRE' : 'GERİ SAYIM';

    if (state === 'running') {
      timerStatePill.innerHTML = `<span>● ${modeName} CANLI</span>`;
    } else if (state === 'paused') {
      timerStatePill.innerHTML = `<span>❚❚ ${modeName} DURAKLATILDI</span>`;
    } else if (state === 'finished') {
      timerStatePill.innerHTML = `<span>🔔 SÜRE DOLDU</span>`;
    } else {
      timerStatePill.innerHTML = `<span>${modeName} HAZIR</span>`;
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

    let minLapTime = Infinity;
    let maxLapTime = -Infinity;

    if (laps.length >= 2) {
      laps.forEach(l => {
        if (l.lapTime < minLapTime) minLapTime = l.lapTime;
        if (l.lapTime > maxLapTime) maxLapTime = l.lapTime;
      });
    }

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

  // Chat Render Fonksiyonları
  function renderAllChatMessages(messages) {
    chatMessagesContainer.innerHTML = '';
    totalChatCount = messages.length;
    chatCountBadge.innerText = `${totalChatCount} mesaj`;

    if (!messages || messages.length === 0) {
      chatEmptyState.style.display = 'block';
      return;
    }
    chatEmptyState.style.display = 'none';

    messages.forEach(msg => {
      appendChatMessage(msg, false);
    });

    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
  }

  function appendChatMessage(msg, playSound = true) {
    if (chatEmptyState) chatEmptyState.style.display = 'none';

    const isSelf = msg.senderId === socket.id;
    const msgEl = document.createElement('div');
    msgEl.className = `chat-msg-item ${isSelf ? 'self' : 'other'}`;

    const date = new Date(msg.timestamp || Date.now());
    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    msgEl.innerHTML = `
      <div class="chat-msg-meta">
        ${!isSelf ? `<span class="chat-msg-sender">${escapeHtml(msg.senderName)}</span>` : ''}
        <span class="chat-msg-time">${timeStr}</span>
      </div>
      <div class="chat-msg-bubble">${escapeHtml(msg.text)}</div>
    `;

    chatMessagesContainer.appendChild(msgEl);
    chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;

    totalChatCount++;
    chatCountBadge.innerText = `${totalChatCount} mesaj`;

    if (playSound && !isSelf) {
      soundEngine.playMessage();
    }
  }

  function syncDurationInputs(ms) {
    const totalSec = Math.floor((ms || 300000) / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;

    if (inputHours) inputHours.value = h;
    if (inputMinutes) inputMinutes.value = m;
    if (inputSeconds) inputSeconds.value = s;

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

  // 9. Kullanıcı Etkileşim Butonları (Kontroller)
  btnStart.addEventListener('click', () => {
    soundEngine.init();
    socket.emit('timer-start', { mode: activeMode });
  });

  btnPause.addEventListener('click', () => {
    socket.emit('timer-pause', { mode: activeMode });
  });

  btnReset.addEventListener('click', () => {
    socket.emit('timer-reset', { mode: activeMode });
  });

  btnLap.addEventListener('click', () => {
    if (activeMode === 'stopwatch') {
      socket.emit('timer-lap');
    }
  });

  // Mod Seçimi (Kronometre <-> Geri Sayım Bağımsız Geçiş)
  btnModeStopwatch.addEventListener('click', () => {
    if (activeMode !== 'stopwatch') {
      activeMode = 'stopwatch';
      localStorage.setItem('synctimer_active_mode', activeMode);
      timerEngine.setActiveMode(activeMode);
      applyModeUI(activeMode);
      showToast('Görünüm: Kronometre');
    }
  });

  btnModeCountdown.addEventListener('click', () => {
    if (activeMode !== 'countdown') {
      activeMode = 'countdown';
      localStorage.setItem('synctimer_active_mode', activeMode);
      timerEngine.setActiveMode(activeMode);
      applyModeUI(activeMode);
      showToast('Görünüm: Geri Sayım');
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

  // Chat Form Gönderme
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;

      socket.emit('send-chat-message', text);
      chatInput.value = '';
      chatInput.focus();
    });
  }

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
    if (!currentRoomState || !currentRoomState.stopwatch || !currentRoomState.stopwatch.laps || currentRoomState.stopwatch.laps.length === 0) return;
    let text = `Oda ${roomId} - Tur Kayıtları:\n`;
    currentRoomState.stopwatch.laps.forEach(l => {
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
