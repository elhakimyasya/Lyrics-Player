const elementInputAudio = document.querySelector('.element_input_audio');
const elementInputOffset = document.querySelector('.element_input_offset');
const elementInputBackground = document.querySelector('.element_input_background');
const elementTextareaLyrics = document.querySelector('.element_textarea_lyrics');
const elementButtonFullscreen = document.querySelector('.element_button_fullscreen');
const elementButtonExport = document.querySelector('.element_button_export');
const elementAudio = document.querySelector('.element_audio');
const elementContainerControll = document.querySelector('.element_container_controll');
const elementCanvas = document.querySelector('.element_canvas_preview');


let lyricsParsed = []; // parsed LRC
let lyricsIsRecording = false;
let lyricsIsPlaying = false;
let lyricsRequestAnimationFrameID = null;
let lyricsBackground = null;
let lyricsFont = 'Nexa Black';
let lyricsFileName = 'lyrics-export';

const lyricsFPS = 60;
const lyricsPreviewWidth = elementCanvas.width;
const lyricsPreviewHeight = elementCanvas.height;
const lyricsContext = elementCanvas.getContext('2d', {
    alpha: true
});

const clamp01 = (v) => {
    return Math.max(0, Math.min(1, v));
}

const ensureAudioReady = (audio) => {
    return new Promise((res, rej) => {
        if (audio.readyState >= 2) {
            return res()
        };

        function onloaded() {
            cleanup(); res();
        }

        function onerr() {
            cleanup();
            rej(new Error('Cannot load audio'));
        }

        function cleanup() {
            audio.removeEventListener('canplay', onloaded);
            audio.removeEventListener('error', onerr);
        }

        audio.addEventListener('canplay', onloaded);
        audio.addEventListener('error', onerr);
    });
}

