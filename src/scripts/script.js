import { lyricsParse } from "./modules/lyricsParse";
import { lyricsGetAudio, lyricsRender, lyricsRenderLoop } from "./modules/lyricsRender";
import { lyricsRenderAnalyzer } from "./modules/lyricsRenderSpectrum";

export const settings = {
    elementInputAudio: '.element_input_audio',
    elementInputOffset: '.element_input_offset',
    elementInputBackground: '.element_input_background',
    elementInputSpectrum: '.element_input_spectrum',
    elementTextareaLyrics: '.element_textarea_lyrics',
    elementTextareaHeader: '.element_textarea_header',
    elementTextareaFooter: '.element_textarea_footer',
    elementButtonExport: '.element_button_export',
    elementButtonFullscreen: '.element_button_fullscreen',
    elementAudio: '.element_audio',
    elementContainerControll: '.element_container_controll',
    elementCanvas: '.element_canvas_preview',

    lyricsParsed: [],
    lyricsIsPlaying: false,
    lyricsIsRecording: false,
    lyricsRenderSpectrum: true,
    lyricsBackground: null,
    lyricsRequestAnimationFrameID: null,
    lyricsSpectrumAudioContext: null,
    lyricsSpectrumAnalyser: null,
    lyricsSpectrumSource: null,
    lyricsSpectrumFrequencyData: null,
    lyricsContext: null,
    lyricsPreviewWidth: 1920,
    lyricsPreviewHeight: 1080,
    lyricsFPS: 60,
    lyricsFont: 'Nexa Black',
    lyricsInstrumentalText: '♪',
    lyricsFileName: 'lyrics-export',
};

const elementInputOffset = document.querySelector(settings.elementInputOffset);
const elementInputSpectrum = document.querySelector(settings.elementInputSpectrum);
const elementInputBackground = document.querySelector(settings.elementInputBackground);
const elementInputAudio = document.querySelector(settings.elementInputAudio);
const elementTextareaLyrics = document.querySelector(settings.elementTextareaLyrics);
const elementTextareaHeader = document.querySelector(settings.elementTextareaHeader);
const elementTextareaFooter = document.querySelector(settings.elementTextareaFooter);
const elementButtonExport = document.querySelector(settings.elementButtonExport);
const elementButtonFullscreen = document.querySelector(settings.elementButtonFullscreen);
const elementAudio = document.querySelector(settings.elementAudio);
const elementContainerControll = document.querySelector(settings.elementContainerControll);
const elementCanvas = document.querySelector(settings.elementCanvas);

settings.lyricsContext = elementCanvas.getContext('2d', {
    alpha: true
});

// persistence helpers
const storageSave = (key, value) => {
    localStorage.setItem(key, value);
};

const storageLoad = (key, fallback = '') => {
    return localStorage.getItem(key) ?? fallback;
};

const normalizeLyrics = (text) => {
    if (!text) {
        return ''
    };

    text = text.normalize('NFC'); // Normalisasi unicode
    text = text.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, ''); // Hapus control characters KECUALI \n (000A) dan \r (000D)
    text = text.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Hapus zero-width characters
    text = text.replace(/[\u2060-\u206F]/g, ''); // Hapus formatting invis chars

    // Konversi confusable characters
    const confusables = {
        "е": "e", "Е": "E",
        "о": "o", "О": "O",
        "ӏ": "l",
        "І": "I",
        "ı": "i",
        "ѕ": "s",
        "ᴀ": "A", "ʙ": "B", "ᴄ": "C", "ᴇ": "E",
        "ɢ": "G", "ʜ": "H", "ɪ": "I", "ᴊ": "J",
        "ᴋ": "K", "ʟ": "L", "ᴍ": "M", "ɴ": "N",
        "ᴏ": "O", "ᴘ": "P", "ʀ": "R", "ᴛ": "T",
        "ᴜ": "U", "ᴡ": "W", "ʏ": "Y", "ᴢ": "Z",
        "∕": "/", "꞉": ":"
    };

    text = text.replace(/./g, char => confusables[char] || char);
    text = text.split(/\r?\n/).map(line => line.replace(/ +/g, ' ').trim()).join('\n'); // Bersihkan spasi dalam 1 baris, tanpa ganggu newline

    return text;
};

