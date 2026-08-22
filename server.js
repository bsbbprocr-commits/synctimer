const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Statik dosyaları sun
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Bellekte oda yönetimi (In-memory Room Storage)
const rooms = new Map();

/**
 * Benzersiz 6 karakterli büyük harf/sayı oda kodu üretir (Örn: "SYN-842")
 */
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `${result.slice(0, 3)}-${result.slice(3)}`;
}

/**
 * Yeni bir oda nesnesi başlatır
 */
function createNewRoom(id, roomName = '', initialMode = 'stopwatch', countdownDuration = 300000) {
  return {
    id,
    name: roomName || `Oda ${id}`,
    mode: initialMode, // 'stopwatch' | 'countdown'
    state: 'idle',     // 'idle' | 'running' | 'paused' | 'finished'
    startTimestamp: null, // Zamanlayıcının başlatıldığı sunucu zamanı (ms)
    elapsedBeforePause: 0, // Duraklatılmadan önce toplam geçen süre (ms)
    countdownDuration: Number(countdownDuration) || 300000, // Varsayılan 5 dk (ms)
    laps: [], // [{ id, lapTime, splitTime, recordedBy, timestamp }]
    participants: new Map(), // socketId -> { id, name, joinedAt }
    createdAt: Date.now(),
    lastActivity: Date.now()
  };
}

/**
 * İstemciye gönderilmeye hazır oda durumunu serialize eder
 */
function getRoomPublicState(room) {
  const participantsList = Array.from(room.participants.values());
  return {
    id: room.id,
    name: room.name,
    mode: room.mode,
    state: room.state,
    startTimestamp: room.startTimestamp,
    elapsedBeforePause: room.elapsedBeforePause,
    countdownDuration: room.countdownDuration,
    laps: room.laps,
    participants: participantsList,
    serverTime: Date.now()
  };
}

// REST API Endpoints
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now(), activeRooms: rooms.size });
});

// Oda var mı kontrolü
app.get('/api/rooms/:id', (req, res) => {
  const roomId = req.params.id.toUpperCase();
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Oda bulunamadı' });
  }
  res.json({
    id: room.id,
    name: room.name,
    participantCount: room.participants.size,
    mode: room.mode,
    state: room.state
  });
});

