/**
 * Main Landing Page Scripts
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Tema Yönetimi
  const themeToggle = document.getElementById('themeToggle');
  const themeIconDark = document.getElementById('themeIconDark');
  const themeIconLight = document.getElementById('themeIconLight');

  const savedTheme = localStorage.getItem('synctimer_theme') || 'dark';
  applyTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('synctimer_theme', newTheme);
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

  // 2. Kullanıcı Adı Hatırlama
  const savedName = localStorage.getItem('synctimer_username') || '';
  const createUserNameInput = document.getElementById('createUserName');
  const joinUserNameInput = document.getElementById('joinUserName');
  const joinRoomCodeInput = document.getElementById('joinRoomCode');

  if (savedName) {
    if (createUserNameInput) createUserNameInput.value = savedName;
    if (joinUserNameInput) joinUserNameInput.value = savedName;
  }

  // Oda kodu girişini otomatik büyük harf ve tire formatına sokma
  if (joinRoomCodeInput) {
    joinRoomCodeInput.addEventListener('input', (e) => {
      let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (val.length > 3) {
        val = val.slice(0, 3) + '-' + val.slice(3, 6);
      }
      e.target.value = val;
    });
  }

  // 3. Oda Oluşturma Formu
  const createRoomForm = document.getElementById('createRoomForm');
  if (createRoomForm) {
    createRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const userName = createUserNameInput.value.trim();
      const initialMode = document.getElementById('initialMode').value;

      if (!userName) {
        showToast('Lütfen adınızı girin', 'error');
        return;
      }

      localStorage.setItem('synctimer_username', userName);

      // Rastgele oda kodu üret ve odaya yönlendir
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      const roomId = `${code.slice(0, 3)}-${code.slice(3)}`;

      window.location.href = `/room.html?id=${roomId}&mode=${initialMode}`;
    });
  }

  // 4. Odaya Katılma Formu
  const joinRoomForm = document.getElementById('joinRoomForm');
  if (joinRoomForm) {
    joinRoomForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const userName = joinUserNameInput.value.trim();
      const roomCode = joinRoomCodeInput.value.trim().toUpperCase();

      if (!userName) {
        showToast('Lütfen adınızı girin', 'error');
        return;
      }
      if (!roomCode) {
        showToast('Lütfen bir oda kodu girin', 'error');
        return;
      }

      localStorage.setItem('synctimer_username', userName);
      window.location.href = `/room.html?id=${roomCode}`;
    });
  }
});

// Toast bildirim fonksiyonu
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
  }, 3000);
}
