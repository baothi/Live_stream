// ==========================================
// injected.js — Chay trong PAGE WORLD (world: MAIN)
// Co the hook RTCPeerConnection THAT cua Meet/Zoom
// Nhan lenh tu content.js qua window.postMessage
// ==========================================
(function () {
  'use strict';

  const pcInstances = [];
  let silentCtx = null;
  let silentTrack = null;
  let meetAudioTrack = null; // Track mic goc cua Meet (de restore khi stop)

  // ==========================================
  // HOOK getUserMedia — Bat track mic goc cua Meet
  // Khi Meet goi getUserMedia, ta luu audio track lai
  // ==========================================
  const _origGUM = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia = async function (constraints) {
    const stream = await _origGUM(constraints);
    if (constraints && constraints.audio) {
      const t = stream.getAudioTracks()[0];
      if (t) {
        meetAudioTrack = t;
        console.log('[AI Translator] Captured Meet mic track:', t.label);
      }
    }
    return stream;
  };

  // ==========================================
  // HOOK RTCPeerConnection — Bat tat ca instances
  // Phai chay truoc khi Meet tao PeerConnection
  // ==========================================
  const OrigPC = window.RTCPeerConnection;
  window.RTCPeerConnection = function (...args) {
    const pc = new OrigPC(...args);
    pcInstances.push(pc);
    console.log('[AI Translator] RTCPeerConnection created, total:', pcInstances.length);

    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'closed' || pc.connectionState === 'failed') {
        const idx = pcInstances.indexOf(pc);
        if (idx > -1) pcInstances.splice(idx, 1);
      }
    });
    return pc;
  };
  Object.setPrototypeOf(window.RTCPeerConnection, OrigPC);
  Object.assign(window.RTCPeerConnection, OrigPC);

  // ==========================================
  // HELPER: Replace track trong tat ca audio senders
  // ==========================================
  function replaceAllAudioSenders(track) {
    if (!track) return;
    let replaced = 0;
    pcInstances.forEach(pc => {
      const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
      if (sender) {
        sender.replaceTrack(track).catch(() => {});
        replaced++;
      }
    });
    console.log(`[AI Translator] Replaced ${replaced} sender(s) with track:`, track.label || 'silent');
  }

  // ==========================================
  // HELPER: Tao silent track (im lang hoan toan)
  // ==========================================
  function getSilentTrack() {
    if (silentTrack && silentTrack.readyState === 'live') return silentTrack;

    if (silentCtx) silentCtx.close();
    silentCtx = new AudioContext();
    const dest = silentCtx.createMediaStreamDestination();
    const osc = silentCtx.createOscillator();
    const gain = silentCtx.createGain();
    gain.gain.value = 0; // Im lang hoan toan
    osc.connect(gain);
    gain.connect(dest);
    osc.start();
    silentTrack = dest.stream.getAudioTracks()[0];
    return silentTrack;
  }

  // ==========================================
  // NHAN LENH TU content.js qua window.postMessage
  // ==========================================
  window.addEventListener('message', async (e) => {
    if (!e.data || !e.data.__aiTranslator) return;
    const { cmd, payload } = e.data;

    // MUTE: Bat dich → ben kia nghe im lang, khong nghe VI nua
    if (cmd === 'MUTE') {
      console.log('[AI Translator] CMD: MUTE → replacing senders with silent track');
      replaceAllAudioSenders(getSilentTrack());
    }

    // INJECT_AUDIO: Nhan audio EN → inject vao WebRTC → ben kia nghe EN
    if (cmd === 'INJECT_AUDIO' && payload instanceof ArrayBuffer) {
      console.log('[AI Translator] CMD: INJECT_AUDIO → decoding and injecting EN audio');
      try {
        const audioCtx = new AudioContext();
        const decoded = await audioCtx.decodeAudioData(payload);
        const src = audioCtx.createBufferSource();
        src.buffer = decoded;

        const dest = audioCtx.createMediaStreamDestination();
        src.connect(dest);
        // KHONG connect vao ctx.destination → khong phat qua loa
        // → loai bo echo hoan toan
        // (Nguoi dich se nghe qua tai nghe, khong qua loa)

        // Inject vao WebRTC → ben kia nghe tieng Anh
        replaceAllAudioSenders(dest.stream.getAudioTracks()[0]);
        src.start();

        src.onended = () => {
          audioCtx.close();
          // Tra ve silent track → tiep tuc che tieng Viet
          replaceAllAudioSenders(getSilentTrack());
          // Bao content.js phat xong
          window.postMessage({ __aiTranslator: true, event: 'AUDIO_ENDED' }, '*');
        };
      } catch (err) {
        console.error('[AI Translator] Decode audio error:', err);
        window.postMessage({ __aiTranslator: true, event: 'AUDIO_ERROR' }, '*');
      }
    }

    // RESTORE: Tat dich → tra lai mic goc cho Meet
    if (cmd === 'RESTORE') {
      console.log('[AI Translator] CMD: RESTORE → restoring original mic track');
      if (meetAudioTrack && meetAudioTrack.readyState === 'live') {
        replaceAllAudioSenders(meetAudioTrack);
      }
      if (silentCtx) {
        silentCtx.close();
        silentCtx = null;
        silentTrack = null;
      }
    }
  });

  console.log('[AI Translator] injected.js loaded in PAGE WORLD ✅');
})();
