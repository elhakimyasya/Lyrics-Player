import { lyricsSettings } from "./modules/lyricsSettings";
import { lyricsParse } from "./modules/lyricsParse";
import { lyricsRender } from "./modules/lyricsRender";
import { lyricsRenderLoop } from "./modules/lyricsRenderLoop";
import { lyricsRenderAnalyzer } from "./modules/lyricsRenderAnalyzer";
import { lyricsStorageSave } from "./modules/lyricsStorageSave";
import { lyricsStorageLoad } from "./modules/lyricsStorageLoad";
import { lyricsNormalize } from "./modules/lyricsNormalize";
import { lyricsGetAudioState } from "./modules/lyricsGetAudioState";
import { lyricsStorageFileLoad, lyricsStorageFileSave } from "./modules/lyricsStorageManager";

// --- DOM CACHING ---
const domInputOffset = document.querySelector(lyricsSettings.elementSelectorInputOffset);
const domInputSpectrum = document.querySelector(lyricsSettings.elementSelectorInputSpectrum);
const domInputBackground = document.querySelector(lyricsSettings.elementSelectorInputBackground);
const domInputAudio = document.querySelector(lyricsSettings.elementSelectorInputAudio);
const domTextareaLyrics = document.querySelector(lyricsSettings.elementSelectorTextareaLyrics);
const domTextareaHeader = document.querySelector(lyricsSettings.elementSelectorTextareaHeader);
const domTextareaFooter = document.querySelector(lyricsSettings.elementSelectorTextareaFooter);
const domButtonExport = document.querySelector(lyricsSettings.elementSelectorButtonExport);
const domButtonFullscreen = document.querySelector(lyricsSettings.elementSelectorButtonFullscreen);
const domAudioPlayer = document.querySelector(lyricsSettings.elementSelectorAudio);
const domContainerControl = document.querySelector(lyricsSettings.elementSelectorContainerControl);
const domCanvasPreview = document.querySelector(lyricsSettings.elementSelectorCanvas);

const domInputBgColor = document.querySelector(lyricsSettings.elementSelectorBgColor);
const domInputKeyColor = document.querySelector(lyricsSettings.elementSelectorKeyColor);

lyricsSettings.lyricsCanvasContext = domCanvasPreview.getContext('2d', { alpha: true });

const lyricsInitializeApplication = async () => {
    // 1. Pulihkan Teks & Warna dari LocalStorage
    domTextareaLyrics.value = lyricsNormalize(lyricsStorageLoad('lyrics_textarea', '[00:00.00] Intro\n[00:05.00] Lirik Baris Pertama'));
    domTextareaHeader.value = lyricsStorageLoad('lyrics_header', '');
    domTextareaFooter.value = lyricsStorageLoad('lyrics_footer', '');
    domInputOffset.value = lyricsStorageLoad('lyrics_offset', '0');

    // Pulihkan Warna
    domInputBgColor.value = lyricsSettings.lyricsBgColor;
    domInputKeyColor.value = lyricsSettings.lyricsKeyColor;

    lyricsSettings.lyricsDataParsed = lyricsParse(domTextareaLyrics.value);

    // 2. Pulihkan Audio & Background dari IndexedDB (Tetap seperti kode Anda)
    const savedAudioBlob = await lyricsStorageFileLoad(lyricsSettings.lyricsPersistenceKeys.audio);
    if (savedAudioBlob) {
        domAudioPlayer.src = URL.createObjectURL(savedAudioBlob);
        domAudioPlayer.load();
        lyricsRenderAnalyzer(domAudioPlayer);
    }

    const savedBackgroundBlob = await lyricsStorageFileLoad(lyricsSettings.lyricsPersistenceKeys.background);
    const savedBackgroundType = lyricsStorageLoad(lyricsSettings.lyricsPersistenceKeys.bgType, '');

    if (savedBackgroundBlob && savedBackgroundType) {
        const backgroundUrl = URL.createObjectURL(savedBackgroundBlob);
        if (savedBackgroundType === 'image') {
            const imageElement = new Image();
            imageElement.src = backgroundUrl;
            imageElement.onload = () => {
                lyricsSettings.lyricsResourceBackground = { type: 'image', element: imageElement };
                lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
            };
        } else {
            const videoElement = document.createElement('video');
            videoElement.src = backgroundUrl;
            videoElement.muted = true;
            videoElement.loop = true;
            videoElement.playsInline = true;
            videoElement.onloadeddata = () => {
                videoElement.play().catch(() => { });
                lyricsSettings.lyricsResourceBackground = { type: 'video', element: videoElement };
                lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
            };
        }
    }

    requestAnimationFrame(() => {
        lyricsRender(0, lyricsSettings.lyricsCanvasContext);
    });
};

