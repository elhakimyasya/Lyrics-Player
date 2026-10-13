const STORAGE_KEY = 'lyrics_player_editor_data_v14';
const LEGACY_STORAGE_KEY = ['s', 'a', 'y', 'a', 't', 'o', 'o', '_karaoke_data_v14'].join('');
const MEDIA_DB_NAME = 'lyrics_player_editor_media_v1';
const LEGACY_MEDIA_DB_NAME = ['s', 'a', 'y', 'a', 't', 'o', 'o', '_karaoke_media_v1'].join('');
const MEDIA_STORE_NAME = 'files';

let audio = document.getElementById('main-audio');
let bgVideo = document.getElementById('bg-video-element');
let bgImage = document.getElementById('bg-image-element');
let stageCanvas = document.getElementById('preview-stage-canvas');
let stageCtx = stageCanvas ? stageCanvas.getContext('2d') : null;

let audioCtx = null;
let analyser = null;
let audioSource = null;
let freqDataArray = null;

let bgMediaType = null;
let bgMediaLoaded = false;
let audioFileMeta = null;
let bgFileMeta = null;

let tokens = [];
let linesData = [];
let songEndMarkers = [];
let currentTokenIndex = 0;
let undoStack = [];
let lyricsDebounceTimer = null;

let timelineZoomPxPerSec = 100;
let confirmCallback = null;
let isMagnetSnapEnabled = true;

let isRecordingSpacePressed = false;
let spacePressStartTime = 0;
let isPreviewMode = false;
let recordPlaybackSpeed = 1.0;

let isExportingVideo = false;
let mediaRecorder = null;
let recordedChunks = [];

let lineOpacities = {};
let backgroundFadeAlpha = 0.35;

let stageStyles = {
    bg: '#000000',
    text: '#ffffff',
    fill: '#ffde59',
    fontFamily: 'Nexa Black',
    fontSize: 48,
    resolution: '1080p',
};

const spectrumSettings = {
    barsCount: 80,
    barGap: 3,
    maxHeightRatio: 0.12,
    threshold: 5,
    gradientStartAlpha: 0.1,
    gradientEndAlpha: 0.9,
    edgeScale: 0.98,
};

const defaultSampleLyrics = `Aku bernyanyi di malam ♪ HO-HO-HO ini
Menunggu bintang terang kembali
Bersama bayangmu dalam mimpi
[03:42.705]
[03:44.685]`;

const localStorageLoad = () => {
    const savedRaw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (savedRaw) {
        try {
            const data = JSON.parse(savedRaw);
            if (data.rawInput !== undefined) document.getElementById('raw-lyrics-input').value = data.rawInput;
            if (data.splitByWord !== undefined) document.getElementById('split-by-word-checkbox').checked = data.splitByWord;
            if (data.headerText !== undefined) document.getElementById('header-text-input').value = data.headerText;
            if (data.footerText !== undefined) document.getElementById('footer-text-input').value = data.footerText;
            audioFileMeta = data.audioFileMeta || null;
            bgFileMeta = data.bgFileMeta || null;
            restorePersistedMedia(data);

            if (data.tokens && data.tokens.length > 0) {
                tokens = data.tokens;
                linesData = data.linesData || [];
                songEndMarkers = data.songEndMarkers || [];
                currentTokenIndex = data.currentTokenIndex || 0;
            }
            if (data.stageStyles) {
                stageStyles = { ...stageStyles, ...data.stageStyles };
                document.getElementById('picker-bg-color').value = stageStyles.bg || '#000000';
                document.getElementById('picker-text-color').value = stageStyles.text || '#ffffff';
                document.getElementById('picker-fill-color').value = stageStyles.fill || '#ffde59';
                document.getElementById('picker-font-family').value = stageStyles.fontFamily || 'Nexa Black';
                if (stageStyles.fontSize) {
                    document.getElementById('picker-font-size').value = stageStyles.fontSize;
                }
                if (stageStyles.resolution) {
                    changeCanvasResolution(stageStyles.resolution, false);
                }
            }
            if (data.recordPlaybackSpeed) {
                recordPlaybackSpeed = parseFloat(data.recordPlaybackSpeed) || 1.0;
                document.getElementById('custom-speed-slider').value = recordPlaybackSpeed;
                document.getElementById('custom-speed-input').value = recordPlaybackSpeed.toFixed(2);
            }
        } catch (e) {
            console.error('LocalStorage load error:', e);
        }
    }

    if (tokens.length === 0) {
        document.getElementById('raw-lyrics-input').value = defaultSampleLyrics;
        document.getElementById('header-text-input').value = '~ Lyrics Player Editor ~\n~ High Definition Audio ~';
        document.getElementById('footer-text-input').value = 'Producer & Arranger: Music Studio\nOfficial Exporter Engine';
        parseLyricsFromInput();
    } else {
        updateTokenCounts();
    }
};

window.addEventListener('load', () => {
    localStorageLoad();

    setupKeyboardListeners();
    setupAudioEvents();
    setupTapButtonEvents();
    startCanvasRenderLoop();
    startSmoothAnimationLoop();
});

function normalizeText(text) {
    if (!text) return '';

    return text
        .normalize('NFC')
        .replace(/\u00A0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseItalicParts(text) {
    const normalized = normalizeText(text);
    const parts = [];
    // Match complete parentheses and also the split-token forms: "(Tapi" and "tau)".
    const regex = /\([^)]*\)|\([^()]*$|^[^()]*\)/g;

    let lastIndex = 0;
    let match;

    while ((match = regex.exec(normalized)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                text: normalized.substring(lastIndex, match.index),
                italic: false,
            });
        }

        parts.push({
            text: match[0],
            italic: true,
        });

        lastIndex = regex.lastIndex;
    }

    // Teks setelah kurung
    if (lastIndex < normalized.length) {
        const remaining = normalized.substring(lastIndex);
        if (remaining === '(') {
            parts.push({ text: '(', italic: true });
        } else if (remaining === ')') {
            parts.push({ text: ')', italic: true });
        } else {
            parts.push({
                text: remaining,
                italic: false,
            });
        }
    }

    return parts.length > 0
        ? parts
        : [
            {
                text: normalized,
                italic: false,
            },
        ];
}

function splitTextKeepParentheses(text) {
    // Keep each word as a separate timing block, including words inside parentheses.
    return text.match(/\S+/g) || [];
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `px-4 py-2 rounded-lg text-xs font-bold border shadow-xl transition-all duration-300 transform translate-y-2 opacity-0 pointer-events-auto ${type === 'success' ? 'bg-emerald-950 border-emerald-600 text-emerald-200' : type === 'error' ? 'bg-red-950 border-red-600 text-red-200' : 'bg-zinc-900 border-zinc-700 text-amber-400'}`;
    toast.innerText = msg;
    container.appendChild(toast);

    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 1000);
}