const lyricsRender = (nowMs, drawContext) => {
    const renderOffset = (parseFloat(elementInputOffset.value) || 0) * 1000;
    const renderTime = nowMs + renderOffset;

    // clear canvas
    drawContext.clearRect(0, 0, lyricsPreviewWidth, lyricsPreviewHeight);

    // background
    if (lyricsBackground) {
        try {
            drawContext.drawImage(lyricsBackground.el, 0, 0, lyricsPreviewWidth, lyricsPreviewHeight);
        } catch (error) {
            console.log('Error drawing background:', error);
        }

        drawContext.fillStyle = 'rgba(0, 0, 0, 0.12)';
        drawContext.fillRect(0, 0, lyricsPreviewWidth, lyricsPreviewHeight);
    }

    if (!lyricsParsed.length) {
        drawContext.fillStyle = '#000';
        drawContext.font = `76px "${lyricsFont}", Inter, sans-serif`;
        drawContext.textAlign = 'center';
        drawContext.textBaseline = 'middle';
        drawContext.fillText('—', lyricsPreviewWidth / 2, lyricsPreviewHeight / 2);

        return;
    }

    // cari index active
    let renderIndexActiveLine = -1;
    for (let index = 0; index < lyricsParsed.length; index++) {
        if (lyricsParsed[index].timeMs <= renderTime) {
            renderIndexActiveLine = index;
        } else {
            break
        }
    }

    if (renderIndexActiveLine < 0) {
        renderIndexActiveLine = 0
    };

    const renderCurrentStart = lyricsParsed[renderIndexActiveLine].timeMs;
    const renderCurrentEnd = lyricsParsed[renderIndexActiveLine + 1] ? lyricsParsed[renderIndexActiveLine + 1].timeMs : elementAudio.duration * 1000;
    const renderActiveProgress = clamp01((renderTime - renderCurrentStart) / (renderCurrentEnd - renderCurrentStart));

    const renderLineSpacing = 120;
    const renderBaseActiveY = lyricsPreviewHeight * 0.55;
    const renderBasePrevY = renderBaseActiveY - renderLineSpacing;
    const renderBaseNextY = renderBaseActiveY + renderLineSpacing;
    const renderScrollOffset = renderActiveProgress * renderLineSpacing;

    const renderPrevY = renderBasePrevY - renderScrollOffset;
    const renderActiveY = renderBaseActiveY - renderScrollOffset;
    const renderNextY = renderBaseNextY - renderScrollOffset;

    drawContext.textAlign = 'center';
    drawContext.textBaseline = 'middle';

    const renderActiveText = lyricsParsed[renderIndexActiveLine] ? lyricsParsed[renderIndexActiveLine].text : '';
    const renderPrevText = lyricsParsed[renderIndexActiveLine - 1] ? lyricsParsed[renderIndexActiveLine - 1].text : '';
    const renderNextText = lyricsParsed[renderIndexActiveLine + 1] ? lyricsParsed[renderIndexActiveLine + 1].text : '';

    // --- prev line ---
    let renderPrevAlpha = 1;
    if (renderPrevText) {
        if (renderActiveText.includes('♪')) {
            // fade lebih cepat saat active line = ♪
            const renderFadeSpeed = 0.1; // bisa tweak (0.0–1.0)
            renderPrevAlpha = clamp01(1 - renderActiveProgress / renderFadeSpeed);
        } else {
            renderPrevAlpha = 1 - renderActiveProgress; // fade normal
        }
        drawContext.font = `82px "${lyricsFont}", Inter, sans-serif`;
        drawContext.fillStyle = '#fff';
        drawContext.globalAlpha = renderPrevAlpha;
        drawContext.fillText(renderPrevText, lyricsPreviewWidth / 2, renderPrevY);
    }

    // --- active line ---
    drawContext.font = `82px "${lyricsFont}", Inter, sans-serif`;
    drawContext.fillStyle = '#ffde59';
    drawContext.globalAlpha = 1.0;
    drawContext.fillText(renderActiveText, lyricsPreviewWidth / 2, renderActiveY);

    // --- next line ---
    let renderNextAlpha = renderActiveProgress; // default fade in
    if (renderActiveText.includes('♪')) {
        // tahan alpha sampai hampir habis durasi instrumental
        const renderRemaining = renderCurrentEnd - renderTime;
        const renderFadeDuration = Math.min(500, renderCurrentEnd - renderCurrentStart); // fade in last 0.5s atau durasi sisa
        renderNextAlpha = renderRemaining < renderFadeDuration ? 1 - (renderRemaining / renderFadeDuration) : 0;
    }
    if (renderNextText) {
        drawContext.font = `82px "${lyricsFont}", Inter, sans-serif`;
        drawContext.fillStyle = '#fff';
        drawContext.globalAlpha = renderNextAlpha;
        drawContext.fillText(renderNextText, lyricsPreviewWidth / 2, renderNextY);
    }

    drawContext.globalAlpha = 1.0;
}

const lyricsRenderLoop = () => {
    lyricsRender(elementAudio.currentTime * 1000, lyricsContext);

    lyricsRequestAnimationFrameID = requestAnimationFrame(lyricsRenderLoop);
}

const lyricsParse = (text) => {
    const lyricOutput = [];
    const lyricTimestamp = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const raw of text.split(/\r?\n/)) {
        const lyricLine = raw.trim();
        if (!lyricLine) {
            continue
        };

        lyricTimestamp.lastIndex = 0;
        let lyricMinute;
        let lyricLastIndex = 0;
        const lyricTime = [];
        while ((lyricMinute = lyricTimestamp.exec(lyricLine)) !== null) {
            const timeMinute = parseInt(lyricMinute[1], 10);
            const timeSecond = parseInt(lyricMinute[2], 10);
            const timeMilisecond = lyricMinute[3] ? parseInt((lyricMinute[3] + '00').slice(0, 3), 10) : 0;
            lyricTime.push(((timeMinute * 60) + timeSecond) * 1000 + timeMilisecond);
            lyricLastIndex = lyricTimestamp.lastIndex;
        }

        const lyricContent = lyricLine.slice(lyricLastIndex).trim();
        if (lyricTime.length) {
            for (const t of lyricTime) lyricOutput.push({
                timeMs: t,
                text: lyricContent
            })
        };
    }

    lyricOutput.sort((a, b) => a.timeMs - b.timeMs);

    return lyricOutput;
}

