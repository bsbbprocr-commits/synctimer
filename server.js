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
/**
 * Yeni bir oda nesnesi başlatır - Kronometre ve Geri Sayım tamamen bağımsız çalışır
 */
function createNewRoom(id, roomName = '') {
  return {
    id,
    name: roomName || `Oda ${id}`,
    stopwatch: {
      state: 'idle', // 'idle' | 'running' | 'paused'
      startTimestamp: null,
      elapsedBeforePause: 0,
      laps: []
    },
    countdown: {
      state: 'idle', // 'idle' | 'running' | 'paused' | 'finished'
      startTimestamp: null,
      elapsedBeforePause: 0,
      duration: 300000 // 5 dakika varsayılan (ms)
    },
    messages: [], // [{ id, senderId, senderName, text, timestamp }]
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
    stopwatch: room.stopwatch,
    countdown: room.countdown,
    messages: room.messages.slice(-60), // Son 60 mesaj
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
  socket.on('create-room', ({ roomName, userName }, callback) => {
    let roomId = generateRoomId();
    while (rooms.has(roomId)) {
      roomId = generateRoomId();
    }

    const room = createNewRoom(roomId, roomName);
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

  // 4. Zamanlayıcı Başlat / Devam Et (Start / Resume) - Bağımsız Mod
  socket.on('timer-start', (payload) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const mode = (payload && payload.mode) === 'countdown' ? 'countdown' : 'stopwatch';
    const targetTimer = room[mode];
    if (!targetTimer) return;

    if (targetTimer.state !== 'running') {
      targetTimer.state = 'running';
      targetTimer.startTimestamp = Date.now();
      room.lastActivity = Date.now();

      const user = room.participants.get(socket.id);
      const userName = user ? user.name : 'Bir kullanıcı';
      const modeLabel = mode === 'countdown' ? 'Geri Sayımı' : 'Kronometreyi';

      io.to(currentRoomId).emit('timer-state-change', {
        mode,
        state: targetTimer.state,
        startTimestamp: targetTimer.startTimestamp,
        elapsedBeforePause: targetTimer.elapsedBeforePause,
        duration: targetTimer.duration,
        serverTime: Date.now(),
        action: 'start',
        by: userName
      });
      io.to(currentRoomId).emit('system-message', { text: `${userName} ${modeLabel} başlattı.`, type: 'action' });
    }
  });

  // 5. Zamanlayıcı Duraklat (Pause) - Bağımsız Mod
  socket.on('timer-pause', (payload) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const mode = (payload && payload.mode) === 'countdown' ? 'countdown' : 'stopwatch';
    const targetTimer = room[mode];
    if (!targetTimer) return;

    if (targetTimer.state === 'running') {
      const now = Date.now();
      targetTimer.elapsedBeforePause += (now - targetTimer.startTimestamp);
      targetTimer.startTimestamp = null;
      targetTimer.state = 'paused';
      room.lastActivity = now;

      const user = room.participants.get(socket.id);
      const userName = user ? user.name : 'Bir kullanıcı';
      const modeLabel = mode === 'countdown' ? 'Geri Sayımı' : 'Kronometreyi';

      io.to(currentRoomId).emit('timer-state-change', {
        mode,
        state: targetTimer.state,
        startTimestamp: null,
        elapsedBeforePause: targetTimer.elapsedBeforePause,
        duration: targetTimer.duration,
        serverTime: now,
        action: 'pause',
        by: userName
      });
      io.to(currentRoomId).emit('system-message', { text: `${userName} ${modeLabel} duraklattı.`, type: 'action' });
    }
  });

  // 6. Zamanlayıcı Sıfırla (Reset) - Bağımsız Mod
  socket.on('timer-reset', (payload) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const mode = (payload && payload.mode) === 'countdown' ? 'countdown' : 'stopwatch';
    const targetTimer = room[mode];
    if (!targetTimer) return;

    targetTimer.state = 'idle';
    targetTimer.startTimestamp = null;
    targetTimer.elapsedBeforePause = 0;
    if (mode === 'stopwatch') {
      targetTimer.laps = [];
    }
    room.lastActivity = Date.now();

    const user = room.participants.get(socket.id);
    const userName = user ? user.name : 'Bir kullanıcı';
    const modeLabel = mode === 'countdown' ? 'Geri Sayımı' : 'Kronometreyi';

    io.to(currentRoomId).emit('timer-state-change', {
      mode,
      state: targetTimer.state,
      startTimestamp: null,
      elapsedBeforePause: 0,
      duration: targetTimer.duration,
      laps: mode === 'stopwatch' ? [] : undefined,
      serverTime: Date.now(),
      action: 'reset',
      by: userName
    });
    io.to(currentRoomId).emit('system-message', { text: `${userName} ${modeLabel} sıfırladı.`, type: 'action' });
  });

  // 7. Lap / Tur Zamanı Kaydı (Sadece Kronometre)
  socket.on('timer-lap', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room || room.stopwatch.state === 'idle') return;

    const now = Date.now();
    let currentTotalElapsed = room.stopwatch.elapsedBeforePause;
    if (room.stopwatch.state === 'running' && room.stopwatch.startTimestamp) {
      currentTotalElapsed += (now - room.stopwatch.startTimestamp);
    }

    const previousSplitTotal = room.stopwatch.laps.length > 0 
      ? room.stopwatch.laps[room.stopwatch.laps.length - 1].splitTime 
      : 0;
    
    const lapDuration = Math.max(0, currentTotalElapsed - previousSplitTotal);

    const user = room.participants.get(socket.id);
    const userName = user ? user.name : 'Bir kullanıcı';

    const newLap = {
      id: room.stopwatch.laps.length + 1,
      lapTime: lapDuration,
      splitTime: currentTotalElapsed,
      recordedBy: userName,
      timestamp: now
    };

    room.stopwatch.laps.push(newLap);
    room.lastActivity = now;

    io.to(currentRoomId).emit('lap-recorded', {
      lap: newLap,
      laps: room.stopwatch.laps
    });
    io.to(currentRoomId).emit('system-message', { 
      text: `${userName} Tur #${newLap.id} kaydetti.`, 
      type: 'lap' 
    });
  });

  // 8. Geri Sayım Süresini Ayarla (Countdown duration)
  socket.on('set-countdown-duration', (durationMs) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const duration = Math.max(1000, Math.min(86400000, Number(durationMs) || 60000));
    room.countdown.duration = duration;
    room.countdown.state = 'idle';
    room.countdown.startTimestamp = null;
    room.countdown.elapsedBeforePause = 0;
    room.lastActivity = Date.now();

    const user = room.participants.get(socket.id);
    const userName = user ? user.name : 'Bir kullanıcı';

    io.to(currentRoomId).emit('countdown-duration-changed', {
      duration: room.countdown.duration,
      state: room.countdown.state,
      elapsedBeforePause: 0,
      by: userName
    });
  });

  // 9. Geri Sayım Bittiğinde (Finished Alarm)
  socket.on('timer-finished', () => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    if (room.countdown.state === 'running') {
      const now = Date.now();
      room.countdown.state = 'finished';
      if (room.countdown.startTimestamp) {
        room.countdown.elapsedBeforePause += (now - room.countdown.startTimestamp);
      }
      room.countdown.startTimestamp = null;
      room.lastActivity = now;

      io.to(currentRoomId).emit('timer-alarm', {
        mode: 'countdown',
        state: 'finished',
        message: 'Süre doldu!'
      });
    }
  });

  // 10. Canlı Sohbet Mesajı (Real-time Chat)
  socket.on('send-chat-message', (text) => {
    if (!currentRoomId) return;
    const room = rooms.get(currentRoomId);
    if (!room) return;

    const trimmedText = (text || '').trim();
    if (!trimmedText) return;

    const user = room.participants.get(socket.id);
    const userName = user ? user.name : 'Misafir';

    const messageObj = {
      id: Math.random().toString(36).substring(2, 9) + Date.now().toString(36),
      senderId: socket.id,
      senderName: userName,
      text: trimmedText.slice(0, 500), // Max 500 karakter
      timestamp: Date.now()
    };

    room.messages.push(messageObj);
    if (room.messages.length > 100) {
      room.messages.shift();
    }
    room.lastActivity = Date.now();

    io.to(currentRoomId).emit('new-chat-message', messageObj);
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
