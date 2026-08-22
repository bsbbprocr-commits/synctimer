/**
 * Room Data Export Manager
 * Generates and downloads comprehensive room archives including Chat, Timer logs, Laps and Notes.
 */

class RoomExportManager {
  static exportRoomData(roomState, timerEngine, notesManager, format = 'markdown') {
    if (!roomState) return;

    const roomId = roomState.id || 'ODA';
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR');
    const timeStr = now.toLocaleTimeString('tr-TR');

    // 1. Sayaç Süreleri
    const swElapsedMs = timerEngine ? timerEngine.getStopwatchElapsed() : 0;
    const cdElapsedMs = timerEngine ? timerEngine.getCountdownElapsed() : 0;
    const cdDurationMs = (roomState.countdown && roomState.countdown.duration) || 300000;
    const cdRemainingMs = Math.max(0, cdDurationMs - cdElapsedMs);

    const swFormatted = window.TimerEngine ? window.TimerEngine.formatTime(swElapsedMs).fullString : `${swElapsedMs}ms`;
    const cdFormatted = window.TimerEngine ? window.TimerEngine.formatTime(cdRemainingMs).fullString : `${cdRemainingMs}ms`;
    const cdDurationFormatted = window.TimerEngine ? window.TimerEngine.formatTime(cdDurationMs).fullString : `${cdDurationMs}ms`;

    // 2. Katılımcılar
    const participants = (roomState.participants || []).map(p => p.name).join(', ') || 'Yok';

    // 3. Turlar
    const laps = (roomState.stopwatch && roomState.stopwatch.laps) || [];

    // 4. Chat Mesajları
    const messages = roomState.messages || [];

    // 5. Notlar ve Görevler
    const sharedNotes = notesManager ? notesManager.sharedData : (roomState.sharedNotes || { text: '', todos: [] });
    const personalNotes = notesManager ? notesManager.personalData : { text: '', todos: [] };

    let fileContent = '';
    let fileName = `SyncTimer_Oda_${roomId}_${now.toISOString().slice(0, 10)}.md`;
    let mimeType = 'text/markdown;charset=utf-8';

    if (format === 'json') {
      fileName = `SyncTimer_Oda_${roomId}_${now.toISOString().slice(0, 10)}.json`;
      mimeType = 'application/json;charset=utf-8';
      const jsonData = {
        roomId,
        exportDate: now.toISOString(),
        participants: roomState.participants || [],
        timers: {
          stopwatch: {
            state: roomState.stopwatch ? roomState.stopwatch.state : 'idle',
            elapsedMs: swElapsedMs,
            formatted: swFormatted,
            laps
          },
          countdown: {
            state: roomState.countdown ? roomState.countdown.state : 'idle',
            durationMs: cdDurationMs,
            remainingMs: cdRemainingMs,
            formatted: cdFormatted
          }
        },
        chatHistory: messages,
        sharedNotes,
        personalNotes
      };
      fileContent = JSON.stringify(jsonData, null, 2);
    } else {
      // Markdown / Text Raporu
      fileContent = `# ⏱️ SyncTimer Oda Raporu & Arşivi\n\n`;
      fileContent += `> **Oda Kodu:** \`${roomId}\`  \n`;
      fileContent += `> **Oluşturulma / Rapor Tarihi:** ${dateStr} - ${timeStr}  \n`;
      fileContent += `> **Katılımcılar:** ${participants}\n\n`;
      fileContent += `---\n\n`;

      // Sayaç Bölümü
      fileContent += `## 🕒 1. Sayaç ve Zaman Kayıtları\n\n`;
      fileContent += `- **Kronometre Durumu:** ${roomState.stopwatch ? roomState.stopwatch.state.toUpperCase() : 'IDLE'}\n`;
      fileContent += `- **Kronometre Geçen Süre:** \`${swFormatted}\`\n`;
      fileContent += `- **Geri Sayım Durumu:** ${roomState.countdown ? roomState.countdown.state.toUpperCase() : 'IDLE'}\n`;
      fileContent += `- **Geri Sayım Kalan Süre:** \`${cdFormatted}\` (Toplam Ayarlanan: \`${cdDurationFormatted}\`)\n\n`;

      // Turlar Tablosu
      fileContent += `### 🏁 Tur / Lap Kayıtları (${laps.length} Tur)\n\n`;
      if (laps.length === 0) {
        fileContent += `*Kayıtlı tur bulunmuyor.*\n\n`;
      } else {
        fileContent += `| Tur # | Tur Süresi | Toplam Süre | Kaydeden |\n`;
        fileContent += `| :--- | :--- | :--- | :--- |\n`;
        laps.forEach(l => {
          const lTime = window.TimerEngine ? window.TimerEngine.formatTime(l.lapTime).fullString : `${l.lapTime}ms`;
          const sTime = window.TimerEngine ? window.TimerEngine.formatTime(l.splitTime).fullString : `${l.splitTime}ms`;
          fileContent += `| #${l.id} | \`${lTime}\` | \`${sTime}\` | ${l.recordedBy} |\n`;
        });
        fileContent += `\n`;
      }

      fileContent += `---\n\n`;

      // Sohbet Geçmişi
      fileContent += `## 💬 2. Canlı Sohbet (Chat) Geçmişi (${messages.length} Mesaj)\n\n`;
      if (messages.length === 0) {
        fileContent += `*Sohbet geçmişi bulunmuyor.*\n\n`;
      } else {
        messages.forEach(m => {
          const msgTime = new Date(m.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          fileContent += `- **[${msgTime}] ${m.senderName}:** ${m.text}\n`;
        });
        fileContent += `\n`;
      }

      fileContent += `---\n\n`;

      // Ortak Notlar ve Görevler
      fileContent += `## 👥 3. Ortak Notlar ve Görevler\n\n`;
      if (sharedNotes.text && sharedNotes.text.trim()) {
        fileContent += `### Ortak Not Defteri:\n\`\`\`\n${sharedNotes.text.trim()}\n\`\`\`\n\n`;
      }
      fileContent += `### Ortak Yapılacaklar (To-Do):\n`;
      if (!sharedNotes.todos || sharedNotes.todos.length === 0) {
        fileContent += `*Görev listesi boş.*\n\n`;
      } else {
        sharedNotes.todos.forEach(t => {
          fileContent += `- [${t.completed ? 'x' : ' '}] ${t.text} *(Ekleyen: ${t.createdBy || 'Misafir'})*\n`;
        });
        fileContent += `\n`;
      }

      fileContent += `---\n\n`;

      // Kişisel Notlar ve Görevler
      fileContent += `## 👤 4. Kişisel Notlarım & Görevlerim\n\n`;
      if (personalNotes.text && personalNotes.text.trim()) {
        fileContent += `### Kişisel Not Defteri:\n\`\`\`\n${personalNotes.text.trim()}\n\`\`\`\n\n`;
      }
      fileContent += `### Kişisel Yapılacaklar (To-Do):\n`;
      if (!personalNotes.todos || personalNotes.todos.length === 0) {
        fileContent += `*Kişisel görev listesi boş.*\n\n`;
      } else {
        personalNotes.todos.forEach(t => {
          fileContent += `- [${t.completed ? 'x' : ' '}] ${t.text}\n`;
        });
        fileContent += `\n`;
      }
    }

    // Dosyayı İndir
    RoomExportManager.downloadFile(fileContent, fileName, mimeType);
    if (window.showToast) {
      window.showToast(`📥 ${fileName} başarıyla indirildi!`);
    }
  }

  static downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);
  }
}

// Global olarak sun
window.RoomExportManager = RoomExportManager;