function initAudioContext() {
    if (!audioCtx) {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
            analyser = audioCtx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.1;
            analyser.minDecibels = -90;
            analyser.maxDecibels = -10;
            freqDataArray = new Uint8Array(analyser.frequencyBinCount);

            audioSource = audioCtx.createMediaElementSource(audio);
            audioSource.connect(analyser);
            analyser.connect(audioCtx.destination);
        } catch (e) {
            console.log('AudioContext note:', e);
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function openConfirmModal(title, msg, onConfirm) {
    document.getElementById('confirm-modal-title').innerText = title;
    document.getElementById('confirm-modal-message').innerText = msg;
    confirmCallback = onConfirm;
    document.getElementById('confirm-modal').classList.remove('hidden');
}

function closeConfirmModal(accepted) {
    document.getElementById('confirm-modal').classList.add('hidden');
    if (accepted && confirmCallback) confirmCallback();
    confirmCallback = null;
}

function toggleMagnetSnap() {
    isMagnetSnapEnabled = !isMagnetSnapEnabled;
    const btn = document.getElementById('btn-toggle-snap');
    if (isMagnetSnapEnabled) {
        btn.className = 'flex items-center gap-1 rounded border border-sky-600/60 bg-sky-950/60 px-2.5 py-0.5 text-[11px] font-bold text-sky-300 transition';
        btn.innerHTML = `<i class="fa-solid fa-magnet"></i> Snap: ON`;
        showToast('Magnet snap enabled', 'success');
    } else {
        btn.className = 'flex items-center gap-1 rounded border border-zinc-800 bg-zinc-900 px-2.5 py-0.5 text-[11px] font-bold text-zinc-500 transition';
        btn.innerHTML = `<i class="fa-solid fa-magnet"></i> Snap: OFF`;
        showToast('Magnet snap disabled');
    }
}

function saveToLocalStorage() {
    const dataToSave = {
        rawInput: document.getElementById('raw-lyrics-input').value,
        splitByWord: document.getElementById('split-by-word-checkbox').checked,
        headerText: document.getElementById('header-text-input').value,
        footerText: document.getElementById('footer-text-input').value,
        tokens: tokens,
        linesData: linesData,
        songEndMarkers: songEndMarkers,
        currentTokenIndex: currentTokenIndex,
        stageStyles: stageStyles,
        recordPlaybackSpeed: recordPlaybackSpeed,
        audioFileMeta: audioFileMeta,
        bgFileMeta: bgFileMeta,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
}

function openMediaDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(MEDIA_DB_NAME, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(MEDIA_STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function saveMediaFile(key, file) {
    const database = await openMediaDatabase();
    await new Promise((resolve, reject) => {
        const transaction = database.transaction(MEDIA_STORE_NAME, 'readwrite');
        transaction.objectStore(MEDIA_STORE_NAME).put(file, key);
        transaction.oncomplete = resolve;
        transaction.onerror = () => reject(transaction.error);
    });
    database.close();
}

async function loadMediaFile(key) {
    const database = await openMediaDatabase();
    const file = await new Promise((resolve, reject) => {
        const transaction = database.transaction(MEDIA_STORE_NAME, 'readonly');
        const request = transaction.objectStore(MEDIA_STORE_NAME).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    database.close();
    return file;
}

async function deletePersistedMedia() {
    try {
        const database = await openMediaDatabase();
        await new Promise((resolve, reject) => {
            const transaction = database.transaction(MEDIA_STORE_NAME, 'readwrite');
            transaction.objectStore(MEDIA_STORE_NAME).clear();
            transaction.oncomplete = resolve;
            transaction.onerror = () => reject(transaction.error);
        });
        database.close();
    } catch (error) {
        console.error('Media persistence delete error:', error);
    }
}

function setAudioFile(file, fileName = file.name) {
    if (audio.src) URL.revokeObjectURL(audio.src);
    audio.src = URL.createObjectURL(file);
    audioFileMeta = { name: fileName, type: file.type };
    document.getElementById('audio-file-name').innerText = fileName;
}

function setBackgroundFile(file, fileName = file.name) {
    const url = URL.createObjectURL(file);
    document.getElementById('bg-file-name').innerText = fileName;
    bgFileMeta = { name: fileName, type: file.type };
    bgMediaLoaded = false;

    if (bgMediaType === 'video' && bgVideo.src) URL.revokeObjectURL(bgVideo.src);
    if (bgMediaType === 'image' && bgImage.src) URL.revokeObjectURL(bgImage.src);

    if (file.type.startsWith('video/')) {
        bgMediaType = 'video';
        bgVideo.src = url;
        bgVideo.onloadedmetadata = () => {
            bgMediaLoaded = true;
            if (!bgVideo.paused) bgVideo.play();
            showToast('Background video loaded!', 'success');
        };
    } else if (file.type.startsWith('image/')) {
        bgMediaType = 'image';
        bgImage.src = url;
        bgImage.onload = () => {
            bgMediaLoaded = true;
            showToast('Background image loaded!', 'success');
        };
    }
}

async function restorePersistedMedia(data) {
    try {
        if (data.audioFileMeta) {
            const audioFile = await loadMediaFile('audio');
            if (audioFile) setAudioFile(audioFile, data.audioFileMeta.name);
        }
        if (data.bgFileMeta) {
            const bgFile = await loadMediaFile('background');
            if (bgFile) setBackgroundFile(bgFile, data.bgFileMeta.name);
        }
    } catch (error) {
        console.error('Media persistence load error:', error);
    }
}

function onLyricsPaste(e) {
    setTimeout(() => {
        parseLyricsFromInput();
        showToast('Subtitle parsed and rendered successfully!', 'success');
    }, 50);
}

function onLyricsInputChanged() {
    clearTimeout(lyricsDebounceTimer);
    lyricsDebounceTimer = setTimeout(() => {
        parseLyricsFromInput();
    }, 300);
}

function confirmResetAllPersistence() {
    openConfirmModal('Reset All Data', 'Are you sure you want to delete all lyrics and reset the project?', () => {
        localStorage.removeItem(STORAGE_KEY);
        deletePersistedMedia();
        location.reload();
    });
}

async function handleAudioUpload(event) {
    const file = event.target.files[0];
    if (file) {
        setAudioFile(file);
        await saveMediaFile('audio', file);
        initAudioContext();
        showToast('Audio file loaded!', 'success');
        saveToLocalStorage();
        render2TrackTimeline();
    }
}

async function handleBgUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    setBackgroundFile(file);
    await saveMediaFile('background', file);
    saveToLocalStorage();
}

function changeCanvasResolution(resKey, save = true) {
    stageStyles.resolution = '1080p';
    stageCanvas.width = 1920;
    stageCanvas.height = 1080;
    if (save) {
        saveToLocalStorage();
        showToast('Canvas resolution set to 1080p');
    }
}

function parseLyricsFromInput() {
    const rawText = document.getElementById('raw-lyrics-input').value.trim();
    const splitByWord = document.getElementById('split-by-word-checkbox').checked;

    if (!rawText) return;

    pushUndoState();
    tokens = [];
    linesData = [];
    songEndMarkers = [];

    const isASS = /Dialogue:\s*\d+/i.test(rawText);
    const isSRT = /^\d+\r?\n\d{2}:\d{2}:\d{2}[,\.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,\.]\d{3}/m.test(rawText);

    if (isASS) {
        parseASSContent(rawText, splitByWord);
    } else if (isSRT) {
        parseSRTContent(rawText, splitByWord);
    } else {
        parseLRCAndPlainContent(rawText, splitByWord);
    }

    if (currentTokenIndex >= tokens.length) {
        currentTokenIndex = Math.max(0, tokens.length - 1);
    }

    updateTokenCounts();
    render2TrackTimeline();
    saveToLocalStorage();
}

function parseASSContent(rawText, splitByWord) {
    const lines = rawText.split('\n');
    let currentLineIdx = 0;
    let tokenCounter = 0;

    lines.forEach((lineStr) => {
        const match = lineStr.match(/^Dialogue:\s*\d+,([^,]+),([^,]+),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),([^,]*),(.*)/i);
        if (!match) return;

        const startSec = parseAssTimeToSec(match[1].trim());
        const endSec = parseAssTimeToSec(match[2].trim());
        const rawDialogue = match[9].trim();

        const kTagRegex = /\\k[f|o]?(\d+)/gi;
        const hasKTags = kTagRegex.test(rawDialogue);

        let lineTokenIndices = [];

        if (hasKTags) {
            let cursorTime = startSec;
            const parts = rawDialogue.split(/(\{.*?\}\s*)/g).filter(Boolean);

            parts.forEach((part) => {
                const tagMatch = part.match(/\{.*\\k[f|o]?(\d+).*\}/i);
                let cleanText = part.replace(/\{.*?\}/g, '').trim();

                if (tagMatch) {
                    const centisecs = parseInt(tagMatch[1], 10);
                    const durationSec = centisecs * 0.01;
                    const wordStart = cursorTime;
                    const wordEnd = cursorTime + durationSec;
                    cursorTime = wordEnd;

                    if (cleanText) {
                        tokenCounter++;
                        tokens.push({
                            id: tokenCounter,
                            lineIndex: currentLineIdx,
                            text: normalizeText(cleanText),
                            start: parseFloat(wordStart.toFixed(3)),
                            end: parseFloat(wordEnd.toFixed(3)),
                        });
                        lineTokenIndices.push(tokens.length - 1);
                    }
                } else if (cleanText) {
                    tokenCounter++;
                    tokens.push({
                        id: tokenCounter,
                        lineIndex: currentLineIdx,
                        text: normalizeText(cleanText),
                        start: parseFloat(cursorTime.toFixed(3)),
                        end: parseFloat((cursorTime + 0.35).toFixed(3)),
                    });
                    lineTokenIndices.push(tokens.length - 1);
                }
            });
        } else {
            const cleanText = rawDialogue.replace(/\{.*?\}/g, '').trim();
            if (!cleanText) return;

            if (splitByWord) {
                // Split by words but keep parenthetical content together
                const words = splitTextKeepParentheses(cleanText);
                const totalDur = Math.max(0.3, endSec - startSec);
                const perWordDur = totalDur / Math.max(1, words.length);

                words.forEach((w, wIdx) => {
                    tokenCounter++;
                    const wStart = startSec + wIdx * perWordDur;
                    const wEnd = wStart + perWordDur;
                    tokens.push({
                        id: tokenCounter,
                        lineIndex: currentLineIdx,
                        text: normalizeText(w),
                        start: parseFloat(wStart.toFixed(3)),
                        end: parseFloat(wEnd.toFixed(3)),
                    });
                    lineTokenIndices.push(tokens.length - 1);
                });
            } else {
                tokenCounter++;
                tokens.push({
                    id: tokenCounter,
                    lineIndex: currentLineIdx,
                    text: normalizeText(cleanText),
                    start: parseFloat(startSec.toFixed(3)),
                    end: parseFloat(endSec.toFixed(3)),
                });
                lineTokenIndices.push(tokens.length - 1);
            }
        }

        if (lineTokenIndices.length > 0) {
            linesData.push(lineTokenIndices);
            currentLineIdx++;
        }
    });
}

function parseSRTContent(rawText, splitByWord) {
    const blocks = rawText.split(/\r?\n\r?\n/);
    let currentLineIdx = 0;
    let tokenCounter = 0;

    blocks.forEach((block) => {
        const srtMatch = block.match(/(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})\r?\n([\s\S]*)/);
        if (!srtMatch) return;

        const startSec = parseSrtTimeToSec(srtMatch[1].trim());
        const endSec = parseSrtTimeToSec(srtMatch[2].trim());
        const textContent = srtMatch[3]
            .replace(/<[^>]*>/g, '')
            .replace(/\r?\n/g, ' ')
            .trim();

        if (!textContent) return;

        let lineTokenIndices = [];

        if (splitByWord) {
            // Split by words but keep parenthetical content together
            const words = splitTextKeepParentheses(textContent);
            const totalDur = Math.max(0.3, endSec - startSec);
            const perWordDur = totalDur / Math.max(1, words.length);

            words.forEach((w, wIdx) => {
                tokenCounter++;
                const wStart = startSec + wIdx * perWordDur;
                const wEnd = wStart + perWordDur;
                tokens.push({
                    id: tokenCounter,
                    lineIndex: currentLineIdx,
                    text: normalizeText(w),
                    start: parseFloat(wStart.toFixed(3)),
                    end: parseFloat(wEnd.toFixed(3)),
                });
                lineTokenIndices.push(tokens.length - 1);
            });
        } else {
            tokenCounter++;
            tokens.push({
                id: tokenCounter,
                lineIndex: currentLineIdx,
                text: normalizeText(textContent),
                start: parseFloat(startSec.toFixed(3)),
                end: parseFloat(endSec.toFixed(3)),
            });
            lineTokenIndices.push(tokens.length - 1);
        }

        if (lineTokenIndices.length > 0) {
            linesData.push(lineTokenIndices);
            currentLineIdx++;
        }
    });
}

function parseLRCAndPlainContent(rawText, splitByWord) {
    const lines = rawText.split('\n');
    let currentLineIdx = 0;
    let tokenCounter = 0;

    lines.forEach((lineStr) => {
        lineStr = lineStr.replace(/\u00A0/g, ' ').trim();
        if (!lineStr) return;

        const emptyLrcMatch = lineStr.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*$/);
        if (emptyLrcMatch) {
            const mins = parseFloat(emptyLrcMatch[1]);
            const secs = parseFloat(emptyLrcMatch[2]);
            songEndMarkers.push(mins * 60 + secs);
            return;
        }

        const lrcMatch = lineStr.match(/^\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
        let lineStartTime = null;
        let textContent = lineStr;

        if (lrcMatch) {
            const mins = parseFloat(lrcMatch[1]);
            const secs = parseFloat(lrcMatch[2]);
            lineStartTime = mins * 60 + secs;
            textContent = normalizeText(lrcMatch[3]);
        }

        if (!textContent || textContent.length === 0) return;

        let lineTokenIndices = [];

        const enhancedTagRegex = /<(\d+):(\d+(?:\.\d+)?)>/g;
        if (enhancedTagRegex.test(textContent)) {
            enhancedTagRegex.lastIndex = 0;
            let lastIndex = 0;
            let tagMatch;
            let wordList = [];

            while ((tagMatch = enhancedTagRegex.exec(textContent)) !== null) {
                const wordTime = parseFloat(tagMatch[1]) * 60 + parseFloat(tagMatch[2]);
                const tagIndex = tagMatch.index;
                if (wordList.length > 0) {
                    const prevWord = wordList[wordList.length - 1];
                    prevWord.text = textContent.substring(lastIndex, tagIndex).trim();
                    prevWord.end = wordTime;
                }
                wordList.push({ start: wordTime, end: wordTime + 0.4, text: '' });
                lastIndex = enhancedTagRegex.lastIndex;
            }
            if (wordList.length > 0) {
                wordList[wordList.length - 1].text = textContent.substring(lastIndex).trim();
            }

            wordList.forEach((wObj) => {
                if (wObj.text) {
                    tokenCounter++;
                    tokens.push({
                        id: tokenCounter,
                        lineIndex: currentLineIdx,
                        text: normalizeText(wObj.text),
                        start: parseFloat(wObj.start.toFixed(3)),
                        end: parseFloat(wObj.end.toFixed(3)),
                    });
                    lineTokenIndices.push(tokens.length - 1);
                }
            });
        } else if (splitByWord) {
            // Split by words but keep parenthetical content together
            const words = splitTextKeepParentheses(textContent);
            words.forEach((w, wIdx) => {
                tokenCounter++;
                const wordStart = lineStartTime !== null ? lineStartTime + wIdx * 0.45 : null;
                const wordEnd = wordStart !== null ? wordStart + 0.4 : null;

                tokens.push({
                    id: tokenCounter,
                    lineIndex: currentLineIdx,
                    text: normalizeText(w),
                    start: wordStart,
                    end: wordEnd,
                });
                lineTokenIndices.push(tokens.length - 1);
            });
        } else {
            tokenCounter++;
            tokens.push({
                id: tokenCounter,
                lineIndex: currentLineIdx,
                text: normalizeText(textContent),
                start: lineStartTime,
                end: lineStartTime !== null ? lineStartTime + 2.5 : null,
            });
            lineTokenIndices.push(tokens.length - 1);
        }

        if (lineTokenIndices.length > 0) {
            linesData.push(lineTokenIndices);
            currentLineIdx++;
        }
    });
}

function parseAssTimeToSec(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length < 3) return 0;
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    return h * 3600 + m * 60 + s;
}

function parseSrtTimeToSec(timeStr) {
    const normalized = timeStr.replace(',', '.');
    const parts = normalized.split(':');
    if (parts.length < 3) return 0;
    const h = parseFloat(parts[0]);
    const m = parseFloat(parts[1]);
    const s = parseFloat(parts[2]);
    return h * 3600 + m * 60 + s;
}

function switchTab(tabName) {
    ['setup', 'editor'].forEach((t) => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        document.getElementById(`btn-tab-${t}`).className = 'flex items-center gap-1.5 rounded-md px-3 py-1 font-semibold text-zinc-400 transition hover:text-zinc-200';
    });

    document.getElementById(`tab-${tabName}`).classList.remove('hidden');
    document.getElementById(`btn-tab-${tabName}`).className = 'flex items-center gap-1.5 rounded-md bg-amber-500 px-3 py-1 font-bold text-black shadow transition';

    if (tabName === 'editor') {
        render2TrackTimeline();
    }
}

function togglePreviewMode() {
    isPreviewMode = !isPreviewMode;
    const badge = document.getElementById('mode-text-badge');
    const btn = document.getElementById('btn-mode-toggle');

    if (isPreviewMode) {
        badge.innerText = 'PREVIEW MODE';
        btn.className = 'flex items-center gap-1.5 rounded-md border border-emerald-600/50 bg-emerald-950/60 px-3 py-1.5 text-xs font-bold text-emerald-300 transition hover:bg-emerald-900';
        audio.playbackRate = 1.0;
        document.getElementById('speed-control-container').classList.add('opacity-40', 'pointer-events-none');
        showToast('Preview mode (fade enabled, Space: play/pause)');
    } else {
        badge.innerText = 'EDIT MODE';
        btn.className = 'flex items-center gap-1.5 rounded-md border border-amber-600/50 bg-amber-950/60 px-3 py-1.5 text-xs font-bold text-amber-200 transition hover:bg-amber-900';
        audio.playbackRate = recordPlaybackSpeed;
        document.getElementById('speed-control-container').classList.remove('opacity-40', 'pointer-events-none');
        showToast('Edit mode (fade disabled for lyric editing)');
    }
}

function onCustomSpeedChange(val) {
    let num = parseFloat(val);
    if (isNaN(num)) num = 1.0;
    num = Math.max(0.25, Math.min(2.0, num));

    recordPlaybackSpeed = num;
    document.getElementById('custom-speed-slider').value = num;
    document.getElementById('custom-speed-input').value = num.toFixed(2);

    if (!isPreviewMode) audio.playbackRate = num;
    saveToLocalStorage();
}

function applyCustomStyles() {
    stageStyles.bg = document.getElementById('picker-bg-color').value;
    stageStyles.text = document.getElementById('picker-text-color').value;
    stageStyles.fill = document.getElementById('picker-fill-color').value;
    stageStyles.fontFamily = document.getElementById('picker-font-family').value;
    stageStyles.fontSize = parseInt(document.getElementById('picker-font-size').value) || 80;
    saveToLocalStorage();
}

function updateTokenCounts() {
    document.getElementById('total-tokens-count').innerText = tokens.length;
    document.getElementById('active-token-index').innerText = tokens.length > 0 ? currentTokenIndex + 1 : 0;
}

function pushUndoState() {
    if (tokens.length > 0) {
        undoStack.push(JSON.stringify(tokens));
        if (undoStack.length > 30) undoStack.shift();
    }
}

function undoTiming() {
    if (undoStack.length > 0) {
        tokens = JSON.parse(undoStack.pop());
        if (currentTokenIndex > 0) currentTokenIndex--;
        updateTokenCounts();
        render2TrackTimeline();
        saveToLocalStorage();
        showToast('Undo complete');
    }
}

function cutActiveTokenAtPlayhead() {
    const curTime = audio.currentTime;
    if (tokens.length === 0 || currentTokenIndex >= tokens.length) return;

    const tok = tokens[currentTokenIndex];
    if (tok.start === null || curTime <= tok.start) {
        showToast('The playhead must be inside the active word range', 'error');
        return;
    }

    pushUndoState();
    tok.end = parseFloat(curTime.toFixed(3));
    render2TrackTimeline();
    saveToLocalStorage();
    showToast(`Word "${tok.text}" cut at ${curTime.toFixed(2)}s`, 'success');
}

function setupKeyboardListeners() {
    window.addEventListener('keydown', (e) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        if (e.code === 'Space') {
            e.preventDefault();
            if (isPreviewMode) {
                togglePlay();
            } else if (!isRecordingSpacePressed) {
                onSpaceDown();
            }
        } else if (e.code === 'KeyX') {
            e.preventDefault();
            cutActiveTokenAtPlayhead();
        } else if (e.code === 'ArrowLeft') {
            e.preventDefault();
            prevToken();
        } else if (e.code === 'ArrowRight') {
            e.preventDefault();
            nextToken();
        } else if (e.ctrlKey && e.code === 'KeyZ') {
            e.preventDefault();
            undoTiming();
        }
    });

    window.addEventListener('keyup', (e) => {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;

        if (e.code === 'Space' && !isPreviewMode) {
            e.preventDefault();
            if (isRecordingSpacePressed) onSpaceUp();
        }
    });
}

function setupTapButtonEvents() {
    const handleStart = (e) => {
        e.preventDefault();
        if (isPreviewMode) {
            togglePlay();
        } else if (!isRecordingSpacePressed) {
            onSpaceDown();
        }
    };

    const handleEnd = (e) => {
        e.preventDefault();
        if (!isPreviewMode && isRecordingSpacePressed) {
            onSpaceUp();
        }
    };
}

function isInstrumentalToken(token) {
    return Boolean(token && token.text && token.text.includes('♪'));
}

function skipInstrumentalTokens() {
    while (currentTokenIndex < tokens.length && isInstrumentalToken(tokens[currentTokenIndex])) {
        currentTokenIndex++;
    }
    updateTokenCounts();
}

function shiftFollowingTokensToAvoidOverlap(tokenIdx, minimumStart) {
    const currentLineIdx = tokens[tokenIdx]?.lineIndex;
    if (currentLineIdx === undefined) return;

    for (let i = tokenIdx + 1; i < tokens.length; i++) {
        const nextWord = tokens[i];
        if (nextWord.lineIndex !== currentLineIdx) break;

        const nextStart = nextWord.start === null ? minimumStart : Math.max(nextWord.start, minimumStart);
        const delta = nextWord.start === null ? 0 : nextStart - nextWord.start;
        nextWord.start = parseFloat(nextStart.toFixed(3));
        if (nextWord.end !== null) {
            nextWord.end = parseFloat((nextWord.end + delta).toFixed(3));
        }
        minimumStart = Math.max(minimumStart, nextWord.end ?? nextWord.start + 0.1);
    }
}

function onSpaceDown() {
    initAudioContext();
    skipInstrumentalTokens();
    if (currentTokenIndex >= tokens.length) return;
    pushUndoState();
    isRecordingSpacePressed = true;
    spacePressStartTime = audio.currentTime;

    document.getElementById('space-state-text').innerText = 'SPACE: PRESSED';
    document.getElementById('space-state-text').className = 'animate-pulse rounded-full border border-amber-500/40 bg-amber-500/20 px-2.5 py-1 font-mono text-[11px] text-amber-400';

    if (currentTokenIndex < tokens.length) {
        // Set start time for current token
        tokens[currentTokenIndex].start = parseFloat(spacePressStartTime.toFixed(3));
        tokens[currentTokenIndex].end = parseFloat(spacePressStartTime.toFixed(3)) + 0.1;

        // Update previous token's end time ONLY if it's on the same line and has a start time
        if (currentTokenIndex > 0) {
            const prevWord = tokens[currentTokenIndex - 1];
            const currWord = tokens[currentTokenIndex];
            if (prevWord && prevWord.lineIndex === currWord.lineIndex && prevWord.start !== null) {
                prevWord.end = parseFloat(spacePressStartTime.toFixed(3));
            }
        }

        shiftFollowingTokensToAvoidOverlap(currentTokenIndex, tokens[currentTokenIndex].end);
        render2TrackTimeline();
    }
}

function onSpaceUp() {
    isRecordingSpacePressed = false;
    const spacePressEndTime = audio.currentTime;

    document.getElementById('space-state-text').innerText = 'SPACE: READY';
    document.getElementById('space-state-text').className = 'rounded-full border border-zinc-800 bg-black/80 px-2.5 py-1 font-mono text-[11px] text-zinc-400';

    if (currentTokenIndex < tokens.length) {
        tokens[currentTokenIndex].end = parseFloat(spacePressEndTime.toFixed(3));

        shiftFollowingTokensToAvoidOverlap(currentTokenIndex, tokens[currentTokenIndex].end);

        if (currentTokenIndex < tokens.length - 1) {
            currentTokenIndex++;
            skipInstrumentalTokens();
        }

        updateTokenCounts();
        render2TrackTimeline();
        saveToLocalStorage();
    }
}

function startCanvasRenderLoop() {
    function renderCanvas() {
        if (!stageCtx) {
            requestAnimationFrame(renderCanvas);
            return;
        }

        const width = stageCanvas.width;
        const height = stageCanvas.height;
        const curTime = audio.currentTime;

        let isEndingState = false;
        let globalSongEndAlpha = 1.0;

        if (songEndMarkers.length >= 2) {
            const m1 = songEndMarkers[0];
            const m2 = songEndMarkers[1];
            if (curTime >= m1) {
                isEndingState = true;
                if (curTime < m2) {
                    globalSongEndAlpha = Math.max(0, 1 - (curTime - m1) / (m2 - m1));
                } else {
                    globalSongEndAlpha = 0.0;
                }
            }
        } else if (songEndMarkers.length === 1 && curTime >= songEndMarkers[0]) {
            isEndingState = true;
            globalSongEndAlpha = Math.max(0, 1 - (curTime - songEndMarkers[0]));
        }

        stageCtx.fillStyle = stageStyles.bg || '#000000';
        stageCtx.fillRect(0, 0, width, height);

        let activeToken = tokens[currentTokenIndex];

        if (isPreviewMode) {
            for (let i = 0; i < tokens.length; i++) {
                const tok = tokens[i];
                if (tok.start !== null && curTime >= tok.start) {
                    activeToken = tok;
                }
            }
        }

        const currentLineIdx = activeToken ? activeToken.lineIndex : 0;

        let isInstrumentalActive = false;
        let nextLyricStart = null;

        if (linesData[currentLineIdx]) {
            const lineTokens = linesData[currentLineIdx].map((idx) => tokens[idx]);
            isInstrumentalActive = lineTokens.some((t) => t && t.text.includes('♪'));
            nextLyricStart = findNextLyricStart(currentLineIdx, curTime);
        }

        let targetBgOpacity = 0.0;
        if (isEndingState) {
            targetBgOpacity = 1.0;
        } else if (isInstrumentalActive) {
            targetBgOpacity = getInstrumentalBackgroundOpacity(nextLyricStart, curTime);
        }

        const isBackgroundFadingOut = targetBgOpacity < backgroundFadeAlpha;
        const fadeDistance = Math.abs(targetBgOpacity - backgroundFadeAlpha);
        const backgroundFadeRate = isBackgroundFadingOut ? 0.12 + fadeDistance * 0.08 : 0.045 + fadeDistance * 0.025;
        backgroundFadeAlpha += (targetBgOpacity - backgroundFadeAlpha) * backgroundFadeRate;

        if (bgMediaLoaded) {
            stageCtx.save();
            stageCtx.globalAlpha = backgroundFadeAlpha;
            if (bgMediaType === 'video' && bgVideo) {
                stageCtx.drawImage(bgVideo, 0, 0, width, height);
            } else if (bgMediaType === 'image' && bgImage) {
                stageCtx.drawImage(bgImage, 0, 0, width, height);
            }
            stageCtx.restore();
        }

        renderSpectrumBars(width, height);
        renderHeaderAndFooterOverlays(width, height, curTime);

        if (!isEndingState && globalSongEndAlpha > 0) {
            if (isPreviewMode) {
                renderSmoothKaraokeLyrics(width, height, curTime, currentLineIdx, isInstrumentalActive, nextLyricStart);
            } else {
                renderEditModeKaraokeLyrics(width, height, curTime, currentLineIdx);
            }
        }

        requestAnimationFrame(renderCanvas);
    }
    requestAnimationFrame(renderCanvas);
}

function findNextLyricStart(currentLineIdx, curTime) {
    for (let lineIdx = currentLineIdx + 1; lineIdx < linesData.length; lineIdx++) {
        const lineTokens = linesData[lineIdx].map((idx) => tokens[idx]).filter(Boolean);
        if (lineTokens.length === 0 || lineTokens.some((token) => isInstrumentalToken(token))) continue;

        const firstTimedToken = lineTokens.find((token) => token.start !== null);
        if (firstTimedToken && firstTimedToken.start >= curTime) {
            return firstTimedToken.start;
        }
    }
    return null;
}

function getInstrumentalBackgroundOpacity(nextLyricStart, curTime) {
    if (nextLyricStart === null) return 1.0;

    const secondsUntilLyric = Math.max(0, nextLyricStart - curTime);
    const fadeDuration = Math.min(5.0, Math.max(2.5, secondsUntilLyric * 0.75));

    if (secondsUntilLyric >= fadeDuration) return 1.0;
    const progress = Math.max(0, Math.min(1, secondsUntilLyric / fadeDuration));
    return progress * progress * (3 - 2 * progress);
}

function renderSpectrumBars(width, height) {
    if (!analyser || !freqDataArray) return;

    analyser.getByteFrequencyData(freqDataArray);

    const spectrumBarsCount = spectrumSettings.barsCount;
    const spectrumBinSize = Math.max(1, Math.floor(freqDataArray.length / spectrumBarsCount));
    const spectrumBarGap = spectrumSettings.barGap;
    const spectrumHalfWidth = width * 0.5;
    const spectrumBarWidth = spectrumHalfWidth / spectrumBarsCount;
    const spectrumMaxHeight = height * spectrumSettings.maxHeightRatio;
    const spectrumThreshold = spectrumSettings.threshold;
    const keyColor = stageStyles.fill || '#ffde59';

    const colorToRgba = (color, alpha) => {
        const hex = color.replace('#', '');
        const normalized =
            hex.length === 3
                ? hex
                    .split('')
                    .map((value) => value + value)
                    .join('')
                : hex;
        const red = parseInt(normalized.slice(0, 2), 16);
        const green = parseInt(normalized.slice(2, 4), 16);
        const blue = parseInt(normalized.slice(4, 6), 16);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    };

    const spectrumGradient = stageCtx.createLinearGradient(0, height, 0, height - spectrumMaxHeight);
    spectrumGradient.addColorStop(0, colorToRgba(keyColor, spectrumSettings.gradientStartAlpha));
    spectrumGradient.addColorStop(1, colorToRgba(keyColor, spectrumSettings.gradientEndAlpha));

    stageCtx.save();
    stageCtx.globalAlpha = 0.85;
    stageCtx.fillStyle = spectrumGradient;

    for (let index = 0; index < spectrumBarsCount; index++) {
        let frequencyMaxValue = 0;
        for (let binIndex = 0; binIndex < spectrumBinSize; binIndex++) {
            const frequencyValue = freqDataArray[index * spectrumBinSize + binIndex] || 0;
            frequencyMaxValue = Math.max(frequencyMaxValue, frequencyValue);
        }

        if (frequencyMaxValue < spectrumThreshold) frequencyMaxValue = 0;

        const spectrumScale = 1 - (index / Math.max(1, spectrumBarsCount - 1)) * spectrumSettings.edgeScale;
        const spectrumBarHeight = (frequencyMaxValue / 255) * spectrumMaxHeight * spectrumScale;
        const drawY = height - spectrumBarHeight;
        const drawWidth = Math.max(1, spectrumBarWidth - spectrumBarGap);

        const drawXLeft = index * spectrumBarWidth;
        stageCtx.fillRect(drawXLeft, drawY, drawWidth, spectrumBarHeight);

        const drawXRight = spectrumHalfWidth + (spectrumBarsCount - index - 1) * spectrumBarWidth;
        stageCtx.fillRect(drawXRight, drawY, drawWidth, spectrumBarHeight);
    }

    stageCtx.restore();
}

function renderHeaderAndFooterOverlays(width, height, curTime) {
    const headerRaw = document.getElementById('header-text-input').value.trim();
    const footerRaw = document.getElementById('footer-text-input').value.trim();

    const hLines = headerRaw.split('\n').filter((s) => s.trim().length > 0);
    const fLines = footerRaw.split('\n').filter((s) => s.trim().length > 0);

    const headerFontSize = 48;
    const footerFontSize = 32;
    const overlayVisibility = bgMediaLoaded ? Math.max(0, Math.min(1, 1 - backgroundFadeAlpha)) : 1;

    const baseOpacity = 0.6;

    stageCtx.save();
    stageCtx.textAlign = 'center';

    // --- HEADER ---
    if (hLines.length === 1) {
        // Single line: static color (text color), no cycling
        const headerColor = stageStyles.text;

        stageCtx.globalAlpha = Math.max(0, Math.min(1, baseOpacity * overlayVisibility));
        stageCtx.fillStyle = headerColor;
        stageCtx.font = `700 ${headerFontSize}px ${stageStyles.fontFamily}`;
        stageCtx.fillText(hLines[0], width / 2, 154);
    } else if (hLines.length > 1) {
        const cycleDuration = 4.0;
        const cycleIdx = Math.floor(curTime / cycleDuration) % hLines.length;
        let fadeAlpha = 1.0;
        if (isPreviewMode) {
            const phaseTime = curTime % cycleDuration;
            if (phaseTime < 0.5) fadeAlpha = phaseTime / 0.5;
            else if (phaseTime > cycleDuration - 0.5) fadeAlpha = (cycleDuration - phaseTime) / 0.5;
        }

        // Color follows text change: alternate between text and fill color per line
        const headerColor = cycleIdx % 2 === 0 ? stageStyles.text : stageStyles.fill;

        // Mengalikan 0.7 dengan fadeAlpha & overlayVisibility
        stageCtx.globalAlpha = Math.max(0, Math.min(1, baseOpacity * fadeAlpha * overlayVisibility));
        stageCtx.fillStyle = headerColor;
        stageCtx.font = `700 ${headerFontSize}px ${stageStyles.fontFamily}`;
        stageCtx.fillText(hLines[cycleIdx], width / 2, 154);
    }

    // --- FOOTER ---
    if (fLines.length === 1) {
        // Single line: static color (text color), no cycling
        const footerColor = stageStyles.text;

        stageCtx.globalAlpha = Math.max(0, Math.min(1, baseOpacity * overlayVisibility));
        stageCtx.fillStyle = footerColor;
        stageCtx.font = `700 ${footerFontSize}px ${stageStyles.fontFamily}`;
        stageCtx.fillText(fLines[0], width / 2, height - 132);
    } else if (fLines.length > 1) {
        const cycleDuration = 4.0;
        const cycleIdx = Math.floor(curTime / cycleDuration) % fLines.length;
        let fadeAlpha = 1.0;
        if (isPreviewMode) {
            const phaseTime = curTime % cycleDuration;
            if (phaseTime < 0.5) fadeAlpha = phaseTime / 0.5;
            else if (phaseTime > cycleDuration - 0.5) fadeAlpha = (cycleDuration - phaseTime) / 0.5;
        }

        // Color follows text change: alternate between text and fill color per line
        const footerColor = cycleIdx % 2 === 0 ? stageStyles.text : stageStyles.fill;

        // Mengalikan 0.7 dengan fadeAlpha & overlayVisibility
        stageCtx.globalAlpha = Math.max(0, Math.min(1, baseOpacity * fadeAlpha * overlayVisibility));
        stageCtx.fillStyle = footerColor;
        stageCtx.font = `700 ${footerFontSize}px ${stageStyles.fontFamily}`;
        stageCtx.fillText(fLines[cycleIdx], width / 2, height - 132);
    }

    stageCtx.restore();
}
function renderEditModeKaraokeLyrics(width, height, curTime, activeLineIdx) {
    const surroundingLines = [activeLineIdx - 1, activeLineIdx, activeLineIdx + 1].filter((idx) => idx >= 0 && idx < linesData.length);

    surroundingLines.forEach((lIdx) => {
        const yPos = lIdx === activeLineIdx ? height * 0.52 : lIdx < activeLineIdx ? height * 0.4 : height * 0.64;

        stageCtx.save();
        stageCtx.globalAlpha = lIdx === activeLineIdx ? 1.0 : 0.35;
        renderCanvasKaraokeLine(lIdx, yPos, lIdx === activeLineIdx, curTime);
        stageCtx.restore();
    });
}

function renderSmoothKaraokeLyrics(width, height, curTime, activeLineIdx, isInstrumental, nextLyricStart) {
    // Determine which lines should be active; show the active line and the next line.
    linesData.forEach((tokenIndices, lIdx) => {
        let targetAlpha = 0.0;

        const lineTokens = tokenIndices.map((idx) => tokens[idx]).filter(Boolean);
        if (lineTokens.length === 0) return;

        const hasTimestamps = lineTokens.some((t) => t.start !== null);

        if (hasTimestamps) {
            let lineStart = lineTokens[0].start !== null ? lineTokens[0].start : 0;
            let lastTok = lineTokens[lineTokens.length - 1];
            let lineEnd = lastTok.end !== null ? lastTok.end : lineStart + 1.5;

            // A line is active when it is the current line or the following line.
            const isCurrentOrNextLine = lIdx === activeLineIdx || lIdx === activeLineIdx + 1;
            const isNextLyricLine = isInstrumental && lIdx > activeLineIdx && lineStart === nextLyricStart;
            const secondsUntilNextLyric = nextLyricStart === null ? Infinity : Math.max(0, nextLyricStart - curTime);
            const lyricFadeLeadTime = Math.min(1.5, Math.max(0.7, secondsUntilNextLyric * 0.35));

            if (!isInstrumental && isCurrentOrNextLine) {
                targetAlpha = 1.0;
            } else if (isNextLyricLine && secondsUntilNextLyric <= lyricFadeLeadTime) {
                targetAlpha = 1 - secondsUntilNextLyric / lyricFadeLeadTime;
            } else {
                targetAlpha = 0.0;
            }
        } else {
            if (!isInstrumental && (lIdx === activeLineIdx || lIdx === activeLineIdx + 1)) {
                targetAlpha = 1.0;
            } else {
                targetAlpha = 0.0;
            }
        }

        if (lineOpacities[lIdx] === undefined) lineOpacities[lIdx] = 0.0;

        const isLineFadingIn = targetAlpha > lineOpacities[lIdx];
        const lineFadeDistance = Math.abs(targetAlpha - lineOpacities[lIdx]);
        const lineFadeRate = isLineFadingIn ? 0.08 + lineFadeDistance * 0.04 : 0.16 + lineFadeDistance * 0.08;
        lineOpacities[lIdx] += (targetAlpha - lineOpacities[lIdx]) * lineFadeRate;

        const opacity = lineOpacities[lIdx];
        // Ignore negligible opacity to prevent residual transparent rendering.
        if (opacity > 0.01) {
            stageCtx.save();
            stageCtx.globalAlpha = Math.max(0, Math.min(1, opacity));

            // Keep the two lyric slots stable above and below the center.
            const yPos = lIdx % 2 === 0 ? height * 0.46 : height * 0.58;

            renderCanvasKaraokeLine(lIdx, yPos, lIdx === activeLineIdx, curTime);
            stageCtx.restore();
        }
    });
}

function renderCanvasKaraokeLine(lineIdx, yPos, isActiveLine, curTime) {
    if (lineIdx < 0 || lineIdx >= linesData.length) return;

    const tokenIndices = linesData[lineIdx];
    if (!tokenIndices || tokenIndices.length === 0) return;

    const width = stageCanvas.width;
    const scaleFactor = 1;
    const fontSize = stageStyles.fontSize || 48;
    const fontFamily = stageStyles.fontFamily;

    stageCtx.save();
    let italicBlockActive = false;

    /*
     * =====================================================
     * BUILD WORD DATA
     * =====================================================
     *
     * Contoh:
     * "Aku (HO-HO-HO) ini"
     *
     * akan menjadi:
     *
     * Aku              normal
     * (                normal
     * HO-HO-HO         italic
     * )                normal
     * ini              normal
     */

    const wordDataList = tokenIndices
        .map((tIdx) => {
            const tok = tokens[tIdx];

            if (!tok) return null;

            const cleanText = tok.text.replace(/♪/g, '').trim();

            if (!cleanText) return null;

            const text = normalizeText(cleanText);
            const startsItalicBlock = text.startsWith('(');
            const endsItalicBlock = text.endsWith(')');
            const tokenIsItalic = italicBlockActive || startsItalicBlock;
            if (endsItalicBlock) italicBlockActive = false;
            else if (startsItalicBlock || tokenIsItalic) italicBlockActive = true;

            // Apply italic to every token between the opening and closing parenthesis.
            const parts = tokenIsItalic
                ? [{ text, italic: true }]
                : parseItalicParts(text);

            let textWidth = 0;

            parts.forEach((part) => {
                stageCtx.font = `${part.italic ? 'italic ' : ''}900 ${fontSize}px ${fontFamily}`;

                textWidth += stageCtx.measureText(part.text).width;
            });

            // Spasi antar token
            stageCtx.font = `900 ${fontSize}px ${fontFamily}`;

            const spaceWidth = stageCtx.measureText(' ').width;

            const w = textWidth + spaceWidth;

            return {
                tIdx,
                tok,
                text,
                parts,
                w,
            };
        })
        .filter(Boolean);

    if (wordDataList.length === 0) {
        stageCtx.restore();
        return;
    }

    /*
     * =====================================================
     * CENTER LINE
     * =====================================================
     */

    const totalLineWidth = wordDataList.reduce((sum, item) => sum + item.w, 0);

    let startX = (width - totalLineWidth) / 2;

    /*
     * =====================================================
     * DRAW EACH TOKEN
     * =====================================================
     */

    wordDataList.forEach((item) => {
        const { tIdx, tok, parts, w } = item;

        /*
         * =================================================
         * KARAOKE FILL %
         * =================================================
         */

        let fillPct = 0;

        if (!isPreviewMode) {
            if (tIdx < currentTokenIndex) {
                fillPct = 100;
            } else if (tIdx === currentTokenIndex && isRecordingSpacePressed) {
                fillPct = 100;
            }
        } else {
            if (tok.start !== null) {
                if (curTime < tok.start) {
                    fillPct = 0;
                } else if (tok.end !== null && curTime >= tok.end) {
                    fillPct = 100;
                } else if (tok.end !== null && curTime >= tok.start && curTime < tok.end) {
                    fillPct = ((curTime - tok.start) / (tok.end - tok.start)) * 100;
                } else if (curTime >= tok.start && tok.end === null) {
                    fillPct = 100;
                }
            }
        }

        fillPct = Math.max(0, Math.min(100, fillPct));

        /*
         * =================================================
         * DRAW BASE TEXT
         * =================================================
         */

        let segmentX = startX;

        parts.forEach((part) => {
            stageCtx.font = `${part.italic ? 'italic ' : ''}900 ${fontSize}px ${fontFamily}`;

            stageCtx.fillStyle = stageStyles.text || '#ffffff';

            stageCtx.fillText(part.text, segmentX, yPos);

            segmentX += stageCtx.measureText(part.text).width;
        });

        /*
         * =================================================
         * DRAW KARAOKE FILL
         * =================================================
         */

        if (fillPct > 0) {
            stageCtx.save();

            stageCtx.beginPath();

            stageCtx.rect(startX, yPos - 100 * scaleFactor, (w * fillPct) / 100, 180 * scaleFactor);

            stageCtx.clip();

            segmentX = startX;

            parts.forEach((part) => {
                stageCtx.font = `${part.italic ? 'italic ' : ''}900 ${fontSize}px ${fontFamily}`;

                stageCtx.lineWidth = 8 * scaleFactor;

                stageCtx.strokeStyle = '#000000';

                stageCtx.strokeText(part.text, segmentX, yPos);

                stageCtx.fillStyle = stageStyles.fill || '#ffde59';

                stageCtx.fillText(part.text, segmentX, yPos);

                segmentX += stageCtx.measureText(part.text).width;
            });

            stageCtx.restore();
        }

        /*
         * Spacing antar token
         */
        startX += w;
    });

    stageCtx.restore();
}

function setupAudioEvents() {
    audio.ontimeupdate = () => {
        const curr = audio.currentTime;
        const dur = audio.duration || 0;

        document.getElementById('current-time-display').innerText = formatTime(curr);
        document.getElementById('duration-display').innerText = formatTime(dur);

        if (dur > 0) {
            document.getElementById('audio-seekbar').value = (curr / dur) * 100;
        }

        if (isRecordingSpacePressed) {
            const duration = (curr - spacePressStartTime).toFixed(3);
            document.getElementById('syllable-timer').innerText = `${duration}s`;
        } else {
            document.getElementById('syllable-timer').innerText = `0.000s`;
        }

        if (bgMediaType === 'video' && bgVideo && !bgVideo.paused) {
            if (Math.abs(bgVideo.currentTime - curr) > 0.3) {
                bgVideo.currentTime = curr;
            }
        }
    };

    audio.onplay = () => {
        initAudioContext();
        document.getElementById('btn-play-pause').innerHTML = `<i class="fa-solid fa-pause"></i>`;
        document.getElementById('recording-dot').className = 'h-2 w-2 animate-ping rounded-full bg-emerald-500';
        document.getElementById('recording-status-text').innerText = isPreviewMode ? 'PREVIEWING' : 'PLAYING';
        if (bgMediaType === 'video' && bgVideo) bgVideo.play();
    };

    audio.onpause = () => {
        document.getElementById('btn-play-pause').innerHTML = `<i class="fa-solid fa-play"></i>`;
        document.getElementById('recording-dot').className = 'h-2 w-2 rounded-full bg-zinc-500';
        document.getElementById('recording-status-text').innerText = 'PAUSED';
        if (bgMediaType === 'video' && bgVideo) bgVideo.pause();
    };
}

function togglePlay() {
    if (!audio.src) {
        showToast('Please load an audio file in the Input tab first!', 'error');
        return;
    }
    initAudioContext();
    if (audio.paused) audio.play();
    else audio.pause();
}

function stopAudio() {
    audio.pause();
    audio.currentTime = 0;
}

function seekAudio(percent) {
    if (audio.duration) {
        const targetTime = (percent / 100) * audio.duration;
        audio.currentTime = targetTime;

        let targetTokenIndex = 0;
        for (let i = 0; i < tokens.length; i++) {
            const tok = tokens[i];
            if (tok.start !== null && targetTime >= tok.start) targetTokenIndex = i;
            if (tok.start !== null && targetTime < tok.start) break;
        }

        currentTokenIndex = targetTokenIndex;
        skipInstrumentalTokens();
        updateTokenCounts();
        highlightActiveBlockInTimeline();
    }
}

function prevToken() {
    if (currentTokenIndex > 0) {
        currentTokenIndex--;
        updateTokenCounts();
        highlightActiveBlockInTimeline();
        saveToLocalStorage();
    }
}

function nextToken() {
    if (currentTokenIndex < tokens.length - 1) {
        currentTokenIndex++;
        skipInstrumentalTokens();
        updateTokenCounts();
        highlightActiveBlockInTimeline();
        saveToLocalStorage();
    }
}

function confirmResetTimings() {
    openConfirmModal('Reset Timing', 'Are you sure you want to reset all timestamps?', () => {
        pushUndoState();
        tokens.forEach((t) => {
            t.start = null;
            t.end = null;
        });
        currentTokenIndex = 0;
        updateTokenCounts();
        render2TrackTimeline();
        saveToLocalStorage();
        showToast('All timing has been reset');
    });
}

function applyBulkOffset(offsetSec) {
    if (tokens.length === 0) return;

    let updatedCount = 0;
    pushUndoState();

    tokens.forEach((tok) => {
        if (tok.start !== null) {
            tok.start = Math.max(0, parseFloat((tok.start + offsetSec).toFixed(3)));
            updatedCount++;
        }
        if (tok.end !== null) {
            tok.end = Math.max(0, parseFloat((tok.end + offsetSec).toFixed(3)));
        }
    });

    if (updatedCount > 0) {
        render2TrackTimeline();
        saveToLocalStorage();
        showToast(`Offset ${offsetSec > 0 ? '+' : ''}${offsetSec}s applied (${updatedCount} words)`, 'success');
    } else {
        showToast('No word timestamps have been synchronized', 'error');
    }
}

function changeTimelineZoom(delta) {
    timelineZoomPxPerSec = Math.max(30, Math.min(250, timelineZoomPxPerSec + delta));
    document.getElementById('zoom-level-text').innerText = `${timelineZoomPxPerSec}px/s`;
    render2TrackTimeline();
}

function startSmoothAnimationLoop() {
    function loop() {
        updateTimelinePlayheadAndAutoScroll();

        if (isRecordingSpacePressed && currentTokenIndex < tokens.length) {
            tokens[currentTokenIndex].end = parseFloat(audio.currentTime.toFixed(3));
            shiftFollowingTokensToAvoidOverlap(currentTokenIndex, tokens[currentTokenIndex].end);

            const activeBlock = document.querySelector(`.timeline-clip-block[data-token-idx="${currentTokenIndex}"]`);
            if (activeBlock) {
                const startSec = tokens[currentTokenIndex].start;
                const endSec = tokens[currentTokenIndex].end;
                const durSec = Math.max(0.1, endSec - startSec);
                activeBlock.style.width = `${Math.max(28, durSec * timelineZoomPxPerSec)}px`;
            }

            // Move following blocks live while Space is held, so they never overlap.
            for (let index = currentTokenIndex + 1; index < tokens.length; index++) {
                const token = tokens[index];
                if (token.lineIndex !== tokens[currentTokenIndex].lineIndex) break;
                const block = document.querySelector(`.timeline-clip-block[data-token-idx="${index}"]`);
                if (!block || token.start === null) continue;
                const endSec = token.end !== null ? token.end : token.start + 0.4;
                block.style.left = `${token.start * timelineZoomPxPerSec}px`;
                block.style.width = `${Math.max(28, (endSec - token.start) * timelineZoomPxPerSec)}px`;
            }
        }

        requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
}

function updateTimelinePlayheadAndAutoScroll() {
    const playhead = document.getElementById('timeline-playhead');
    const scrollContainer = document.getElementById('timeline-scroll-container');

    if (playhead && scrollContainer) {
        const posX = audio.currentTime * timelineZoomPxPerSec;
        playhead.style.left = `${posX}px`;

        if (!audio.paused) {
            const containerWidth = scrollContainer.clientWidth;
            const scrollLeft = scrollContainer.scrollLeft;

            if (posX < scrollLeft || posX > scrollLeft + containerWidth - 80) {
                scrollContainer.scrollLeft = Math.max(0, posX - containerWidth / 3);
            }
        }
    }
}

function highlightActiveBlockInTimeline() {
    document.querySelectorAll('.timeline-clip-block').forEach((b) => {
        const idx = parseInt(b.dataset.tokenIdx);
        if (idx === currentTokenIndex) {
            b.classList.add('active-word');
        } else {
            b.classList.remove('active-word');
        }
    });
}

function render2TrackTimeline() {
    const track0Container = document.getElementById('timeline-track-0');
    const track1Container = document.getElementById('timeline-track-1');
    const ruler = document.getElementById('timeline-ruler');
    const wrapper = document.getElementById('timeline-inner-wrapper');

    if (!track0Container || !track1Container || !ruler) return;

    const maxTime = Math.max(audio.duration || 60, tokens.reduce((max, t) => Math.max(max, t.end || 0, t.start || 0), 10) + 5);
    const totalWidthPx = Math.max(800, maxTime * timelineZoomPxPerSec);

    wrapper.style.width = `${totalWidthPx}px`;

    ruler.innerHTML = '';
    const stepSec = timelineZoomPxPerSec < 60 ? 5 : timelineZoomPxPerSec < 120 ? 2 : 1;
    for (let sec = 0; sec <= maxTime; sec += stepSec) {
        const mark = document.createElement('div');
        mark.className = 'absolute bottom-0 top-0 flex items-center border-l border-zinc-800 pl-1';
        mark.style.left = `${sec * timelineZoomPxPerSec}px`;
        mark.innerText = formatTime(sec);
        ruler.appendChild(mark);
    }

    track0Container.innerHTML = '<span class="pointer-events-none absolute left-1 top-0.5 z-10 font-mono text-[8px] font-bold text-zinc-600">TOP LINE</span>';
    track1Container.innerHTML = '<span class="pointer-events-none absolute left-1 top-0.5 z-10 font-mono text-[8px] font-bold text-zinc-600">BOTTOM LINE</span>';

    tokens.forEach((tok, tIdx) => {
        if (tok.start === null) return;

        const startSec = tok.start;
        let endSec = tok.end !== null ? tok.end : startSec + 0.4;
        if (endSec <= startSec) endSec = startSec + 0.3;
        const durSec = Math.max(0.1, endSec - startSec);

        const leftPx = startSec * timelineZoomPxPerSec;
        const widthPx = Math.max(28, durSec * timelineZoomPxPerSec);

        const targetTrack = tok.lineIndex % 2 === 0 ? track0Container : track1Container;

        const block = document.createElement('div');
        block.dataset.tokenIdx = tIdx;
        block.className = `timeline-clip-block absolute top-1 bottom-1 bg-amber-500/20 border border-amber-500/70 rounded px-1.5 text-[11px] text-amber-200 font-mono flex items-center justify-between cursor-grab select-none shadow overflow-hidden group ${tIdx === currentTokenIndex ? 'active-word' : ''}`;
        block.style.left = `${leftPx}px`;
        block.style.width = `${widthPx}px`;
        block.title = `Line ${tok.lineIndex + 1}: ${tok.text} (${startSec.toFixed(2)}s - ${endSec.toFixed(2)}s)`;

        block.innerHTML = `
                    <span class="pointer-events-none truncate font-extrabold text-zinc-100">${escapeHtml(tok.text)}</span>
                    <div class="resize-handle-right absolute bottom-0 right-0 top-0 w-2 cursor-col-resize bg-amber-400/80 transition-colors hover:bg-amber-300" title="Tarik untuk durasi"></div>
                `;

        block.onmousedown = (e) => onTimelineBlockMouseDown(e, tIdx, 'move');

        const resizeHandle = block.querySelector('.resize-handle-right');
        resizeHandle.onmousedown = (e) => {
            e.stopPropagation();
            onTimelineBlockMouseDown(e, tIdx, 'resize-end');
        };

        targetTrack.appendChild(block);
    });

    wrapper.onclick = (e) => {
        if (e.target.classList.contains('timeline-clip-block') || e.target.closest('.timeline-clip-block')) return;
        const rect = wrapper.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const targetSec = clickX / timelineZoomPxPerSec;
        if (targetSec >= 0) {
            audio.currentTime = targetSec;
            updateTimelinePlayheadAndAutoScroll();
        }
    };
}

function getNonOverlappingBoundaries(tokenIdx) {
    let minStart = 0;
    let maxEnd = audio.duration || 3600;
    const token = tokens[tokenIdx];

    if (!token) return { minStart, maxEnd };

    for (let index = tokenIdx - 1; index >= 0; index--) {
        const prevTok = tokens[index];
        if (prevTok && prevTok.lineIndex === token.lineIndex && prevTok.start !== null) {
            minStart = prevTok.end !== null ? prevTok.end : prevTok.start + 0.05;
            break;
        }
    }

    for (let index = tokenIdx + 1; index < tokens.length; index++) {
        const nextTok = tokens[index];
        if (nextTok && nextTok.lineIndex === token.lineIndex && nextTok.start !== null) {
            maxEnd = nextTok.start;
            break;
        }
    }

    return { minStart, maxEnd };
}

function getAudioBaseName() {
    const audioName = audioFileMeta && audioFileMeta.name ? audioFileMeta.name : 'karaoke';
    return (
        audioName
            .replace(/\.[^/.]+$/, '')
            .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
            .trim() || 'karaoke'
    );
}

function onTimelineBlockMouseDown(e, tokenIdx, mode) {
    e.preventDefault();
    pushUndoState();

    const token = tokens[tokenIdx];
    currentTokenIndex = tokenIdx;
    updateTokenCounts();
    highlightActiveBlockInTimeline();

    const startX = e.clientX;
    const initialStart = token.start || 0;
    const initialEnd = token.end !== null ? token.end : initialStart + 0.4;
    const duration = Math.max(0.1, initialEnd - initialStart);

    const { minStart, maxEnd } = getNonOverlappingBoundaries(tokenIdx);
    const snapGuide = document.getElementById('snap-guide-indicator');

    const snapThresholdSec = 0.15;

    const onMouseMove = (moveEvent) => {
        const deltaPx = moveEvent.clientX - startX;
        const deltaSec = deltaPx / timelineZoomPxPerSec;

        let isSnapped = false;
        let snapTimeSec = 0;

        if (mode === 'move') {
            let newStart = initialStart + deltaSec;
            let newEnd = newStart + duration;

            if (isMagnetSnapEnabled) {
                const playheadTime = audio.currentTime;
                if (Math.abs(newStart - playheadTime) < snapThresholdSec) {
                    newStart = playheadTime;
                    newEnd = newStart + duration;
                    isSnapped = true;
                    snapTimeSec = playheadTime;
                } else if (Math.abs(newStart - minStart) < snapThresholdSec) {
                    newStart = minStart;
                    newEnd = newStart + duration;
                    isSnapped = true;
                    snapTimeSec = minStart;
                } else if (Math.abs(newEnd - maxEnd) < snapThresholdSec) {
                    newEnd = maxEnd;
                    newStart = Math.max(minStart, newEnd - duration);
                    isSnapped = true;
                    snapTimeSec = maxEnd;
                }
            }

            if (newStart < minStart) {
                newStart = minStart;
                newEnd = newStart + duration;
            }
            if (newEnd > maxEnd) {
                newEnd = maxEnd;
                newStart = Math.max(minStart, newEnd - duration);
            }

            token.start = parseFloat(newStart.toFixed(3));
            token.end = parseFloat(newEnd.toFixed(3));
        } else if (mode === 'resize-end') {
            let newEnd = initialEnd + deltaSec;

            if (isMagnetSnapEnabled) {
                const playheadTime = audio.currentTime;
                if (Math.abs(newEnd - playheadTime) < snapThresholdSec) {
                    newEnd = playheadTime;
                    isSnapped = true;
                    snapTimeSec = playheadTime;
                } else if (Math.abs(newEnd - maxEnd) < snapThresholdSec) {
                    newEnd = maxEnd;
                    isSnapped = true;
                    snapTimeSec = maxEnd;
                }
            }

            if (newEnd < token.start + 0.05) newEnd = token.start + 0.05;
            if (newEnd > maxEnd) newEnd = maxEnd;

            token.end = parseFloat(newEnd.toFixed(3));
        }

        if (isSnapped && snapGuide) {
            snapGuide.classList.remove('hidden');
            snapGuide.style.left = `${snapTimeSec * timelineZoomPxPerSec}px`;
        } else if (snapGuide) {
            snapGuide.classList.add('hidden');
        }

        render2TrackTimeline();
    };

    const onMouseUp = () => {
        if (snapGuide) snapGuide.classList.add('hidden');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        saveToLocalStorage();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

function startVideoExport() {
    if (!audio.src) {
        showToast('Please load an audio file first!', 'error');
        return;
    }

    isPreviewMode = true;
    document.getElementById('live-export-overlay').classList.remove('hidden');

    const canvasStream = stageCanvas.captureStream(60);
    let combinedStream = canvasStream;

    try {
        if (audioCtx) {
            const dest = audioCtx.createMediaStreamDestination();
            audioSource.connect(dest);
            const audioTrack = dest.stream.getAudioTracks()[0];
            if (audioTrack) {
                combinedStream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);
            }
        }
    } catch (e) {
        console.log('Audio capture stream note:', e);
    }

    recordedChunks = [];
    let options = { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 12000000 };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
    }

    mediaRecorder = new MediaRecorder(combinedStream, options);

    mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
            recordedChunks.push(event.data);
        }
    };

    mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${getAudioBaseName()}_${stageStyles.resolution}.webm`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Video export saved successfully!', 'success');
        document.getElementById('live-export-overlay').classList.add('hidden');
    };

    audio.currentTime = 0;
    audio.play();
    mediaRecorder.start();

    isExportingVideo = true;
    updateExportProgress();
}

function updateExportProgress() {
    if (!isExportingVideo) return;
    const dur = audio.duration || 1;
    const curr = audio.currentTime;
    const pct = Math.min(100, (curr / dur) * 100);

    document.getElementById('export-progress-bar').style.width = `${pct}%`;
    document.getElementById('export-timer-display').innerText = `${formatTime(curr)} / ${formatTime(dur)}`;

    if (audio.ended || curr >= dur) {
        stopVideoExport();
    } else {
        requestAnimationFrame(updateExportProgress);
    }
}

function stopVideoExport() {
    isExportingVideo = false;
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    audio.pause();
    document.getElementById('live-export-overlay').classList.add('hidden');
}

function openExportModal() {
    generateExportContent();
    document.getElementById('export-modal').classList.remove('hidden');
}

function closeExportModal() {
    document.getElementById('export-modal').classList.add('hidden');
}

function generateExportContent() {
    const fmt = document.getElementById('export-format-select').value;
    const outputArea = document.getElementById('export-text-output');

    if (fmt === 'lrc-word') {
        let lrcStr = '';
        linesData.forEach((tokenIndices) => {
            const validIndices = tokenIndices.filter((i) => tokens[i] && tokens[i].text.trim().length > 0);
            if (validIndices.length === 0) return;

            const firstToken = tokens[validIndices[0]];
            const lineStart = firstToken.start !== null ? formatLrcTag(firstToken.start) : '[00:00.00]';

            let lineWords = '';
            validIndices.forEach((tIdx) => {
                const tok = tokens[tIdx];
                const wordTag = tok.start !== null ? `<${formatLrcTagRaw(tok.start)}>` : '';
                lineWords += `${wordTag}${tok.text} `;
            });

            if (lineWords.trim().length > 0) {
                lrcStr += `${lineStart}${lineWords.trim()}\n`;
            }
        });

        songEndMarkers.forEach((m) => {
            lrcStr += `${formatLrcTag(m)}\n`;
        });

        outputArea.value = lrcStr;
    } else if (fmt === 'ass-karaoke') {
        let assStr = `[Script Info]\nTitle: Lyrics Player Karaoke\nScriptType: v4.00+\nPlayResX: 1920\nPlayResY: 1080\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,${stageStyles.fontFamily},${stageStyles.fontSize},&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,2,2,10,10,50,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

        linesData.forEach((tokenIndices) => {
            const validIndices = tokenIndices.filter((i) => tokens[i] && tokens[i].text.trim().length > 0);
            if (validIndices.length === 0) return;

            const firstTok = tokens[validIndices[0]];
            const lastTok = tokens[validIndices[validIndices.length - 1]];
            const startSec = firstTok.start !== null ? firstTok.start : 0;
            const endSec = lastTok.end !== null ? lastTok.end : startSec + 3;

            let karaokeText = '';
            validIndices.forEach((tIdx, i) => {
                const tok = tokens[tIdx];
                const s = tok.start !== null ? tok.start : startSec;
                const e = tok.end !== null ? tok.end : s + 0.3;
                const centisecs = Math.round((e - s) * 100);
                karaokeText += `{\\k${centisecs}}${tok.text} `;
            });

            assStr += `Dialogue: 0,${formatAssTime(startSec)},${formatAssTime(endSec)},Default,,0,0,0,,${karaokeText.trim()}\n`;
        });

        outputArea.value = assStr;
    } else if (fmt === 'lrc-line') {
        let lrcStr = '';
        linesData.forEach((tokenIndices) => {
            const validIndices = tokenIndices.filter((i) => tokens[i] && tokens[i].text.trim().length > 0);
            if (validIndices.length === 0) return;

            const firstToken = tokens[validIndices[0]];
            const lineStart = firstToken.start !== null ? formatLrcTag(firstToken.start) : '[00:00.00]';
            const lineText = validIndices.map((i) => tokens[i].text).join(' ');

            lrcStr += `${lineStart}${lineText}\n`;
        });
        outputArea.value = lrcStr;
    } else if (fmt === 'srt') {
        let srtStr = '';
        linesData.forEach((tokenIndices, idx) => {
            const validIndices = tokenIndices.filter((i) => tokens[i] && tokens[i].text.trim().length > 0);
            if (validIndices.length === 0) return;

            const firstTok = tokens[validIndices[0]];
            const lastTok = tokens[validIndices[validIndices.length - 1]];
            const startSec = firstTok.start !== null ? firstTok.start : 0;
            const endSec = lastTok.end !== null ? lastTok.end : startSec + 3;
            const lineText = validIndices.map((i) => tokens[i].text).join(' ');

            srtStr += `${idx + 1}\n${formatSrtTime(startSec)} --> ${formatSrtTime(endSec)}\n${lineText}\n\n`;
        });
        outputArea.value = srtStr;
    } else if (fmt === 'json') {
        outputArea.value = JSON.stringify({ tokens, linesData, songEndMarkers, stageStyles }, null, 2);
    }
}