const lyricsEnsureAudioContextActive = async () => {
    if (lyricsSettings.lyricsAudioContext && lyricsSettings.lyricsAudioContext.state === 'suspended') {
        try {
            await lyricsSettings.lyricsAudioContext.resume();
        } catch (error) {
            console.error("Failed to resume AudioContext:", error);
        }
    }
};

domInputBgColor.addEventListener('input', (e) => {
    const color = e.target.value;
    lyricsSettings.lyricsBgColor = color;
    lyricsStorageSave('lyrics_bg_color', color);
    if (!lyricsSettings.lyricsStateIsPlaying) {
        lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
    }
});

domInputKeyColor.addEventListener('input', (e) => {
    const color = e.target.value;
    lyricsSettings.lyricsKeyColor = color;
    lyricsStorageSave('lyrics_key_color', color);
    if (!lyricsSettings.lyricsStateIsPlaying) {
        lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
    }
});

domInputAudio.addEventListener('change', async (event) => {
    const audioFile = event.target.files?.[0];
    if (!audioFile) return;
    await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.audio, audioFile);
    domAudioPlayer.src = URL.createObjectURL(audioFile);
    domAudioPlayer.load();
    lyricsRenderAnalyzer(domAudioPlayer);
    lyricsSettings.lyricsExportFileName = audioFile.name.replace(/\.[^/.]+$/, '');
});

domInputBackground.addEventListener('change', async (event) => {
    const backgroundFile = event.target.files?.[0];
    if (!backgroundFile) {
        return;
    }

    if (lyricsSettings.lyricsResourceBackground?.element?.src) {
        URL.revokeObjectURL(lyricsSettings.lyricsResourceBackground.element.src);
    }

    const backgroundType = backgroundFile.type.startsWith('image/') ? 'image' : 'video';
    await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.background, backgroundFile);
    lyricsStorageSave(lyricsSettings.lyricsPersistenceKeys.bgType, backgroundType);

    const backgroundUrl = URL.createObjectURL(backgroundFile);
    if (backgroundType === 'image') {
        const imageElement = new Image();
        imageElement.onload = () => {
            lyricsSettings.lyricsResourceBackground = { type: 'image', element: imageElement };
            lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
        };
        imageElement.src = backgroundUrl;
    } else {
        const videoElement = document.createElement('video');
        videoElement.muted = videoElement.loop = videoElement.playsInline = true;
        videoElement.onloadeddata = () => {
            lyricsSettings.lyricsResourceBackground = { type: 'video', element: videoElement };
            lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
        };

        videoElement.src = backgroundUrl;
        videoElement.load();
    }
});

domTextareaLyrics.addEventListener('input', () => {
    const content = lyricsNormalize(domTextareaLyrics.value);
    domTextareaLyrics.value = content;
    lyricsSettings.lyricsDataParsed = lyricsParse(content);
    lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
    lyricsStorageSave('lyrics_textarea', content);
});

const handleTextareaInputPersistence = (storageKey, htmlElement) => {
    if (!lyricsSettings.lyricsStateIsPlaying) {
        lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
    }
    lyricsStorageSave(storageKey, htmlElement.value);
};

domTextareaHeader.addEventListener('input', () => handleTextareaInputPersistence('lyrics_header', domTextareaHeader));
domTextareaFooter.addEventListener('input', () => handleTextareaInputPersistence('lyrics_footer', domTextareaFooter));

domInputOffset.addEventListener('input', () => {
    lyricsStorageSave('lyrics_offset', domInputOffset.value);
    if (!lyricsSettings.lyricsStateIsPlaying) {
        lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
    }
});

domButtonFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) domCanvasPreview.requestFullscreen().catch(console.error);
    else document.exitFullscreen();
});

domAudioPlayer.addEventListener('loadedmetadata', () => {
    domContainerControl.classList.replace('hidden', 'grid');
});