// restore persisted values
elementTextareaLyrics.value = normalizeLyrics(storageLoad('lyrics_textarea', '[00:00.00] Intro\n[00:05.00] First lyric line\n[00:10.00] Second lyric line\n[00:15.00] Third lyric line'));
settings.lyricsParsed = lyricsParse(elementTextareaLyrics.value);

elementTextareaHeader.value = storageLoad('lyrics_header', '');
elementTextareaFooter.value = storageLoad('lyrics_footer', '');

// render awal
lyricsRender(0, settings.lyricsContext);

elementInputAudio.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
        return
    };

    elementAudio.src = URL.createObjectURL(file);
    elementAudio.load();
    lyricsRenderAnalyzer(elementAudio);
    settings.lyricsFileName = `${file.name.replace(/\.[^/.]+$/, '')}`;
});

elementButtonFullscreen.addEventListener('click', (event) => {
    if (!document.fullscreenElement) {
        elementCanvas.requestFullscreen().catch(console.error)
    } else {
        document.exitFullscreen();
    }
});

elementAudio.addEventListener('loadedmetadata', () => {
    elementContainerControll.classList.add('grid');
    elementContainerControll.classList.remove('hidden');
});

elementTextareaLyrics.addEventListener('input', () => {
    const normalized = normalizeLyrics(elementTextareaLyrics.value);

    elementTextareaLyrics.value = normalized;
    settings.lyricsParsed = lyricsParse(normalized);
    lyricsRender(elementAudio.currentTime * 1000, settings.lyricsContext);

    storageSave('lyrics_textarea', normalized);
});


elementTextareaHeader.addEventListener('input', () => {
    if (!settings.lyricsIsPlaying) {
        lyricsRender(elementAudio.currentTime * 1000, settings.lyricsContext);
    }
    storageSave('lyrics_header', elementTextareaHeader.value);
});

elementTextareaFooter.addEventListener('input', () => {
    if (!settings.lyricsIsPlaying) {
        lyricsRender(elementAudio.currentTime * 1000, settings.lyricsContext);
    }
    storageSave('lyrics_footer', elementTextareaFooter.value);
});

elementInputOffset.addEventListener('input', () => {
    if (!settings.lyricsIsPlaying) {
        lyricsRender(elementAudio.currentTime * 1000, settings.lyricsContext);
    }
});

elementInputBackground.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    settings.lyricsBackground = null;

    if (!file) {
        return
    };

    const url = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
        const fileImage = new Image();
        fileImage.src = url;
        fileImage.onload = () => {
            settings.lyricsBackground = {
                type: 'image',
                el: fileImage
            };

            lyricsRender(elementAudio.currentTime * 1000, settings.lyricsContext);
        };
    } else if (file.type.startsWith('video/')) {
        const fileVideo = document.createElement('video');
        fileVideo.src = url;
        fileVideo.muted = true;
        fileVideo.loop = true;
        fileVideo.playsInline = true;
        fileVideo.onloadeddata = () => {
            fileVideo.play().catch((error) => {
                console.log('Error playing video:', error);
            });

            settings.lyricsBackground = {
                type: 'video',
                el: fileVideo
            };

            lyricsRender(elementAudio.currentTime * 1000, settings.lyricsContext);
        };

        fileVideo.load();
    }
});

