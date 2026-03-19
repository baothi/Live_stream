// ==========================================
// content.js — Chay trong ISOLATED WORLD (mac dinh)
// Xu ly Chrome Extension APIs, WebSocket, mic capture
// Giao tiep voi injected.js qua window.postMessage
// ==========================================

let ws = null;
let mediaStream = null;
let audioContext = null;
let processor = null;
let isRunning = false;
let outputQueue = [];
let isPlaying = false;
let echoCooldown = false;

// ==========================================
// Nhan su kien tu injected.js (PAGE world)
// ==========================================
window.addEventListener('message', (e) => {
  if (!e.data || !e.data.__aiTranslator) return;
  const { event } = e.data;

  // Audio EN phat xong → bat cooldown roi phat cau tiep theo
  if (event === 'AUDIO_ENDED' || event === 'AUDIO_ERROR') {
    isPlaying = false;

    // Cooldown 1.5s cho echo tu loa tan het (neu dung loa ngoai)
    echoCooldown = true;
    setTimeout(() => { echoCooldown = false; }, 1500);

    playNextInQueue();
  }
});

// ==========================================
// Nhan lenh tu popup.js
// ==========================================
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'START_TRANSLATION') {
    startTranslation(msg.token, msg.backendUrl);
  }
  if (msg.action === 'STOP_TRANSLATION') {
    stopTranslation();
  }
});

// ==========================================
// BAT DAU DICH
// ==========================================
async function startTranslation(token, backendUrl) {
  try {
    const wsUrl = backendUrl.replace('http', 'ws') + `/translation?token=${token}`;
    ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status: 'connected' });
      chrome.storage.local.set({ isTranslating: true });
      startCapturingMic();
    };

    ws.onerror = () => {
      chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status: 'error', message: 'Khong ket noi duoc server' });
    };

    ws.onclose = () => {
      if (isRunning) {
        chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status: 'error', message: 'Mat ket noi' });
      }
    };

    // Nhan audio EN tu server → them vao queue → phat
    ws.onmessage = async (event) => {
      const arrayBuffer = event.data instanceof ArrayBuffer
        ? event.data
        : await event.data.arrayBuffer();
      outputQueue.push(arrayBuffer);
      chrome.runtime.sendMessage({ type: 'WORD_COUNT' });
      playNextInQueue();
    };

  } catch (err) {
    chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status: 'error', message: err.message });
  }
}