const lyricsPreviewStart = () => {
    if (lyricsRequestAnimationFrameID) {
        cancelAnimationFrame(lyricsRequestAnimationFrameID)
    };

    lyricsRequestAnimationFrameID = requestAnimationFrame(lyricsRenderLoop);
    lyricsIsPlaying = true;
}

const lyricsPreviewStop = () => {
    if (lyricsRequestAnimationFrameID) {
        cancelAnimationFrame(lyricsRequestAnimationFrameID);

        lyricsRequestAnimationFrameID = null;
        lyricsIsPlaying = false
    };
}

elementInputAudio.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    if (!file) {
        return
    };

    elementAudio.src = URL.createObjectURL(file);
    elementAudio.load();

    lyricsFileName = `${file.name.replace(/\.[^/.]+$/, '')}`;
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
    lyricsParsed = lyricsParse(elementTextareaLyrics.value);

    lyricsRender(elementAudio.currentTime * 1000, lyricsContext);
});

elementInputOffset.addEventListener('input', () => {
    if (!lyricsIsPlaying) {
        lyricsRender(elementAudio.currentTime * 1000, lyricsContext);
    }
});

elementInputBackground.addEventListener('change', (event) => {
    const file = event.target.files && event.target.files[0];
    lyricsBackground = null;

    if (!file) {
        return
    };

    const url = URL.createObjectURL(file);
    if (file.type.startsWith('image/')) {
        const fileImage = new Image();
        fileImage.src = url;
        fileImage.onload = () => {
            lyricsBackground = {
                type: 'image',
                el: fileImage
            };

            lyricsRender(elementAudio.currentTime * 1000, lyricsContext);
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

            lyricsBackground = {
                type: 'video',
                el: fileVideo
            };

            lyricsRender(elementAudio.currentTime * 1000, lyricsContext);
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
    lyricsIsRecording = true;

    try {
        // ensure font is ready before export
        await ensureAudioReady(elementAudio);

        // prepare offscreen canvas
        const canvas = document.createElement('canvas');
        canvas.width = lyricsPreviewWidth;
        canvas.height = lyricsPreviewHeight;

        const cctx = canvas.getContext('2d', {
            alpha: true
        });

        // capture streams and audio
        const canvasStream = canvas.captureStream(lyricsFPS);
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
            a.download = `${lyricsFileName}.webm`; // pake nama file audio
            a.click();
            URL.revokeObjectURL(url);

            elementButtonExport.disabled = false;
            elementButtonExport.textContent = 'Export';
            lyricsIsRecording = false;
        };

        // start recording & play audio from 0
        recorder.start();
        elementAudio.currentTime = 0;
        await elementAudio.play();

        // render loop (use same lyricsRender, but with cctx)
        const frameInterval = Math.round(1000 / lyricsFPS);
        const renderInterval = setInterval(() => {
            // draw background (if video/image present draw it in lyricsRender)
            // call lyricsRender with current audio time using cctx
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

        lyricsIsRecording = false;
    }
});

elementAudio.addEventListener('play', lyricsPreviewStart);
elementAudio.addEventListener('pause', lyricsPreviewStop);
elementAudio.addEventListener('seeked', () => lyricsRender(elementAudio.currentTime * 1000, lyricsContext));

// example initial LRC
elementTextareaLyrics.value = '[00:00.00] Intro\n[00:05.00] First lyric line\n[00:10.00] Second lyric line\n[00:15.00] Third lyric line';
lyricsParsed = lyricsParse(elementTextareaLyrics.value);
lyricsRender(0, lyricsContext);

window.addEventListener('beforeunload', (event) => {
    if (lyricsIsRecording) {
        event.preventDefault();
        // Chrome/Edge butuh returnValue
        event.returnValue = '';

        return '';
    }
});