// Socket.io Gerçek Zamanlı Bağlantılar
io.on('connection', (socket) => {
  let currentRoomId = null;

  // 1. Saat Senkronizasyonu (NTP tarzı drift hesabı)
  socket.on('sync-time', (clientSendTime) => {
    socket.emit('sync-time-response', {
      clientSendTime,
      serverTime: Date.now()
    });
  });

  // 2. Oda Oluşturma
  socket.on('create-room', ({ roomName, userName, mode, countdownDuration }, callback) => {
    let roomId = generateRoomId();
    while (rooms.has(roomId)) {
      roomId = generateRoomId();
    }

    const room = createNewRoom(roomId, roomName, mode, countdownDuration);
    rooms.set(roomId, room);

    currentRoomId = roomId;
    socket.join(roomId);

    const user = {
      id: socket.id,
      name: (userName && userName.trim()) || `Kullanıcı-${socket.id.slice(0, 4)}`,
      joinedAt: Date.now()
    };
    room.participants.set(socket.id, user);

    const state = getRoomPublicState(room);

    if (typeof callback === 'function') {
      callback({ success: true, roomId, roomState: state });
    }

    io.to(roomId).emit('room-state-updated', state);
    io.to(roomId).emit('system-message', { text: `${user.name} odayı oluşturdu.`, type: 'info' });
  });

  // 3. Odaya Katılma
  socket.on('join-room', ({ roomId, userName }, callback) => {
    const cleanRoomId = (roomId || '').trim().toUpperCase();
    let room = rooms.get(cleanRoomId);

    // Eğer oda yoksa otomatik oluşturalım (Link ile direkt gelenler için pratik)
    if (!room) {
      room = createNewRoom(cleanRoomId, `Oda ${cleanRoomId}`);
      rooms.set(cleanRoomId, room);
    }

    currentRoomId = cleanRoomId;
    socket.join(cleanRoomId);

    const user = {
      id: socket.id,
      name: (userName && userName.trim()) || `Kullanıcı-${socket.id.slice(0, 4)}`,
      joinedAt: Date.now()
    };
    room.participants.set(socket.id, user);
    room.lastActivity = Date.now();

    const publicState = getRoomPublicState(room);

    if (typeof callback === 'function') {
      callback({ success: true, roomState: publicState });
    }

    socket.emit('room-state-updated', publicState);
    socket.to(cleanRoomId).emit('participant-joined', {
      user,
      participants: Array.from(room.participants.values())
    });
    socket.to(cleanRoomId).emit('system-message', { text: `${user.name} odaya katıldı.`, type: 'info' });
  });

  // 4. Zamanlayıcı Başlat / Devam Et (Start / Resume)
  socket.on('timer-start', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (room.state !== 'running') {
      room.state = 'running';
      room.startTimestamp = Date.now();
      room.lastActivity = Date.now();

      const user = room.participants.get(socket.id);
      const userName = user ? user.name : 'Bir kullanıcı';

      io.to(currentRoomId).emit('timer-state-change', {
        state: room.state,
        startTimestamp: room.startTimestamp,
        elapsedBeforePause: room.elapsedBeforePause,
        serverTime: Date.now(),
        action: 'start',
        by: userName
      });
      io.to(currentRoomId).emit('system-message', { text: `${userName} başlattı.`, type: 'action' });
    }
  });

  // 5. Zamanlayıcı Duraklat (Pause)
  socket.on('timer-pause', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (room.state === 'running') {
      const now = Date.now();
      room.elapsedBeforePause += (now - room.startTimestamp);
      room.startTimestamp = null;
      room.state = 'paused';
      room.lastActivity = now;

      const user = room.participants.get(socket.id);
      const userName = user ? user.name : 'Bir kullanıcı';

      io.to(currentRoomId).emit('timer-state-change', {
        state: room.state,
        startTimestamp: null,
        elapsedBeforePause: room.elapsedBeforePause,
        serverTime: now,
        action: 'pause',
        by: userName
      });
      io.to(currentRoomId).emit('system-message', { text: `${userName} duraklattı.`, type: 'action' });
    }
  });

  // 6. Zamanlayıcı Sıfırla (Reset)
  socket.on('timer-reset', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    room.state = 'idle';
    room.startTimestamp = null;
    room.elapsedBeforePause = 0;
    room.laps = [];
    room.lastActivity = Date.now();

    const user = room.participants.get(socket.id);
    const userName = user ? user.name : 'Bir kullanıcı';

    io.to(currentRoomId).emit('timer-state-change', {
      state: room.state,
      startTimestamp: null,
      elapsedBeforePause: 0,
      laps: [],
      serverTime: Date.now(),
      action: 'reset',
      by: userName
    });
    io.to(currentRoomId).emit('system-message', { text: `${userName} sıfırladı.`, type: 'action' });
  });

  // 7. Lap / Tur Zamanı Kaydı
  socket.on('timer-lap', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.state === 'idle') return;

    const now = Date.now();
    let currentTotalElapsed = room.elapsedBeforePause;
    if (room.state === 'running' && room.startTimestamp) {
      currentTotalElapsed += (now - room.startTimestamp);
    }

    const previousSplitTotal = room.laps.length > 0 
      ? room.laps[room.laps.length - 1].splitTime 
      : 0;
    
    const lapDuration = Math.max(0, currentTotalElapsed - previousSplitTotal);

    const user = room.participants.get(socket.id);
    const userName = user ? user.name : 'Bir kullanıcı';

    const newLap = {
      id: room.laps.length + 1,
      lapTime: lapDuration,
      splitTime: currentTotalElapsed,
      recordedBy: userName,
      timestamp: now
    };

    room.laps.push(newLap);
    room.lastActivity = now;

    io.to(currentRoomId).emit('lap-recorded', {
      lap: newLap,
      laps: room.laps
    });
    io.to(currentRoomId).emit('system-message', { 
      text: `${userName} Tur #${newLap.id} kaydetti.`, 
      type: 'lap' 
    });
  });

  // 8. Mod Değiştir (Stopwatch <-> Countdown)
  socket.on('set-mode', (newMode) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;
    if (newMode !== 'stopwatch' && newMode !== 'countdown') return;

    room.mode = newMode;
    room.state = 'idle';
    room.startTimestamp = null;
    room.elapsedBeforePause = 0;
    room.laps = [];
    room.lastActivity = Date.now();

    const user = room.participants.get(socket.id);
    const userName = user ? user.name : 'Bir kullanıcı';

    io.to(currentRoomId).emit('room-mode-changed', {
      mode: room.mode,
      state: room.state,
      elapsedBeforePause: 0,
      countdownDuration: room.countdownDuration,
      laps: [],
      by: userName
    });
    io.to(currentRoomId).emit('system-message', { 
      text: `${userName} modu "${newMode === 'stopwatch' ? 'Kronometre' : 'Geri Sayım'}" yaptı.`, 
      type: 'mode' 
    });
  });

  // 9. Geri Sayım Süresini Ayarla
  socket.on('set-countdown-duration', (durationMs) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const duration = Math.max(1000, Math.min(86400000, Number(durationMs) || 60000));
    room.countdownDuration = duration;
    room.state = 'idle';
    room.startTimestamp = null;
    room.elapsedBeforePause = 0;
    room.lastActivity = Date.now();

    const user = room.participants.get(socket.id);
    const userName = user ? user.name : 'Bir kullanıcı';

    io.to(currentRoomId).emit('countdown-duration-changed', {
      countdownDuration: room.countdownDuration,
      state: room.state,
      elapsedBeforePause: 0,
      by: userName
    });
  });

  // 10. Geri Sayım Bittiğinde (Finished Alarm)
  socket.on('timer-finished', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.mode !== 'countdown') return;

    if (room.state === 'running') {
      room.state = 'finished';
      room.startTimestamp = null;
      room.elapsedBeforePause = room.countdownDuration;
      room.lastActivity = Date.now();

      io.to(currentRoomId).emit('timer-alarm', {
        state: 'finished',
        message: 'Süre doldu!'
      });
    }
  });

  // 11. Hızlı Reaksiyon / Emoji
  socket.on('send-reaction', (emoji) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const user = room.participants.get(socket.id);
    const userName = user ? user.name : 'Birisi';

    io.to(currentRoomId).emit('room-reaction', {
      emoji,
      from: userName,
      id: Math.random().toString(36).substring(2, 9)
    });
  });

  // 12. İsim Güncelleme
  socket.on('update-name', (newName) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const user = room.participants.get(socket.id);
    if (user && newName && newName.trim()) {
      const oldName = user.name;
      user.name = newName.trim();
      io.to(currentRoomId).emit('participant-updated', {
        user,
        participants: Array.from(room.participants.values())
      });
      io.to(currentRoomId).emit('system-message', {
        text: `${oldName} adını "${user.name}" olarak değiştirdi.`,
        type: 'info'
      });
    }
  });

  // 13. Bağlantı Koptuğunda
  socket.on('disconnect', () => {
    if (currentRoomId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        const user = room.participants.get(socket.id);
        room.participants.delete(socket.id);

        if (user) {
          socket.to(currentRoomId).emit('participant-left', {
            userId: socket.id,
            userName: user.name,
            participants: Array.from(room.participants.values())
          });
          socket.to(currentRoomId).emit('system-message', {
            text: `${user.name} odadan ayrıldı.`,
            type: 'info'
          });
        }

        if (room.participants.size === 0) {
          setTimeout(() => {
            const r = rooms.get(currentRoomId);
            if (r && r.participants.size === 0) {
              rooms.delete(currentRoomId);
            }
          }, 30 * 60 * 1000);
        }
      }
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Eş Zamanlı Kronometre Sunucusu çalışıyor: http://localhost:${PORT}`);
});