// ==========================================
// BAT MIC VA GUI LEN SERVER
// Dung AudioWorklet (hien dai, thay ScriptProcessor deprecated)
// ==========================================
async function startCapturingMic() {
  isRunning = true;

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000
    }
  });

  // Bao injected.js: bat dau mute VI trong WebRTC
  window.postMessage({ __aiTranslator: true, cmd: 'MUTE' }, '*');

  audioContext = new AudioContext({ sampleRate: 16000 });

  // Load AudioWorklet processor tu extension (khai bao trong web_accessible_resources)
  const processorUrl = chrome.runtime.getURL('audio-processor.js');
  await audioContext.audioWorklet.addModule(processorUrl);

  const source = audioContext.createMediaStreamSource(mediaStream);
  const workletNode = new AudioWorkletNode(audioContext, 'mic-processor');
  processor = workletNode; // Luu lai de stopTranslation() goi disconnect()

  // ==========================================
  // TU DONG DO TIENG ON NEN (Noise Calibration)
  // Do 2 giay dau → tinh nguong dong theo phong/moi truong
  // ==========================================
  const CALIBRATION_CHUNKS = 20;
  const SILENCE_CHUNKS_TO_SEND = 8;
  const MAX_BUFFER_SECONDS = 8;

  let calibrationSamples = [];
  let isCalibrating = true;
  let NOISE_FLOOR = 0.02;
  let SPEECH_THRESHOLD = 0.08;
  let MIN_RMS_TO_SEND = 0.05;

  console.log('[AI Translator] 🎙️ Calibrating noise floor for 2 seconds...');

  function calcRMS(samples) {
    let sum = 0;
    for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
    return Math.sqrt(sum / samples.length);
  }

  let audioBuffer = [];
  let silenceCounter = 0;
  let consecutiveSpeechChunks = 0;
  const MIN_SPEECH_CHUNKS_TO_START = 3; // ~0.8s lien tiep moi bat dau ghi

  // Nhan audio data tu AudioWorklet processor qua MessagePort
  workletNode.port.onmessage = (e) => {
    if (!isRunning || !ws || ws.readyState !== WebSocket.OPEN) return;

    if (isPlaying || echoCooldown) {
      audioBuffer = [];
      silenceCounter = 0;
      consecutiveSpeechChunks = 0;
      return;
    }

    const inputData = e.data.audioData; // Float32Array 4096 samples

    // === GIAI DOAN CALIBRATION (2 giay dau) ===
    if (isCalibrating) {
      calibrationSamples.push(calcRMS(inputData));

      if (calibrationSamples.length >= CALIBRATION_CHUNKS) {
        const avgNoise = calibrationSamples.reduce((a, b) => a + b, 0) / calibrationSamples.length;
        NOISE_FLOOR = avgNoise;
        SPEECH_THRESHOLD = Math.max(NOISE_FLOOR * 4, 0.02); // 4x: loc nhac hang xom / tieng on manh
        MIN_RMS_TO_SEND  = Math.max(NOISE_FLOOR * 2.5, 0.015);

        isCalibrating = false;
        console.log(`[AI Translator] ✅ Calibration done! Noise: ${NOISE_FLOOR.toFixed(4)} | Threshold: ${SPEECH_THRESHOLD.toFixed(4)}`);
        chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status: 'calibrated' });
      }
      return;
    }

    // === GIAI DOAN NORMAL: Thu va gui audio ===
    const chunkRMS = calcRMS(inputData);
    const hasSpeech = chunkRMS > SPEECH_THRESHOLD;

    if (hasSpeech) {
      consecutiveSpeechChunks++;
      silenceCounter = 0;
      if (consecutiveSpeechChunks >= MIN_SPEECH_CHUNKS_TO_START) {
        audioBuffer.push(...inputData);
      }
    } else {
      silenceCounter++;
      consecutiveSpeechChunks = 0;
    }

    const hasSpeechInBuffer = audioBuffer.length > 0;
    const silenceDetected = silenceCounter >= SILENCE_CHUNKS_TO_SEND;
    const bufferTooLong = audioBuffer.length > 16000 * MAX_BUFFER_SECONDS;

    if (hasSpeechInBuffer && (silenceDetected || bufferTooLong)) {
      const chunk = new Float32Array(audioBuffer);
      const bufferRMS = calcRMS(chunk);

      if (bufferRMS >= MIN_RMS_TO_SEND) {
        ws.send(float32ToWav(chunk, 16000));
      } else {
        console.log(`[AI Translator] Skipped low-energy audio RMS=${bufferRMS.toFixed(4)}`);
      }

      audioBuffer = [];
      silenceCounter = 0;
    }
  };

  source.connect(workletNode);
  // Khong connect vao destination: mic audio khong phat lai qua loa
}

// ==========================================
// PHAT AUDIO EN — chuyen sang injected.js xu ly
// injected.js se inject vao WebRTC va bao lai khi xong
// ==========================================
function playNextInQueue() {
  if (isPlaying || outputQueue.length === 0) return;
  isPlaying = true;

  const arrayBuffer = outputQueue.shift();

  // Chuyen ArrayBuffer sang injected.js (PAGE world)
  // Dung transfer [] de khong copy buffer (nhanh hon)
  window.postMessage(
    { __aiTranslator: true, cmd: 'INJECT_AUDIO', payload: arrayBuffer },
    '*',
    [arrayBuffer]
  );
}

// ==========================================
// DUNG DICH
// ==========================================
function stopTranslation() {
  isRunning = false;

  // Bao injected.js: restore mic goc cho Meet
  window.postMessage({ __aiTranslator: true, cmd: 'RESTORE' }, '*');

  if (processor) { processor.disconnect(); processor = null; }
  if (audioContext) { audioContext.close(); audioContext = null; }
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  if (ws) { ws.close(); ws = null; }

  outputQueue = [];
  isPlaying = false;
  echoCooldown = false;

  chrome.storage.local.set({ isTranslating: false });
}

// ==========================================
// HELPER: Convert Float32Array sang WAV
// ==========================================
function float32ToWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  const floatToInt16 = (val) => Math.max(-32768, Math.min(32767, val * 32768));

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, floatToInt16(samples[i]), true);
  }

  return buffer;
}