domButtonExport.addEventListener('click', async () => {
    if (!domAudioPlayer.src) return alert('Silakan masukkan file audio terlebih dahulu.');
    domButtonExport.disabled = true;
    domButtonExport.textContent = 'Recording...';
    lyricsSettings.lyricsStateIsRecording = true;

    try {
        await lyricsGetAudioState(domAudioPlayer);
        await lyricsEnsureAudioContextActive();
        const exportCanvas = document.createElement('canvas');
        exportCanvas.width = lyricsSettings.lyricsPreviewWidth;
        exportCanvas.height = lyricsSettings.lyricsPreviewHeight;
        const exportContext = exportCanvas.getContext('2d', { alpha: true });
        const videoStream = exportCanvas.captureStream(lyricsSettings.lyricsFramesPerSecond);
        let combinedStream = new MediaStream();
        videoStream.getVideoTracks().forEach(track => combinedStream.addTrack(track));

        if (domAudioPlayer.captureStream) {
            const audioStream = domAudioPlayer.captureStream();
            audioStream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
        } else {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = audioContext.createMediaElementSource(domAudioPlayer);
            const destination = audioContext.createMediaStreamDestination();
            source.connect(destination);
            source.connect(audioContext.destination);
            destination.stream.getAudioTracks().forEach(track => combinedStream.addTrack(track));
        }

        const recorderOptions = { mimeType: 'video/webm;codecs=vp9,opus' };
        const mediaRecorder = new MediaRecorder(combinedStream, MediaRecorder.isTypeSupported(recorderOptions.mimeType) ? recorderOptions : {});
        const recordingChunks = [];
        mediaRecorder.ondataavailable = (event) => event.data.size && recordingChunks.push(event.data);
        mediaRecorder.onstop = () => {
            const finalBlob = new Blob(recordingChunks, { type: 'video/webm' });
            const downloadUrl = URL.createObjectURL(finalBlob);
            const hiddenLink = document.createElement('a');
            hiddenLink.href = downloadUrl;
            hiddenLink.download = `${lyricsSettings.lyricsExportFileName}.webm`;
            hiddenLink.click();
            domButtonExport.disabled = false;
            domButtonExport.textContent = 'Export';
            lyricsSettings.lyricsStateIsRecording = false;
        };
        mediaRecorder.start();
        domAudioPlayer.currentTime = 0;
        await domAudioPlayer.play();

        const renderExportFrame = () => {
            if (!lyricsSettings.lyricsStateIsRecording) return;
            lyricsRender(domAudioPlayer.currentTime * 1000, exportContext);
            if (domAudioPlayer.ended || domAudioPlayer.currentTime >= domAudioPlayer.duration - 0.05) {
                mediaRecorder.stop();
                domAudioPlayer.pause();
            } else {
                setTimeout(renderExportFrame, 1000 / lyricsSettings.lyricsFramesPerSecond);
            }
        };
        renderExportFrame();
    } catch (error) {
        console.error('Export Error:', error);
        domButtonExport.disabled = false;
        domButtonExport.textContent = 'Export';
        lyricsSettings.lyricsStateIsRecording = false;
    }
});

domInputSpectrum.addEventListener('change', (e) => {
    lyricsSettings.lyricsStateRenderSpectrum = e.target.checked;
    if (!lyricsSettings.lyricsStateIsPlaying) lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext);
});

domAudioPlayer.addEventListener('play', async () => {
    await lyricsEnsureAudioContextActive();
    if (lyricsSettings.lyricsAnimationRequestID) cancelAnimationFrame(lyricsSettings.lyricsAnimationRequestID);
    lyricsSettings.lyricsAnimationRequestID = requestAnimationFrame(lyricsRenderLoop);
    lyricsSettings.lyricsStateIsPlaying = true;
});

domAudioPlayer.addEventListener('pause', () => {
    if (lyricsSettings.lyricsAnimationRequestID) {
        cancelAnimationFrame(lyricsSettings.lyricsAnimationRequestID);
        lyricsSettings.lyricsAnimationRequestID = null;
        lyricsSettings.lyricsStateIsPlaying = false;
    }
});

domAudioPlayer.addEventListener('seeked', () => lyricsRender(domAudioPlayer.currentTime * 1000, lyricsSettings.lyricsCanvasContext));

lyricsInitializeApplication();