function copyExportToClipboard() {
    const outputArea = document.getElementById('export-text-output');
    outputArea.select();
    document.execCommand('copy');
    showToast('Subtitle text copied to the clipboard!', 'success');
}

function downloadExportFile() {
    const fmt = document.getElementById('export-format-select').value;
    const content = document.getElementById('export-text-output').value;
    let ext = 'lrc';
    if (fmt === 'ass-karaoke') ext = 'ass';
    else if (fmt === 'srt') ext = 'srt';
    else if (fmt === 'json') ext = 'json';

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${getAudioBaseName()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`File ${getAudioBaseName()}.${ext} downloaded successfully!`, 'success');
}

function formatTime(sec) {
    if (isNaN(sec) || sec < 0) return '00:00.0';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    const mStr = String(m).padStart(2, '0');
    const sStr = s.toFixed(1).padStart(4, '0');
    return `${mStr}:${sStr}`;
}

function formatLrcTag(sec) {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2);
    return `[${String(m).padStart(2, '0')}:${String(s).padStart(5, '0')}]`;
}

function formatLrcTagRaw(sec) {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(5, '0')}`;
}

function formatAssTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const cs = Math.floor((s % 1) * 100);
    return `${h}:${String(m).padStart(2, '0')}:${String(Math.floor(s)).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

function formatSrtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, function (m) {
        return map[m];
    });
}
