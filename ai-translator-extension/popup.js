// ==========================================
// popup.js — Xu ly UI cua Extension
// ==========================================

const BACKEND_URL = 'http://localhost:3000'; // Thay bang domain that sau

// DOM Elements
const loginSection = document.getElementById('login-section');
const mainSection = document.getElementById('main-section');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const loginError = document.getElementById('login-error');
const translateToggle = document.getElementById('translate-toggle');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const statTime = document.getElementById('stat-time');
const statWords = document.getElementById('stat-words');

let sessionTimer = null;
let sessionSeconds = 0;
let wordCount = 0;

// ==========================================
// KHOI DONG — kiem tra da login chua
// ==========================================
chrome.storage.local.get(['token', 'user'], (data) => {
  if (data.token && data.user) {
    showMainSection(data.user);
    checkCurrentState();
  } else {
    showLoginSection();
  }
});

// ==========================================
// LOGIN
// ==========================================
loginBtn.addEventListener('click', async () => {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();

  if (!email || !password) return;

  loginBtn.textContent = 'Dang dang nhap...';
  loginBtn.disabled = true;
  loginError.style.display = 'none';

  try {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.message);

    // Luu token va user
    chrome.storage.local.set({
      token: data.access_token,
      user: data.user
    });

    showMainSection(data.user);

  } catch (err) {
    loginError.textContent = err.message || 'Dang nhap that bai';
    loginError.style.display = 'block';
  } finally {
    loginBtn.textContent = 'Dang nhap';
    loginBtn.disabled = false;
  }
});

// ==========================================
// LOGOUT
// ==========================================
logoutBtn.addEventListener('click', () => {
  chrome.storage.local.remove(['token', 'user']);
  // Thong bao content.js dung
  sendToActiveTab({ action: 'STOP_TRANSLATION' });
  showLoginSection();
});

// ==========================================
// TOGGLE BAT/TAT DICH
// ==========================================
translateToggle.addEventListener('change', async (e) => {
  const isOn = e.target.checked;

  if (isOn) {
    setStatus('connecting', 'Dang ket noi...');
    const { token } = await chrome.storage.local.get('token');
    sendToActiveTab({ action: 'START_TRANSLATION', token, backendUrl: BACKEND_URL });
  } else {
    setStatus('', 'Da tat');
    sendToActiveTab({ action: 'STOP_TRANSLATION' });
    stopSessionTimer();
  }
});

// ==========================================
// Nhan message tu content.js
// ==========================================
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'STATUS_UPDATE') {
    if (msg.status === 'connected') {
      setStatus('active', 'Dang dich...');
      startSessionTimer();
    } else if (msg.status === 'error') {
      setStatus('', `Loi: ${msg.message}`);
      translateToggle.checked = false;
    }
  }

  if (msg.type === 'WORD_COUNT') {
    wordCount += 1;
    statWords.textContent = wordCount;
  }
});

// ==========================================
// UI HELPERS
// ==========================================
function showLoginSection() {
  loginSection.style.display = 'block';
  mainSection.style.display = 'none';
}

function showMainSection(user) {
  loginSection.style.display = 'none';
  mainSection.style.display = 'block';
  document.getElementById('user-name').textContent = user.name || 'User';
  document.getElementById('user-email').textContent = user.email;
  document.getElementById('user-avatar').textContent = (user.name || 'U')[0].toUpperCase();
}

function setStatus(type, text) {
  statusDot.className = 'status-dot' + (type ? ` ${type}` : '');
  statusText.textContent = text;
}

function startSessionTimer() {
  sessionSeconds = 0;
  sessionTimer = setInterval(() => {
    sessionSeconds++;
    const m = Math.floor(sessionSeconds / 60);
    const s = sessionSeconds % 60;
    statTime.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  }, 1000);
}

function stopSessionTimer() {
  clearInterval(sessionTimer);
  sessionTimer = null;
  statTime.textContent = '0:00';
  wordCount = 0;
  statWords.textContent = '0';
}

function checkCurrentState() {
  chrome.storage.local.get('isTranslating', (data) => {
    if (data.isTranslating) {
      translateToggle.checked = true;
      setStatus('active', 'Dang dich...');
      startSessionTimer();
    }
  });
}

// ==========================================
// GO CAI DAT EXTENSION
// ==========================================
document.getElementById('uninstall-btn').addEventListener('click', () => {
  // Chrome tu hien hop xac nhan truoc khi go
  chrome.management.uninstallSelf({ showConfirmDialog: true });
});

function sendToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, message).catch(() => {});
    }
  });
}
