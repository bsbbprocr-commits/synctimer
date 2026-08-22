/**
 * Room Data Export Manager
 * Generates and downloads comprehensive room archives including Chat, Timer logs, Laps and Notes.
 */

class RoomExportManager {
  // Milisaniyeyi SS:DD:DD formatına dönüştüren bağımsız yardımcı
  static formatMs(ms) {
    if (!ms || ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const cs = Math.floor((ms % 1000) / 10);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
  }

  static exportRoomData(roomState, timerEngine, notesManager, format = 'markdown') {
    if (!roomState) {
      if (window.showToast) window.showToast('Oda verisi henüz yüklenemedi, lütfen biraz bekleyin.', 'error');
      return;
    }

    const roomId = roomState.id || 'ODA';
    const now = new Date();
    const dateStr = now.toLocaleDateString('tr-TR');
    const timeStr = now.toLocaleTimeString('tr-TR');

    // 1. Anlık Sayaç Süreleri (timerEngine'dan canlı okuma)
    const swElapsedMs = timerEngine ? timerEngine.getStopwatchElapsed() : 0;
    const cdElapsedMs = timerEngine ? timerEngine.getCountdownElapsed() : 0;
    const cdDurationMs = (roomState.countdown && roomState.countdown.duration) || 300000;
    const cdRemainingMs = Math.max(0, cdDurationMs - cdElapsedMs);

    const swFormatted = RoomExportManager.formatMs(swElapsedMs);
    const cdFormatted = RoomExportManager.formatMs(cdRemainingMs);
    const cdDurationFormatted = RoomExportManager.formatMs(cdDurationMs);

    // 2. Katılımcılar
    const participants = (roomState.participants || []).map(p => p.name).join(', ') || 'Yok';

    // 3. Turlar (currentRoomState.stopwatch.laps her lap-recorded'da güncelleniyor)
    const laps = (roomState.stopwatch && roomState.stopwatch.laps) || [];

    // 4. Chat Mesajları (currentRoomState.messages her new-chat-message'da güncelleniyor)
    const messages = roomState.messages || [];

    // 5. Notlar ve Görevler — notesManager'ın anlık in-memory datasını kullan
    const sharedNotes = notesManager ? notesManager.sharedData : (roomState.sharedNotes || { text: '', todos: [], noteLines: [] });
    const personalNotes = notesManager ? notesManager.personalData : { text: '', todos: [], noteLines: [] };

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
          const lTime = RoomExportManager.formatMs(l.lapTime);
          const sTime = RoomExportManager.formatMs(l.splitTime);
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
      if (sharedNotes.noteLines && sharedNotes.noteLines.length > 0) {
        fileContent += `### 📌 Ortak Not Satırları:\n`;
        sharedNotes.noteLines.forEach((l, i) => {
          const lTime = new Date(l.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
          fileContent += `${i + 1}. ${l.content} *(${l.author || 'Misafir'} • ${lTime})*\n`;
        });
        fileContent += `\n`;
      }
      if (sharedNotes.text && sharedNotes.text.trim()) {
        fileContent += `### Ortak Not Defteri:\n\`\`\`\n${sharedNotes.text.trim()}\n\`\`\`\n\n`;
      }
      fileContent += `### Ortak Yapılacaklar (To-Do):\n`;
      if (!sharedNotes.todos || sharedNotes.todos.length === 0) {
        fileContent += `*Görev listesi boş.*\n\n`;
      } else {
        sharedNotes.todos.forEach(t => {
          const prio = t.priority === 'high' ? ' [ÖNEMLİ]' : '';
          fileContent += `- [${t.completed ? 'x' : ' '}] ${t.text}${prio} *(Ekleyen: ${t.createdBy || 'Misafir'})*\n`;
        });
        fileContent += `\n`;
      }

      fileContent += `---\n\n`;

      // Kişisel Notlar ve Görevler
      fileContent += `## 👤 4. Kişisel Notlarım & Görevlerim\n\n`;
      if (personalNotes.noteLines && personalNotes.noteLines.length > 0) {
        fileContent += `### 📌 Kişisel Not Satırları:\n`;
        personalNotes.noteLines.forEach((l, i) => {
          fileContent += `${i + 1}. ${l.content}\n`;
        });
        fileContent += `\n`;
      }
      if (personalNotes.text && personalNotes.text.trim()) {
        fileContent += `### Kişisel Not Defteri:\n\`\`\`\n${personalNotes.text.trim()}\n\`\`\`\n\n`;
      }
      fileContent += `### Kişisel Yapılacaklar (To-Do):\n`;
      if (!personalNotes.todos || personalNotes.todos.length === 0) {
        fileContent += `*Kişisel görev listesi boş.*\n\n`;
      } else {
        personalNotes.todos.forEach(t => {
          const prio = t.priority === 'high' ? ' [ÖNEMLİ]' : '';
          fileContent += `- [${t.completed ? 'x' : ' '}] ${t.text}${prio}\n`;
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