elementButtonExport.addEventListener('click', async () => {
    if (!elementAudio.src) {
        alert('Please load an audio file first.');

        return;
    }

    const duration = elementAudio.duration;
    if (!isFinite(duration) || duration <= 0) {
        alert('Audio duration unknown — play once then try export.');

        return;
    }

    elementButtonExport.disabled = true;
    elementButtonExport.textContent = 'Recording…';
    settings.lyricsIsRecording = true;

    try {
        // ensure font is ready before export
        await lyricsGetAudio(elementAudio);

        // prepare offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = settings.lyricsPreviewWidth;
        canvas.height = settings.lyricsPreviewHeight;

        const cctx = canvas.getContext('2d', {
            alpha: true,
            desynchronized: true // minta pipeline low-latency (GPU-friendly)
        });

        // capture streams and audio
        const canvasStream = canvas.captureStream(settings.lyricsFPS);
        let audioStream = null;
        if (typeof elementAudio.captureStream === 'function') {
            try {
                audioStream = elementAudio.captureStream();
            } catch (error) {
                console.log('Error capturing audio stream:', error);
                audioStream = null;
            }
        }

        const composed = new MediaStream();
        canvasStream.getVideoTracks().forEach(t => composed.addTrack(t));
        if (audioStream && audioStream.getAudioTracks().length) {
            audioStream.getAudioTracks().forEach(t => composed.addTrack(t));
        } else {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const src = audioCtx.createMediaElementSource(elementAudio);
            const dest = audioCtx.createMediaStreamDestination();
            src.connect(dest);
            src.connect(audioCtx.destination);
            dest.stream.getAudioTracks().forEach(t => composed.addTrack(t));
        }

        // recorder with fallbacks
        const mimeChoices = [
            'video/webm;codecs=vp9,opus',
            'video/webm;codecs=vp8,opus',
            'video/webm'
        ];

        let recorder;
        for (const m of mimeChoices) {
            try {
                recorder = new MediaRecorder(composed, { mimeType: m }); break;
            } catch (error) {
                console.log(`MediaRecorder with mimeType "${m}" failed:`, error);
                recorder = null;
            }
        }

        if (!recorder) {
            recorder = new MediaRecorder(composed)
        };

        const chunks = [];
        recorder.ondataavailable = (ev) => {
            if (ev.data && ev.data.size) {
                chunks.push(ev.data)
            };
        };

        recorder.onstop = () => {
            const blob = new Blob(chunks, {
                type: 'video/webm'
            });

            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${settings.lyricsFileName}.webm`; // pake nama file audio
            a.click();
            URL.revokeObjectURL(url);

            elementButtonExport.disabled = false;
            elementButtonExport.textContent = 'Export';
            settings.lyricsIsRecording = false;
        };

        // start recording & play audio from 0
        recorder.start();
        elementAudio.currentTime = 0;
        await elementAudio.play();

        // render loop (use same lyricsRender, but with cctx)
        const frameInterval = Math.round(1000 / settings.lyricsFPS);
        const renderInterval = setInterval(() => {
            lyricsRender(elementAudio.currentTime * 1000, cctx);

            if (elementAudio.ended || elementAudio.currentTime >= elementAudio.duration - 0.05) {
                try {
                    recorder.stop();
                } catch (error) {
                    console.log('Error stopping recorder:', error);
                }

                clearInterval(renderInterval);
                elementAudio.pause();
            }
        }, frameInterval);

    } catch (error) {
        console.log(error);
        alert('Export failed: ' + (error && error.message ? error.message : error));
        elementButtonExport.disabled = false;
        elementButtonExport.textContent = 'Record';

        settings.lyricsIsRecording = false;
    }
});

elementInputSpectrum.addEventListener('change', (event) => {
    settings.lyricsRenderSpectrum = event.target.checked;

    if (!settings.lyricsIsPlaying) {
        lyricsRender(elementAudio.currentTime * 1000, settings.lyricsContext);
    }
});

elementAudio.addEventListener('play', (event) => {
    event.preventDefault();

    if (settings.lyricsRequestAnimationFrameID) {
        cancelAnimationFrame(settings.lyricsRequestAnimationFrameID)
    };

    settings.lyricsRequestAnimationFrameID = requestAnimationFrame(lyricsRenderLoop);
    settings.lyricsIsPlaying = true;
});

elementAudio.addEventListener('pause', (event) => {
    event.preventDefault();

    if (settings.lyricsRequestAnimationFrameID) {
        cancelAnimationFrame(settings.lyricsRequestAnimationFrameID);

        settings.lyricsRequestAnimationFrameID = null;
        settings.lyricsIsPlaying = false
    };
});

elementAudio.addEventListener('seeked', () => lyricsRender(elementAudio.currentTime * 1000, settings.lyricsContext));

window.addEventListener('beforeunload', (event) => {
    if (settings.lyricsIsRecording) {
        event.preventDefault();
        event.returnValue = '';
        return '';
    }
});
