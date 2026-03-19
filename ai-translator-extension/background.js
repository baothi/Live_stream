// ==========================================
// background.js — Service Worker
// Quan ly state extension
// ==========================================

chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Meeting Translator installed');
  chrome.storage.local.set({ isTranslating: false });
});

// Khi tab dong → dung dich
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.local.get('activeTabId', (data) => {
    if (data.activeTabId === tabId) {
      chrome.storage.local.set({ isTranslating: false, activeTabId: null });
    }
  });
});
