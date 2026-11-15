import { Mp4Muxer } from './modules/v1/lyricsMp4Muxer';
import { lyricsSettings } from './modules/v1/lyricsSettings';

(() => {
    'use strict';

    const {
        storage: {
            keys: STORAGE_KEYS,
            database: DATABASE,
        },
        selectors: SELECTORS,
        canvas: { width: DESIGN_DEFAULT_WIDTH, height: DESIGN_DEFAULT_HEIGHT },
        mp4Export: {
            video: VIDEO_EXPORT,
            audio: AUDIO_EXPORT,
            muxer: MUXER_EXPORT,
            timing: EXPORT_TIMING,
            blobChunkSize: BLOB_CHUNK_SIZE,
            filePicker: FILE_PICKER,
            wakeLockType: WAKE_LOCK_TYPE,
        },
        messages: {
            missingAudio: MISSING_AUDIO,
            media: MEDIA_MESSAGES,
            mp4Export: EXPORT_UI,
            templates: TEMPLATE_MESSAGES,
        },
        spectrum: SPECTRUM,
        rendering: {
            lyrics: LYRICS_STYLE,
            fade: FADE_STYLE,
        },
        preview: {
            defaultLevelIndex: PREVIEW_DEFAULT_LEVEL_INDEX,
            defaultWidthLevels: PREVIEW_DEFAULT_WIDTH_LEVELS,
            slowFrameCostMilliseconds: PREVIEW_SLOW_FRAME_COST_MILLISECONDS,
            slowFramesBeforeDowngrade: PREVIEW_SLOW_FRAMES_BEFORE_DOWNGRADE,
        },
        colors: { default: DEFAULT_COLORS },
    } = lyricsSettings;

    const PERSISTENCE_KEYS = lyricsSettings.storage.persistenceKeys;

    // STATE APLIKASI
    const appState = {
        parsedLyrics: [],
        isPlaying: false,
        isExporting: false,
        isSpectrumEnabled: true,
        backgroundResource: null, // { type: "image" | "video", element }
        animationFrameId: null,
        backgroundColor: lyricsSettings.colors.background,
        keyColor: lyricsSettings.colors.key,
        textColor: lyricsSettings.colors.text,
        displayMode: lyricsSettings.display.version,
        lineBaseYRatio: lyricsSettings.rendering.lyrics.defaultBaseYRatio,
    };

    const liveAudio = {
        audioContext: null,
        analyserNode: null,
        frequencyData: null,
    };

    const STATE_PREVIEW = {
        previewContext: null,
        previewLevelIndex: PREVIEW_DEFAULT_LEVEL_INDEX,
        previewSlowFrameCount: 0,
        PreviewAverageCostMilliseconds: 0,

        lastDrawTimestamp: 0,
        lastLoopTimestamp: 0,
        pendingRedrawId: null,
        fadeState: { backgroundOpacity: 0, overlayOpacity: 0 },
        mouse: { isInside: false, horizontalRatio: 0 },
        silentFrequencyData: new Uint8Array(SPECTRUM.binCount),
    };

    /* Hasil analisis spektrum (dihitung sekali di Worker, dipakai preview & export). */
    const spectrumAnalysis = {
        token: 0,
        promise: null,
        decodedAudioBuffer: null,
        frequencyFrames: null, // Uint8Array: frameCount * binCount
        frameCount: 0,
    };

    const exportControl = {
        isCancelRequested: false,
        wakeLock: null,
    };

    const EXPORT_CANCELLED = new Error(EXPORT_UI.exportCancelled);

    // UTILITAS UMUM
    function waitMilliseconds(milliseconds) {
        return new Promise((resolve) => setTimeout(resolve, milliseconds));
    }

    /* Memberi kesempatan UI bekerja tanpa batas minimal 4 ms milik setTimeout. */
    const yieldChannel = new MessageChannel();
    function yieldToBrowser() {
        return new Promise((resolve) => {
            yieldChannel.port1.onmessage = () => resolve();
            yieldChannel.port2.postMessage(0);
        });
    }

    function clampBetweenZeroAndOne(value) {
        return Math.max(0, Math.min(1, value));
    }

    function moveTowardsTarget(currentValue, targetValue, stepSize) {
        if (currentValue > targetValue) return Math.max(targetValue, currentValue - stepSize);
        if (currentValue < targetValue) return Math.min(targetValue, currentValue + stepSize);
        return currentValue;
    }

    function parseHexColor(hexColor) {
        return {
            red: parseInt(hexColor.slice(1, 3), 16),
            green: parseInt(hexColor.slice(3, 5), 16),
            blue: parseInt(hexColor.slice(5, 7), 16),
        };
    }

    function hexColorToRgbaString(hexColor, alpha) {
        const { red, green, blue } = parseHexColor(hexColor);
        return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
    }

    function readStoredValue(key, fallbackValue = '') {
        return localStorage.getItem(key) ?? fallbackValue;
    }

    function writeStoredValue(key, value) {
        localStorage.setItem(key, value);
    }

    // IndexedDB
    function openDatabase() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DATABASE.name, DATABASE.version);
            request.onupgradeneeded = () => request.result.createObjectStore(DATABASE.storeName);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async function saveToDatabase(key, value) {
        const database = await openDatabase();
        database.transaction(DATABASE.storeName, 'readwrite').objectStore(DATABASE.storeName).put(value, key);
    }

    async function loadFromDatabase(key) {
        const database = await openDatabase();
        return new Promise((resolve) => {
            const request = database.transaction(DATABASE.storeName).objectStore(DATABASE.storeName).get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => resolve(null);
        });
    }

    // Lirik
    function normalizeLyricsText(rawText) {
        if (!rawText) return '';
        let text = rawText.normalize('NFC');
        text = text.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
        text = text.replace(/[\u200B-\u200D\uFEFF\u2060-\u206F]/g, '');
        const lookalikeCharacters = { е: 'e', Е: 'E', о: 'o', О: 'O', ӏ: 'l', І: 'I', ı: 'i', ѕ: 's' };
        text = text.replace(/./g, (character) => lookalikeCharacters[character] || character);
        return text.split(/\r?\n/).map((line) => line.replace(/ +/g, ' ').trim()).join('\n');
    }

    function parseLyricsText(lyricsText) {
        const parsedLines = [];
        const timestampPattern = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

        for (const rawLine of lyricsText.split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line) continue;

            timestampPattern.lastIndex = 0;
            const timestampsMilliseconds = [];
            let lastTimestampEndIndex = 0;
            let match;
            while ((match = timestampPattern.exec(line)) !== null) {
                const minutes = parseInt(match[1], 10);
                const seconds = parseInt(match[2], 10);
                const milliseconds = match[3] ? parseInt((match[3] + '00').slice(0, 3), 10) : 0;
                timestampsMilliseconds.push((minutes * 60 + seconds) * 1000 + milliseconds);
                lastTimestampEndIndex = timestampPattern.lastIndex;
            }

            const rawText = line.slice(lastTimestampEndIndex).trim();
            const text = rawText.length ? rawText.charAt(0).toUpperCase() + rawText.slice(1) : rawText;
            for (const timeMilliseconds of timestampsMilliseconds) {
                parsedLines.push({ timeMilliseconds, text });
            }
        }

        parsedLines.sort((first, second) => first.timeMilliseconds - second.timeMilliseconds);
        return parsedLines;
    }

    /* Header/footer dibaca dari textarea, di-cache selama isinya tidak berubah. */
    const textareaLinesCache = {};
    function getTextareaLines(selector) {
        const textareaValue = document.querySelector(selector)?.value || '';
        const cached = textareaLinesCache[selector];
        if (cached && cached.value === textareaValue) return cached.lines;
        const lines = textareaValue.trim()
            ? textareaValue
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
            : [];
        textareaLinesCache[selector] = { value: textareaValue, lines };
        return lines;
    }

    // MENGGAMBAR FRAME  (fungsi murni dari waktu → hasil identik di preview & export)
    function drawMediaCover(context, mediaResource) {
        const element = mediaResource.element;
        const sourceWidth = mediaResource.type === 'video' ? element.videoWidth : element.width;
        const sourceHeight = mediaResource.type === 'video' ? element.videoHeight : element.height;
        if (!sourceWidth || !sourceHeight) return;

        const sourceAspectRatio = sourceWidth / sourceHeight;
        const targetAspectRatio = DESIGN_DEFAULT_WIDTH / DESIGN_DEFAULT_HEIGHT;
        let drawWidth, drawHeight, drawX, drawY;
        if (sourceAspectRatio > targetAspectRatio) {
            drawHeight = DESIGN_DEFAULT_HEIGHT;
            drawWidth = DESIGN_DEFAULT_HEIGHT * sourceAspectRatio;
            drawX = (DESIGN_DEFAULT_WIDTH - drawWidth) / 2;
            drawY = 0;
        } else {
            drawWidth = DESIGN_DEFAULT_WIDTH;
            drawHeight = DESIGN_DEFAULT_WIDTH / sourceAspectRatio;
            drawX = 0;
            drawY = (DESIGN_DEFAULT_HEIGHT - drawHeight) / 2;
        }
        context.drawImage(element, drawX, drawY, drawWidth, drawHeight);
    }

    function findActiveLineIndex(timeMilliseconds) {
        let activeIndex = -1;
        for (let index = 0; index < appState.parsedLyrics.length; index++) {
            if (appState.parsedLyrics[index].timeMilliseconds > timeMilliseconds) break;
            activeIndex = index;
        }
        return activeIndex;
    }

    function deriveLyricsState(timeMilliseconds, durationMilliseconds) {
        const lyrics = appState.parsedLyrics;
        const totalLines = lyrics.length;
        const activeIndex = findActiveLineIndex(timeMilliseconds);

        const currentLineStart = totalLines > 0 && activeIndex >= 0 ? lyrics[activeIndex].timeMilliseconds : 0;
        const currentLineEnd = activeIndex + 1 < totalLines && activeIndex >= 0 ? lyrics[activeIndex + 1].timeMilliseconds : durationMilliseconds;

        const activeText = (activeIndex >= 0 && lyrics[activeIndex]?.text) || '';
        const nextText = (activeIndex + 1 < totalLines && lyrics[activeIndex + 1].text) || '';
        const previousText = activeIndex > 0 ? lyrics[activeIndex - 1].text : '';

        const symbol = LYRICS_STYLE.instrumentalSymbol;
        const isCurrentInstrumental = activeText.includes(symbol);
        const isNextInstrumental = nextText.includes(symbol);
        const isPreviousInstrumental = previousText.includes(symbol);

        return {
            activeLineIndex: activeIndex,
            totalLines,
            currentLineStart,
            currentLineEnd,
            timeUntilNextLine: currentLineEnd - timeMilliseconds,
            rawActiveText: activeText,
            rawNextText: nextText,
            activeText: isCurrentInstrumental ? '' : activeText,
            nextText: isNextInstrumental ? '' : nextText,
            previousText: isPreviousInstrumental ? '' : previousText,
            isCurrentInstrumental,
            isNextInstrumental,
            isPreviousInstrumental,
            isEnding: activeIndex >= totalLines - 2 && activeText.trim() === '' && nextText.trim() === '',
        };
    }

    // Teks
    const wrappedTextCache = new Map();
    function wrapTextIntoLines(context, text, font, maximumWidth) {
        const cacheKey = `${font}|${maximumWidth}|${text}`;
        const cachedLines = wrappedTextCache.get(cacheKey);
        if (cachedLines) return cachedLines;

        context.font = font;
        const lines = [];
        let currentLine = '';
        for (const word of text.split(' ')) {
            const candidateLine = currentLine ? `${currentLine} ${word}` : word;
            if (currentLine && context.measureText(candidateLine).width > maximumWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = candidateLine;
            }
        }
        if (currentLine) lines.push(currentLine);

        if (wrappedTextCache.size > 400) wrappedTextCache.clear();
        wrappedTextCache.set(cacheKey, lines);
        return lines;
    }

    function buildFontString(text, fontSize) {
        const isParenthesized = /^\(.*\)$/.test(text);
        return `${isParenthesized ? 'italic ' : ''}${fontSize}px ${LYRICS_STYLE.fontFamily}`;
    }

    function drawLyricLine(context, text, centerX, centerY, color, alpha = 1) {
        if (!text) return;
        const font = buildFontString(text, LYRICS_STYLE.lyricFontSize);
        const wrappedLines = wrapTextIntoLines(context, text, font, LYRICS_STYLE.maximumTextWidth);
        const lineHeight = LYRICS_STYLE.lyricFontSize * LYRICS_STYLE.lineHeightMultiplier;
        const firstLineY = centerY - ((wrappedLines.length - 1) * lineHeight) / 2;

        context.save();
        context.font = font;
        context.fillStyle = color;
        context.globalAlpha = alpha;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        wrappedLines.forEach((wrappedLine, lineIndex) => {
            context.fillText(wrappedLine, centerX, firstLineY + lineIndex * lineHeight);
        });
        context.restore();
    }

    function drawLyricsBlock(context, lyricsState, adjustedTimeMilliseconds) {
        if (lyricsState.totalLines === 0) return;

        const centerX = DESIGN_DEFAULT_WIDTH / 2;
        const lineSpacing = LYRICS_STYLE.lineSpacing;
        const progressInLine = clampBetweenZeroAndOne((adjustedTimeMilliseconds - lyricsState.currentLineStart) / (lyricsState.currentLineEnd - lyricsState.currentLineStart));

        if (appState.displayMode === 'triple') {
            const centerY = DESIGN_DEFAULT_HEIGHT / 2;
            const elapsedInLine = adjustedTimeMilliseconds - lyricsState.currentLineStart;
            const lineDuration = Math.max(1, lyricsState.currentLineEnd - lyricsState.currentLineStart);
            const shiftDuration = Math.min(LYRICS_STYLE.tripleShiftDurationMilliseconds, Math.max(200, Math.round(0.55 * lineDuration)));
            const shiftProgress = elapsedInLine >= shiftDuration ? 1 : 0.5 - 0.5 * Math.cos(Math.max(0, elapsedInLine / shiftDuration) * Math.PI);
            const shiftOffset = (1 - shiftProgress) * lineSpacing;

            let instrumentalFade = 1;
            if (lyricsState.isCurrentInstrumental) {
                instrumentalFade = Math.max(0, 1 - elapsedInLine / LYRICS_STYLE.tripleFadeDurationMilliseconds);
            } else if (lyricsState.isPreviousInstrumental) {
                instrumentalFade = Math.min(1, elapsedInLine / LYRICS_STYLE.tripleFadeDurationMilliseconds);
            }

            const neighborFadeDuration = Math.max(200, Math.round(0.8 * shiftDuration));
            const neighborProgress = Math.min(1, Math.max(0, elapsedInLine / neighborFadeDuration));
            const neighborEase = 0.5 - 0.5 * Math.cos(neighborProgress * Math.PI);

            drawLyricLine(context, lyricsState.previousText, centerX, centerY - lineSpacing + shiftOffset, appState.textColor, (1 - neighborEase) * LYRICS_STYLE.inactiveLineOpacity * instrumentalFade);
            drawLyricLine(context, lyricsState.activeText, centerX, centerY + shiftOffset, appState.keyColor, instrumentalFade);
            drawLyricLine(context, lyricsState.nextText, centerX, centerY + lineSpacing + shiftOffset, appState.textColor, neighborEase * LYRICS_STYLE.inactiveLineOpacity * instrumentalFade);
            return;
        }

        /* Mode dual: Active + Next dengan scroll halus */
        const baseY = DESIGN_DEFAULT_HEIGHT * appState.lineBaseYRatio;
        const scrollOffset = progressInLine * lineSpacing;

        const previousAlpha = lyricsState.isCurrentInstrumental || lyricsState.isEnding ? Math.max(0, (1 - (adjustedTimeMilliseconds - lyricsState.currentLineStart) / LYRICS_STYLE.previousLineFadeOutMilliseconds) * LYRICS_STYLE.inactiveLineOpacity) : (1 - progressInLine) * LYRICS_STYLE.inactiveLineOpacity;
        const nextAlpha = lyricsState.timeUntilNextLine > LYRICS_STYLE.nextLineFadeInMilliseconds ? 0 : Math.max(0, (1 - lyricsState.timeUntilNextLine / LYRICS_STYLE.nextLineFadeInMilliseconds) * LYRICS_STYLE.inactiveLineOpacity);

        drawLyricLine(context, lyricsState.previousText, centerX, baseY - lineSpacing - scrollOffset, appState.textColor, previousAlpha);
        drawLyricLine(context, lyricsState.activeText, centerX, baseY - scrollOffset, appState.keyColor, 1);
        drawLyricLine(context, lyricsState.nextText, centerX, baseY + lineSpacing - scrollOffset, appState.textColor, nextAlpha);
    }

    function drawOverlayText(context, textLines, adjustedTimeMilliseconds, options) {
        if (!textLines.length) return;
        const { fontSize, anchorY, baseline, baseOpacity } = options;
        const font = `${fontSize}px ${LYRICS_STYLE.fontFamily}`;

        let lineIndex = 0;
        let lineOpacity = 1;
        let lineColor = appState.textColor;
        if (textLines.length > 1) {
            const elapsedSeconds = adjustedTimeMilliseconds / 1000;
            const lineDuration = FADE_STYLE.overlayLineDurationSeconds;
            const fadeDuration = Math.min(FADE_STYLE.overlayFadeDurationSeconds, lineDuration / 2);
            const positionInLine = elapsedSeconds % lineDuration;
            if (positionInLine < fadeDuration) lineOpacity = positionInLine / fadeDuration;
            else if (positionInLine > lineDuration - fadeDuration) lineOpacity = (lineDuration - positionInLine) / fadeDuration;
            lineOpacity = clampBetweenZeroAndOne(lineOpacity);
            lineIndex = Math.floor(elapsedSeconds / lineDuration) % textLines.length;
            lineColor = lineIndex % 2 === 0 ? appState.keyColor : appState.textColor;
        }

        const wrappedLines = wrapTextIntoLines(context, textLines[lineIndex], font, LYRICS_STYLE.maximumTextWidth);
        const lineHeight = fontSize * 1.25;

        context.save();
        context.font = font;
        context.textAlign = 'center';
        context.fillStyle = lineColor;
        context.globalAlpha = lineOpacity * FADE_STYLE.overlayMaximumOpacity * clampBetweenZeroAndOne(baseOpacity);
        context.textBaseline = baseline === 'top' ? 'top' : 'bottom';
        wrappedLines.forEach((wrappedLine, index) => {
            const lineY = baseline === 'top'
                ? anchorY + index * lineHeight
                : anchorY - (wrappedLines.length - 1 - index) * lineHeight;
            const segments = wrappedLine.split(/(SyncMusics)/g);
            if (segments.length === 1) {
                context.textAlign = 'center';
                context.fillStyle = lineColor;
                context.fillText(wrappedLine, DESIGN_DEFAULT_WIDTH / 2, lineY);
                return;
            }

            context.textAlign = 'left';
            let segmentX = DESIGN_DEFAULT_WIDTH / 2 - context.measureText(wrappedLine).width / 2;
            for (const segment of segments) {
                if (segment === 'SyncMusics') {
                    context.fillStyle = appState.keyColor;
                    context.fillText('Sync', segmentX, lineY);
                    segmentX += context.measureText('Sync').width;
                    context.fillStyle = lineColor;
                    context.fillText('Musics', segmentX, lineY);
                    segmentX += context.measureText('Musics').width;
                } else if (segment) {
                    context.fillStyle = lineColor;
                    context.fillText(segment, segmentX, lineY);
                    segmentX += context.measureText(segment).width;
                }
            }
        });
        context.restore();
    }

    /* Semua bar digambar dalam satu path + satu fill() agar ringan. */
    function drawSpectrumBars(context, frequencyData, mouseState) {
        if (!frequencyData) return;
        const barCount = SPECTRUM.barCount;
        const binsPerBar = Math.floor(frequencyData.length / barCount);
        const barWidth = DESIGN_DEFAULT_WIDTH / (2 * barCount);
        const maximumBarHeight = DESIGN_DEFAULT_HEIGHT * SPECTRUM.maximumHeightRatio;
        const baselineY = DESIGN_DEFAULT_HEIGHT;

        const gradient = context.createLinearGradient(0, baselineY, 0, baselineY - maximumBarHeight);
        gradient.addColorStop(0, hexColorToRgbaString(appState.keyColor, SPECTRUM.gradientStartAlpha));
        gradient.addColorStop(1, hexColorToRgbaString(appState.keyColor, SPECTRUM.gradientEndAlpha));
        context.fillStyle = gradient;
        context.beginPath();

        for (let barIndex = 0; barIndex < barCount; barIndex++) {
            let peakValue = 0;
            for (let binOffset = 0; binOffset < binsPerBar; binOffset++) {
                const binValue = frequencyData[barIndex * binsPerBar + binOffset];
                if (binValue > peakValue) peakValue = binValue;
            }
            if (peakValue < SPECTRUM.silenceThreshold) peakValue = 0;

            let boost = 1;
            if (mouseState && mouseState.isInside) {
                boost = 1 + (1 - Math.abs(barIndex / barCount - mouseState.horizontalRatio)) * SPECTRUM.mouseBoostStrength;
            }
            peakValue = Math.min(255, peakValue * boost);

            const barHeight = (peakValue / 255) * maximumBarHeight * (1 - (barIndex / (barCount - 1)) * SPECTRUM.edgeScale);
            const barTopY = baselineY - barHeight;
            context.rect(barIndex * barWidth, barTopY, barWidth - SPECTRUM.barGap, barHeight);
            context.rect(DESIGN_DEFAULT_WIDTH / 2 + (barCount - barIndex - 1) * barWidth, barTopY, barWidth - SPECTRUM.barGap, barHeight);
        }
        context.fill();
    }

    // Menggambar satu frame lengkap.
    function drawFrame(context, timeMilliseconds, fadeState, frameOptions) {
        const adjustedTimeMilliseconds = timeMilliseconds + frameOptions.offsetSeconds * 1000;
        context.clearRect(0, 0, DESIGN_DEFAULT_WIDTH, DESIGN_DEFAULT_HEIGHT);

        if (frameOptions.isIntroAudioPlaying) {
            fadeState.backgroundOpacity = 0;
            fadeState.overlayOpacity = 0;
            context.save();
            if (frameOptions.backgroundResource) {
                drawMediaCover(context, frameOptions.backgroundResource);
            } else {
                context.fillStyle = appState.backgroundColor;
                context.fillRect(0, 0, DESIGN_DEFAULT_WIDTH, DESIGN_DEFAULT_HEIGHT);
            }
            context.restore();
            return;
        }

        const lyricsState = deriveLyricsState(adjustedTimeMilliseconds, frameOptions.durationMilliseconds);
        const fadeStep = frameOptions.snapFades ? 1 : FADE_STYLE.speedPerFrame * VIDEO_EXPORT.framesPerSecond * frameOptions.deltaSeconds;

        /* Background: tampil saat instrumental / jeda, tertutup warna background saat lirik aktif */
        let backgroundTargetOpacity = FADE_STYLE.backgroundMaximumOpacity;
        if (lyricsState.isEnding || lyricsState.isCurrentInstrumental) {
            const isNextLineComingSoon = !lyricsState.isNextInstrumental && lyricsState.rawNextText.trim() !== '' && lyricsState.timeUntilNextLine < FADE_STYLE.backgroundPreloadMilliseconds;
            backgroundTargetOpacity = isNextLineComingSoon ? FADE_STYLE.backgroundMaximumOpacity : 0;
        }
        fadeState.backgroundOpacity = moveTowardsTarget(fadeState.backgroundOpacity, backgroundTargetOpacity, fadeStep);

        context.save();
        if (!frameOptions.backgroundResource) {
            context.fillStyle = appState.backgroundColor;
            context.fillRect(0, 0, DESIGN_DEFAULT_WIDTH, DESIGN_DEFAULT_HEIGHT);
        } else {
            drawMediaCover(context, frameOptions.backgroundResource);
            const { red, green, blue } = parseHexColor(appState.backgroundColor);
            context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${fadeState.backgroundOpacity})`;
            context.fillRect(0, 0, DESIGN_DEFAULT_WIDTH, DESIGN_DEFAULT_HEIGHT);
            if (fadeState.backgroundOpacity < FADE_STYLE.backgroundRevealThreshold) {
                context.fillStyle = `rgba(${red}, ${green}, ${blue}, ${FADE_STYLE.backgroundRevealOverlayOpacity})`;
                context.fillRect(0, 0, DESIGN_DEFAULT_WIDTH, DESIGN_DEFAULT_HEIGHT);
            }
        }
        context.restore();

        /* Opacity header/footer mengikuti opacity background */
        const activeLine = lyricsState.activeLineIndex >= 0 ? appState.parsedLyrics[lyricsState.activeLineIndex] : null;
        const isActiveLineInstrumental = activeLine && activeLine.text && activeLine.text.includes(LYRICS_STYLE.instrumentalSymbol);
        const overlayTargetOpacity = isActiveLineInstrumental ? 0 : clampBetweenZeroAndOne(fadeState.backgroundOpacity / FADE_STYLE.overlayOpacityReference);
        fadeState.overlayOpacity = moveTowardsTarget(fadeState.overlayOpacity, overlayTargetOpacity, fadeStep);

        drawOverlayText(context, frameOptions.headerLines, adjustedTimeMilliseconds, {
            fontSize: lyricsSettings.rendering.overlay.header.fontSize,
            anchorY: lyricsSettings.rendering.overlay.header.topY,
            baseline: 'top',
            baseOpacity: fadeState.overlayOpacity,
        });
        drawOverlayText(context, frameOptions.footerLines, adjustedTimeMilliseconds, {
            fontSize: lyricsSettings.rendering.overlay.footer.fontSize,
            anchorY: DESIGN_DEFAULT_HEIGHT - lyricsSettings.rendering.overlay.footer.bottomOffset,
            baseline: 'bottom',
            baseOpacity: fadeState.overlayOpacity,
        });

        drawLyricsBlock(context, lyricsState, adjustedTimeMilliseconds);

        if (frameOptions.isSpectrumEnabled) {
            context.save();
            drawSpectrumBars(context, frameOptions.frequencyData, frameOptions.mouseState);
            context.restore();
        }
    }

    // ANALISIS SPEKTRUM (Worker)
    function spectrumWorkerSource() {
        self.onmessage = (event) => {
            const { monoSamples, sampleRate, framesPerSecond, fftSize, smoothingFactor, bassFilterFrequency, bassFilterGainDecibels, minimumDecibels, maximumDecibels, progressFrameInterval } = event.data;

            const binCount = fftSize / 2;
            const totalFrames = Math.ceil((monoSamples.length / sampleRate) * framesPerSecond);
            const outputFrames = new Uint8Array(totalFrames * binCount);

            const windowCoefficients = new Float32Array(fftSize);
            const cosineTable = new Float32Array(binCount);
            const sineTable = new Float32Array(binCount);
            const bitReversalTable = new Uint16Array(fftSize);
            const bitCount = Math.log2(fftSize);

            for (let index = 0; index < fftSize; index++) {
                windowCoefficients[index] = 0.42 - 0.5 * Math.cos((2 * Math.PI * index) / fftSize) + 0.08 * Math.cos((4 * Math.PI * index) / fftSize);
            }
            for (let index = 0; index < binCount; index++) {
                cosineTable[index] = Math.cos((2 * Math.PI * index) / fftSize);
                sineTable[index] = -Math.sin((2 * Math.PI * index) / fftSize);
            }
            for (let index = 0; index < fftSize; index++) {
                let reversed = 0;
                let remaining = index;
                for (let bit = 0; bit < bitCount; bit++) {
                    reversed = (reversed << 1) | (remaining & 1);
                    remaining >>= 1;
                }
                bitReversalTable[index] = reversed;
            }

            /* Koefisien biquad lowshelf (rumus Web Audio) */
            const gainAmplitude = Math.pow(10, bassFilterGainDecibels / 40);
            const angularFrequency = (2 * Math.PI * bassFilterFrequency) / sampleRate;
            const cosineOmega = Math.cos(angularFrequency);
            const alpha = (Math.sin(angularFrequency) / 2) * Math.SQRT2;
            const sqrtTerm = 2 * Math.sqrt(gainAmplitude) * alpha;
            const a0 = gainAmplitude + 1 + (gainAmplitude - 1) * cosineOmega + sqrtTerm;
            const b0 = (gainAmplitude * (gainAmplitude + 1 - (gainAmplitude - 1) * cosineOmega + sqrtTerm)) / a0;
            const b1 = (2 * gainAmplitude * (gainAmplitude - 1 - (gainAmplitude + 1) * cosineOmega)) / a0;
            const b2 = (gainAmplitude * (gainAmplitude + 1 - (gainAmplitude - 1) * cosineOmega - sqrtTerm)) / a0;
            const a1 = (-2 * (gainAmplitude - 1 + (gainAmplitude + 1) * cosineOmega)) / a0;
            const a2 = (gainAmplitude + 1 + (gainAmplitude - 1) * cosineOmega - sqrtTerm) / a0;

            let filterState1 = 0;
            let filterState2 = 0;
            for (let index = 0; index < monoSamples.length; index++) {
                const input = monoSamples[index];
                const output = b0 * input + filterState1;
                filterState1 = b1 * input - a1 * output + filterState2;
                filterState2 = b2 * input - a2 * output;
                monoSamples[index] = output;
            }

            const realParts = new Float32Array(fftSize);
            const imaginaryParts = new Float32Array(fftSize);
            const smoothedMagnitudes = new Float32Array(binCount);
            const decibelRange = maximumDecibels - minimumDecibels;

            for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                const windowEnd = Math.round((frameIndex * sampleRate) / framesPerSecond);
                const windowStart = windowEnd - fftSize;

                for (let index = 0; index < fftSize; index++) {
                    const sampleIndex = windowStart + index;
                    const sample = sampleIndex >= 0 && sampleIndex < monoSamples.length ? monoSamples[sampleIndex] : 0;
                    realParts[bitReversalTable[index]] = sample * windowCoefficients[index];
                    imaginaryParts[bitReversalTable[index]] = 0;
                }

                for (let blockSize = 2; blockSize <= fftSize; blockSize <<= 1) {
                    const halfBlock = blockSize >> 1;
                    const tableStep = fftSize / blockSize;
                    for (let blockStart = 0; blockStart < fftSize; blockStart += blockSize) {
                        for (let offset = 0, tableIndex = 0; offset < halfBlock; offset++, tableIndex += tableStep) {
                            const upperIndex = blockStart + offset;
                            const lowerIndex = upperIndex + halfBlock;
                            const twiddleReal = cosineTable[tableIndex];
                            const twiddleImaginary = sineTable[tableIndex];
                            const productReal = realParts[lowerIndex] * twiddleReal - imaginaryParts[lowerIndex] * twiddleImaginary;
                            const productImaginary = realParts[lowerIndex] * twiddleImaginary + imaginaryParts[lowerIndex] * twiddleReal;
                            realParts[lowerIndex] = realParts[upperIndex] - productReal;
                            imaginaryParts[lowerIndex] = imaginaryParts[upperIndex] - productImaginary;
                            realParts[upperIndex] += productReal;
                            imaginaryParts[upperIndex] += productImaginary;
                        }
                    }
                }

                const outputOffset = frameIndex * binCount;
                for (let binIndex = 0; binIndex < binCount; binIndex++) {
                    const magnitude = Math.sqrt(realParts[binIndex] ** 2 + imaginaryParts[binIndex] ** 2) / fftSize;
                    smoothedMagnitudes[binIndex] = smoothingFactor * smoothedMagnitudes[binIndex] + (1 - smoothingFactor) * magnitude;
                    const decibels = 20 * Math.log10(smoothedMagnitudes[binIndex] + 1e-12);
                    const byteValue = Math.floor((255 * (decibels - minimumDecibels)) / decibelRange);
                    outputFrames[outputOffset + binIndex] = Math.max(0, Math.min(255, byteValue));
                }

                if (frameIndex % progressFrameInterval === 0) self.postMessage({ progressRatio: frameIndex / totalFrames });
            }

            self.postMessage({ isDone: true, outputFrames, totalFrames }, [outputFrames.buffer]);
        };
    }

    function showAnalysisProgressOnExportButton(progressRatio, hasFailed) {
        const exportButton = document.querySelector(SELECTORS.elementButton.export);
        if (!exportButton || appState.isExporting) return;
        if (progressRatio === null) {
            setExportButtonState(exportButton, false);
            if (hasFailed) exportButton.textContent = 'FAILURE ANALYSIS';
            return;
        }
        exportButton.disabled = true;
        exportButton.textContent = `ANALYSIS ${Math.round(progressRatio * 100)}%`;
    }

    function analyzeAudioBlob(audioBlob) {
        const analysisToken = ++spectrumAnalysis.token;
        spectrumAnalysis.decodedAudioBuffer = null;
        spectrumAnalysis.frequencyFrames = null;
        spectrumAnalysis.frameCount = 0;

        spectrumAnalysis.promise = (async () => {
            showAnalysisProgressOnExportButton(0);
            const decodingContext = new OfflineAudioContext(AUDIO_EXPORT.numberOfChannels, AUDIO_EXPORT.decodeLength, AUDIO_EXPORT.sampleRate);
            const decodedBuffer = await decodingContext.decodeAudioData(await audioBlob.arrayBuffer());
            if (analysisToken !== spectrumAnalysis.token) return;

            const sampleCount = decodedBuffer.length;
            const leftChannel = decodedBuffer.getChannelData(0);
            const rightChannel = decodedBuffer.numberOfChannels > 1 ? decodedBuffer.getChannelData(1) : leftChannel;
            const monoSamples = new Float32Array(sampleCount);
            for (let index = 0; index < sampleCount; index++) {
                monoSamples[index] = (leftChannel[index] + rightChannel[index]) * 0.5;
            }

            const workerUrl = URL.createObjectURL(new Blob([`(${spectrumWorkerSource.toString()})()`], { type: 'text/javascript' }));
            const worker = new Worker(workerUrl);
            const workerResult = await new Promise((resolve, reject) => {
                worker.onmessage = (event) => {
                    if (analysisToken !== spectrumAnalysis.token) {
                        worker.terminate();
                        resolve(null);
                    } else if (event.data.isDone) {
                        worker.terminate();
                        resolve(event.data);
                    } else {
                        showAnalysisProgressOnExportButton(event.data.progressRatio);
                    }
                };
                worker.onerror = (errorEvent) => {
                    worker.terminate();
                    reject(new Error(errorEvent.message || EXPORT_UI.workerAnalysisError));
                };
                worker.postMessage(
                    {
                        monoSamples,
                        sampleRate: AUDIO_EXPORT.sampleRate,
                        framesPerSecond: VIDEO_EXPORT.framesPerSecond,
                        fftSize: SPECTRUM.fftSize,
                        smoothingFactor: SPECTRUM.smoothingFactor,
                        bassFilterFrequency: SPECTRUM.bassFilterFrequency,
                        bassFilterGainDecibels: SPECTRUM.bassFilterGainDecibels,
                        minimumDecibels: SPECTRUM.minimumDecibels,
                        maximumDecibels: SPECTRUM.maximumDecibels,
                        progressFrameInterval: EXPORT_TIMING.spectrumProgressFrameInterval,
                    },
                    [monoSamples.buffer]
                );
            });
            URL.revokeObjectURL(workerUrl);
            if (!workerResult || analysisToken !== spectrumAnalysis.token) return;

            spectrumAnalysis.decodedAudioBuffer = decodedBuffer;
            spectrumAnalysis.frequencyFrames = workerResult.outputFrames;
            spectrumAnalysis.frameCount = workerResult.totalFrames;
            showAnalysisProgressOnExportButton(null);
            requestRedraw();
        })().catch((error) => {
            console.error(EXPORT_UI.workerAnalysisFailed, error);
            if (analysisToken === spectrumAnalysis.token) showAnalysisProgressOnExportButton(null, true);
            throw error;
        });

        spectrumAnalysis.promise.catch(() => { });
        return spectrumAnalysis.promise;
    }

    function resetSpectrumAnalysis() {
        spectrumAnalysis.token++;
        spectrumAnalysis.promise = null;
        spectrumAnalysis.decodedAudioBuffer = null;
        spectrumAnalysis.frequencyFrames = null;
        spectrumAnalysis.frameCount = 0;
    }

    function getFrequencyFrame(timeSeconds) {
        const frameIndex = Math.max(0, Math.min(spectrumAnalysis.frameCount - 1, Math.floor(timeSeconds * VIDEO_EXPORT.framesPerSecond)));
        const startIndex = frameIndex * SPECTRUM.binCount;
        return spectrumAnalysis.frequencyFrames.subarray(startIndex, startIndex + SPECTRUM.binCount);
    }

    // PREVIEW ENGINE (resolusi adaptif, ringan)
    const setPreviewLevel = (index) => {
        STATE_PREVIEW.previewLevelIndex = index;

        const canvas = STATE_PREVIEW.previewContext.canvas;
        canvas.width = PREVIEW_DEFAULT_WIDTH_LEVELS[index];
        canvas.height = Math.round((PREVIEW_DEFAULT_WIDTH_LEVELS[index] * DESIGN_DEFAULT_HEIGHT) / DESIGN_DEFAULT_WIDTH);

        STATE_PREVIEW.previewSlowFrameCount = 0;
        STATE_PREVIEW.PreviewAverageCostMilliseconds = 0;
    }

    function setupLiveAnalyser(audioElement) {
        if (liveAudio.audioContext) return;
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = SPECTRUM.fftSize;
        analyserNode.smoothingTimeConstant = SPECTRUM.smoothingFactor;
        const sourceNode = audioContext.createMediaElementSource(audioElement);

        const bassFilter = audioContext.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = SPECTRUM.bassFilterFrequency;
        bassFilter.gain.value = SPECTRUM.bassFilterGainDecibels;
        const outputGain = audioContext.createGain();
        outputGain.gain.value = 1;

        sourceNode.connect(bassFilter);
        bassFilter.connect(analyserNode);
        analyserNode.connect(outputGain);
        outputGain.connect(audioContext.destination);

        liveAudio.audioContext = audioContext;
        liveAudio.analyserNode = analyserNode;
        liveAudio.frequencyData = new Uint8Array(analyserNode.frequencyBinCount);
    }

    async function resumeAudioContext() {
        if (liveAudio.audioContext && liveAudio.audioContext.state === 'suspended') {
            try {
                await liveAudio.audioContext.resume();
            } catch (error) {
                console.error(error);
            }
        }
    }

    function renderPreviewFrame(isPlaying) {
        const audioElement = document.querySelector(SELECTORS.elementAudio);
        const context = STATE_PREVIEW.previewContext;
        const scale = context.canvas.width / DESIGN_DEFAULT_WIDTH;
        const startTimestamp = performance.now();
        const deltaSeconds = isPlaying ? Math.min(0.1, (startTimestamp - STATE_PREVIEW.lastDrawTimestamp) / 1000) : 0;
        STATE_PREVIEW.lastDrawTimestamp = startTimestamp;

        let frequencyData = STATE_PREVIEW.silentFrequencyData;
        if (spectrumAnalysis.frequencyFrames) {
            frequencyData = getFrequencyFrame(audioElement.currentTime);
        } else if (liveAudio.analyserNode && liveAudio.frequencyData) {
            liveAudio.analyserNode.getByteFrequencyData(liveAudio.frequencyData);
            frequencyData = liveAudio.frequencyData;
        }

        context.setTransform(scale, 0, 0, scale, 0, 0);
        drawFrame(context, audioElement.currentTime * 1000, STATE_PREVIEW.fadeState, {
            durationMilliseconds: (audioElement.duration || 0) * 1000,
            offsetSeconds: parseFloat(document.querySelector(SELECTORS.elementInput.offset)?.value) || 0,
            frequencyData,
            mouseState: STATE_PREVIEW.mouse,
            snapFades: !isPlaying,
            deltaSeconds,
            backgroundResource: appState.backgroundResource,
            isIntroAudioPlaying: false,
            headerLines: getTextareaLines(SELECTORS.elementTextarea.header),
            footerLines: getTextareaLines(SELECTORS.elementTextarea.footer),
            isSpectrumEnabled: appState.isSpectrumEnabled,
        });
        context.setTransform(1, 0, 0, 1, 0, 0);

        /* Turunkan resolusi preview otomatis jika menggambar terlalu lambat */
        if (isPlaying && !document.fullscreenElement) {
            const frameCost = performance.now() - startTimestamp;
            STATE_PREVIEW.PreviewAverageCostMilliseconds = STATE_PREVIEW.PreviewAverageCostMilliseconds * 0.9 + frameCost * 0.1;
            if (STATE_PREVIEW.PreviewAverageCostMilliseconds > PREVIEW_SLOW_FRAME_COST_MILLISECONDS && STATE_PREVIEW.previewLevelIndex < PREVIEW_DEFAULT_WIDTH_LEVELS.length - 1) {
                STATE_PREVIEW.previewSlowFrameCount++;
                if (STATE_PREVIEW.previewSlowFrameCount > PREVIEW_SLOW_FRAMES_BEFORE_DOWNGRADE) setPreviewLevel(STATE_PREVIEW.previewLevelIndex + 1);
            } else {
                STATE_PREVIEW.previewSlowFrameCount = Math.max(0, STATE_PREVIEW.previewSlowFrameCount - 1);
            }
        }
    }

    function redrawImmediately() {
        if (appState.isExporting) return;
        renderPreviewFrame(false);
    }

    function requestRedraw() {
        if (appState.isPlaying || STATE_PREVIEW.pendingRedrawId || appState.isExporting) return;
        STATE_PREVIEW.pendingRedrawId = requestAnimationFrame(() => {
            STATE_PREVIEW.pendingRedrawId = null;
            if (!appState.isPlaying) redrawImmediately();
        });
    }

    function playbackLoop() {
        if (!appState.isPlaying) {
            appState.animationFrameId = null;
            return;
        }
        const nowTimestamp = performance.now();
        const minimumFrameInterval = 1000 / VIDEO_EXPORT.framesPerSecond - 2;
        if (nowTimestamp - STATE_PREVIEW.lastLoopTimestamp >= minimumFrameInterval) {
            STATE_PREVIEW.lastLoopTimestamp = nowTimestamp;
            renderPreviewFrame(true);
        }
        appState.animationFrameId = requestAnimationFrame(playbackLoop);
    }

    function startPlaybackLoop() {
        if (appState.animationFrameId || appState.isExporting) return;
        appState.isPlaying = true;
        STATE_PREVIEW.lastDrawTimestamp = performance.now();
        appState.animationFrameId = requestAnimationFrame(playbackLoop);
    }

    function stopPlaybackLoop() {
        if (appState.animationFrameId) {
            cancelAnimationFrame(appState.animationFrameId);
            appState.animationFrameId = null;
        }
        if (STATE_PREVIEW.pendingRedrawId) {
            cancelAnimationFrame(STATE_PREVIEW.pendingRedrawId);
            STATE_PREVIEW.pendingRedrawId = null;
        }
        appState.isPlaying = false;
    }

    // EXPORT ENGINE  (WebCodecs: GPU dulu, otomatis fallback ke CPU)
    const exportUi = {
        overlay: () => document.querySelector(SELECTORS.mp4Export.overlay),
        title: () => document.querySelector(SELECTORS.mp4Export.title),
        status: () => document.querySelector(SELECTORS.mp4Export.status),
        progressBar: () => document.querySelector(SELECTORS.mp4Export.progressBar),
        cancelButton: () => document.querySelector(SELECTORS.mp4Export.cancelButton),
    };

    function updateExportUi(statusText, progressRatio) {
        exportUi.status().style.whiteSpace = 'pre-line';
        exportUi.status().textContent = statusText;
        if (progressRatio !== undefined) exportUi.progressBar().style.width = `${(progressRatio * 100).toFixed(1)}%`;
    }

    function throwIfExportCancelled() {
        if (exportControl.isCancelRequested) throw EXPORT_CANCELLED;
    }

    function setExportButtonState(button, isExporting) {
        button.disabled = false;
        button.classList.toggle('border-key', !isExporting);
        button.classList.toggle('bg-key', !isExporting);
        button.classList.toggle('border-red', isExporting);
        button.classList.toggle('bg-red', isExporting);
        button.textContent = isExporting ? EXPORT_UI.buttonActive : EXPORT_UI.buttonIdle;
    }

    function loadVideoElement(videoUrl) {
        return new Promise((resolve, reject) => {
            const videoElement = document.createElement('video');
            videoElement.muted = true;
            videoElement.playsInline = true;
            videoElement.preload = 'auto';
            videoElement.onloadeddata = () => resolve(videoElement);
            videoElement.onerror = () => reject(new Error(EXPORT_UI.videoLoadError));
            videoElement.src = videoUrl;
            videoElement.load();
        });
    }

    function seekVideoToTime(videoElement, targetSeconds) {
        return new Promise((resolve) => {
            if (Math.abs(videoElement.currentTime - targetSeconds) < EXPORT_TIMING.seekToleranceSeconds) return resolve();
            let isResolved = false;
            const finish = () => {
                if (isResolved) return;
                isResolved = true;
                clearTimeout(timeoutId);
                videoElement.removeEventListener('seeked', finish);
                resolve();
            };
            const timeoutId = setTimeout(finish, EXPORT_TIMING.seekTimeoutMs);
            videoElement.addEventListener('seeked', finish);
            videoElement.currentTime = targetSeconds;
        });
    }

    async function decodeAudioFile(audioFile) {
        const decodingContext = new OfflineAudioContext(AUDIO_EXPORT.numberOfChannels, AUDIO_EXPORT.decodeLength, AUDIO_EXPORT.sampleRate);
        return decodingContext.decodeAudioData(await audioFile.arrayBuffer());
    }

    // Encoder audio: AAC, fallback Opus. Di-encode SEKALI.
    async function findAudioEncoderConfig() {
        for (const candidate of AUDIO_EXPORT.encoderCandidates) {
            const config = {
                codec: candidate.encoderCodec,
                sampleRate: AUDIO_EXPORT.sampleRate,
                numberOfChannels: AUDIO_EXPORT.numberOfChannels,
                bitrate: AUDIO_EXPORT.bitsPerSecond,
            };
            try {
                const support = await AudioEncoder.isConfigSupported(config);
                if (support.supported) return { encoderConfig: support.config, muxerCodec: candidate.muxerCodec };
            } catch (error) {
                /* coba kandidat berikutnya */
            }
        }
        throw new Error(EXPORT_UI.noAudioEncoder);
    }

    function copySamplesInto(destination, destinationOffset, source, sourceStart, sampleCount) {
        if (!source || sampleCount <= 0) return;
        const clampedStart = Math.max(0, sourceStart);
        const clampedEnd = Math.min(source.length, sourceStart + sampleCount);
        if (clampedEnd > clampedStart) {
            destination.set(source.subarray(clampedStart, clampedEnd), destinationOffset + (clampedStart - sourceStart));
        }
    }

    async function encodeAudioTrack(exportInputs, reportProgress) {
        const { encoderConfig, muxerCodec } = await findAudioEncoderConfig();
        const sampleRate = AUDIO_EXPORT.sampleRate;
        const introSampleCount = Math.round(exportInputs.introDurationSeconds * sampleRate);
        const totalSampleCount = introSampleCount + exportInputs.mainLeftChannel.length;
        const encodedChunks = [];
        let encoderError = null;
        let isFirstChunk = true;

        const audioEncoder = new AudioEncoder({
            output: (chunk, metadata) => {
                encodedChunks.push({ chunk, metadata: isFirstChunk ? metadata : undefined });
                isFirstChunk = false;
            },
            error: (error) => {
                encoderError = error;
            },
        });
        audioEncoder.configure(encoderConfig);

        try {
            for (let startSample = 0; startSample < totalSampleCount; startSample += AUDIO_EXPORT.framesPerChunk) {
                throwIfExportCancelled();
                if (encoderError) throw encoderError;

                const framesInChunk = Math.min(AUDIO_EXPORT.framesPerChunk, totalSampleCount - startSample);
                /* Format "f32-planar": seluruh channel kiri dulu, lalu seluruh channel kanan */
                const planarSamples = new Float32Array(framesInChunk * AUDIO_EXPORT.numberOfChannels);

                const introFrames = Math.max(0, Math.min(framesInChunk, introSampleCount - startSample));
                if (introFrames > 0) {
                    copySamplesInto(planarSamples, 0, exportInputs.introLeftChannel, startSample, introFrames);
                    copySamplesInto(planarSamples, framesInChunk, exportInputs.introRightChannel || exportInputs.introLeftChannel, startSample, introFrames);
                }
                const mainFrames = framesInChunk - introFrames;
                if (mainFrames > 0) {
                    const mainStartSample = Math.max(0, startSample - introSampleCount);
                    copySamplesInto(planarSamples, introFrames, exportInputs.mainLeftChannel, mainStartSample, mainFrames);
                    copySamplesInto(planarSamples, framesInChunk + introFrames, exportInputs.mainRightChannel || exportInputs.mainLeftChannel, mainStartSample, mainFrames);
                }

                const audioData = new AudioData({
                    format: AUDIO_EXPORT.format,
                    sampleRate,
                    numberOfFrames: framesInChunk,
                    numberOfChannels: AUDIO_EXPORT.numberOfChannels,
                    timestamp: Math.round((startSample * 1_000_000) / sampleRate),
                    data: planarSamples,
                });
                try {
                    audioEncoder.encode(audioData);
                } finally {
                    audioData.close();
                }

                while (audioEncoder.encodeQueueSize > AUDIO_EXPORT.maximumPendingChunks) {
                    throwIfExportCancelled();
                    await waitMilliseconds(EXPORT_TIMING.backpressurePollMs);
                }
                if ((startSample / AUDIO_EXPORT.framesPerChunk) % EXPORT_TIMING.audioProgressChunkInterval === 0) {
                    reportProgress(startSample / totalSampleCount);
                    await yieldToBrowser();
                }
            }
            await audioEncoder.flush();
        } finally {
            try {
                if (audioEncoder.state !== 'closed') audioEncoder.close();
            } catch (error) {
                /* abaikan */
            }
        }
        if (encoderError) throw encoderError;
        return { chunks: encodedChunks, muxerCodec };
    }

    // Encoder video: daftar kandidat, GPU dulu lalu CPU
    async function findVideoEncoderCandidates() {
        const candidates = [];
        for (const mode of VIDEO_EXPORT.encoderModes) {
            for (const codecString of VIDEO_EXPORT.h264CodecStrings) {
                const config = {
                    codec: codecString,
                    width: VIDEO_EXPORT.width,
                    height: VIDEO_EXPORT.height,
                    bitrate: VIDEO_EXPORT.bitsPerSecond,
                    framerate: VIDEO_EXPORT.framesPerSecond,
                    hardwareAcceleration: mode.hardwareAcceleration,
                    latencyMode: VIDEO_EXPORT.latencyMode,
                    bitrateMode: VIDEO_EXPORT.bitrateMode,
                    avc: { format: VIDEO_EXPORT.codecFormat },
                };
                try {
                    const support = await VideoEncoder.isConfigSupported(config);
                    if (support.supported) candidates.push({ config: support.config, label: `H.264 ${mode.label} (${codecString})` });
                } catch (error) {
                    /* kandidat tidak didukung */
                }
            }
        }
        if (!candidates.length) throw new Error(EXPORT_UI.noVideoEncoder);
        return candidates;
    }

    // Output: tulis langsung ke disk, atau kumpulkan sebagai Blob
    function createBlobStreamTarget() {
        let assembledBlob = new Blob([]);
        let writtenEndPosition = 0;
        const target = new Mp4Muxer.StreamTarget({
            chunked: true,
            chunkSize: BLOB_CHUNK_SIZE,
            onData: (data, position) => {
                const dataBytes = new Uint8Array(data);
                const dataBlob = new Blob([dataBytes]);
                if (position >= writtenEndPosition) {
                    if (position > writtenEndPosition) assembledBlob = new Blob([assembledBlob, new Uint8Array(position - writtenEndPosition)]);
                    assembledBlob = new Blob([assembledBlob, dataBlob]);
                    writtenEndPosition = position + dataBytes.length;
                } else {
                    const afterStart = Math.min(writtenEndPosition, position + dataBytes.length);
                    assembledBlob = new Blob([assembledBlob.slice(0, position), dataBlob, assembledBlob.slice(afterStart)]);
                    writtenEndPosition = Math.max(writtenEndPosition, position + dataBytes.length);
                }
            },
        });
        return { target, getBlob: () => new Blob([assembledBlob], { type: MUXER_EXPORT.mimeType }) };
    }

    function downloadBlob(blob, fileName) {
        const objectUrl = URL.createObjectURL(blob);
        const linkElement = document.createElement('a');
        linkElement.href = objectUrl;
        linkElement.download = fileName;
        linkElement.click();
        setTimeout(() => URL.revokeObjectURL(objectUrl), lyricsSettings.recording.objectUrlRevokeDelayMilliseconds);
    }

    // Render satu file dengan satu kandidat encoder
    async function renderVideoFile(exportInputs, videoCandidate) {
        const { width, height, framesPerSecond } = VIDEO_EXPORT;
        const sampleRate = AUDIO_EXPORT.sampleRate;
        const outputFileName = `${lyricsSettings.export.fileName}_${VIDEO_EXPORT.outputFileSuffix}.${VIDEO_EXPORT.fileExtension}`;
        const encoderDescription = `${videoCandidate.label} + ${exportInputs.muxerAudioCodec.toUpperCase()}`;
        const opusWarning = exportInputs.muxerAudioCodec === 'opus' ? EXPORT_UI.opusWarning : '';
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d', { alpha: VIDEO_EXPORT.canvasAlpha });
        if (!context) throw new Error(EXPORT_UI.noCanvasContext);

        let fileWriter = null;
        let blobOutput = null;
        let muxerTarget;
        if (exportInputs.directoryHandle) {
            const fileHandle = await exportInputs.directoryHandle.getFileHandle(outputFileName, { create: true });
            fileWriter = await fileHandle.createWritable();
            muxerTarget = new Mp4Muxer.FileSystemWritableFileStreamTarget(fileWriter);
        } else {
            blobOutput = createBlobStreamTarget();
            muxerTarget = blobOutput.target;
        }

        const muxer = new Mp4Muxer.Muxer({
            target: muxerTarget,
            fastStart: MUXER_EXPORT.fastStart,
            firstTimestampBehavior: MUXER_EXPORT.firstTimestampBehavior,
            video: { codec: VIDEO_EXPORT.codec, width, height, frameRate: framesPerSecond },
            audio: { codec: exportInputs.muxerAudioCodec, numberOfChannels: AUDIO_EXPORT.numberOfChannels, sampleRate },
        });

        let encoderError = null;
        const videoEncoder = new VideoEncoder({
            output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
            error: (error) => {
                encoderError = error;
            },
        });
        videoEncoder.configure(videoCandidate.config);

        const fadeState = { backgroundOpacity: 0, overlayOpacity: 0 };

        const mainDurationMilliseconds = (exportInputs.mainLeftChannel.length / sampleRate) * 1000;
        const introSampleCount = Math.round(exportInputs.introDurationSeconds * sampleRate);
        const totalSampleCount = introSampleCount + exportInputs.mainLeftChannel.length;
        const totalFrames = Math.ceil((totalSampleCount / sampleRate) * framesPerSecond);

        let backgroundVideoElement = null;
        let introVideoElement = null;
        let lastBackgroundSeekSeconds = -1;
        let lastIntroSeekSeconds = -1;
        let hasRenderedMainFrame = false;
        let nextAudioChunkIndex = 0;
        let isFinished = false;

        /* Masukkan chunk audio ke muxer secara bergantian dengan video agar file ter-interleave */
        const muxAudioChunksUpTo = (timestampMicroseconds) => {
            const audioChunks = exportInputs.audioChunks;
            while (nextAudioChunkIndex < audioChunks.length && audioChunks[nextAudioChunkIndex].chunk.timestamp <= timestampMicroseconds) {
                muxer.addAudioChunk(audioChunks[nextAudioChunkIndex].chunk, audioChunks[nextAudioChunkIndex].metadata);
                nextAudioChunkIndex++;
            }
        };

        try {
            if (exportInputs.isBackgroundVideo) backgroundVideoElement = await loadVideoElement(exportInputs.backgroundUrl);
            if (exportInputs.isIntroVideo) introVideoElement = await loadVideoElement(exportInputs.introUrl);

            const baseFrameOptions = {
                durationMilliseconds: mainDurationMilliseconds,
                offsetSeconds: exportInputs.offsetSeconds,
                frequencyData: STATE_PREVIEW.silentFrequencyData,
                mouseState: null,
                snapFades: false,
                deltaSeconds: 1 / framesPerSecond,
                headerLines: exportInputs.headerLines,
                footerLines: exportInputs.footerLines,
                isSpectrumEnabled: exportInputs.isSpectrumEnabled,
            };

            const renderStartTimestamp = performance.now();
            for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                throwIfExportCancelled();
                if (encoderError) throw encoderError;

                const timelineSeconds = frameIndex / framesPerSecond;

                if (timelineSeconds < exportInputs.introDurationSeconds) {
                    /* --- Intro --- */
                    if (introVideoElement) {
                        const introSeekSeconds = Math.min(timelineSeconds, Math.max(0, introVideoElement.duration - 0.01));
                        if (lastIntroSeekSeconds < 0 || Math.abs(introSeekSeconds - lastIntroSeekSeconds) >= EXPORT_TIMING.seekIntervalSeconds) {
                            await seekVideoToTime(introVideoElement, introSeekSeconds);
                            lastIntroSeekSeconds = introSeekSeconds;
                        }
                        context.fillStyle = '#000000';
                        context.fillRect(0, 0, width, height);
                        drawMediaCover(context, { type: 'video', element: introVideoElement });
                    } else {
                        let introBackground = exportInputs.staticBackground;
                        if (backgroundVideoElement) {
                            if (lastBackgroundSeekSeconds < 0) {
                                await seekVideoToTime(backgroundVideoElement, 0);
                                lastBackgroundSeekSeconds = 0;
                            }
                            introBackground = { type: 'video', element: backgroundVideoElement };
                        }
                        drawFrame(context, 0, fadeState, { ...baseFrameOptions, backgroundResource: introBackground, isIntroAudioPlaying: true });
                    }
                } else {
                    /* --- Konten utama --- */
                    const mainSeconds = timelineSeconds - exportInputs.introDurationSeconds;
                    if (!hasRenderedMainFrame) {
                        fadeState.backgroundOpacity = FADE_STYLE.backgroundMaximumOpacity;
                        hasRenderedMainFrame = true;
                    }
                    let backgroundResource = exportInputs.staticBackground;
                    if (backgroundVideoElement) {
                        const videoDuration = backgroundVideoElement.duration || EXPORT_TIMING.backgroundVideoDurationFallbackSeconds;
                        const backgroundSeekSeconds = mainSeconds % videoDuration;
                        const hasLooped = backgroundSeekSeconds < lastBackgroundSeekSeconds;
                        if (lastBackgroundSeekSeconds < 0 || hasLooped || backgroundSeekSeconds - lastBackgroundSeekSeconds >= EXPORT_TIMING.seekIntervalSeconds) {
                            await seekVideoToTime(backgroundVideoElement, Math.min(backgroundSeekSeconds, videoDuration - 0.01));
                            lastBackgroundSeekSeconds = backgroundSeekSeconds;
                        }
                        backgroundResource = { type: 'video', element: backgroundVideoElement };
                    }
                    const frequencyData = exportInputs.isSpectrumEnabled ? exportInputs.getFrequencyFrame(mainSeconds) : STATE_PREVIEW.silentFrequencyData;
                    drawFrame(context, mainSeconds * 1000, fadeState, {
                        ...baseFrameOptions,
                        backgroundResource,
                        frequencyData,
                        isIntroAudioPlaying: false,
                    });
                }

                const videoFrame = new VideoFrame(canvas, {
                    timestamp: Math.round((frameIndex * 1_000_000) / framesPerSecond),
                    duration: Math.round(1_000_000 / framesPerSecond),
                });
                try {
                    videoEncoder.encode(videoFrame, { keyFrame: frameIndex % VIDEO_EXPORT.keyFrameIntervalInFrames === 0 });
                } finally {
                    videoFrame.close();
                }

                muxAudioChunksUpTo((timelineSeconds + EXPORT_TIMING.audioInterleaveLookaheadSeconds) * 1_000_000);

                /* Backpressure: jangan menumpuk frame yang menunggu encoder */
                while (videoEncoder.encodeQueueSize > VIDEO_EXPORT.maximumPendingFrames) {
                    throwIfExportCancelled();
                    if (encoderError) throw encoderError;
                    await waitMilliseconds(EXPORT_TIMING.backpressurePollMs);
                }
                if (frameIndex % EXPORT_TIMING.yieldFrameInterval === 0) await yieldToBrowser();

                if (frameIndex % EXPORT_TIMING.statusFrameInterval === 0) {
                    const elapsedSeconds = Math.max(EXPORT_TIMING.minimumElapsedSeconds, (performance.now() - renderStartTimestamp) / 1000);
                    const renderFramesPerSecond = (frameIndex + 1) / elapsedSeconds;
                    const remainingSeconds = (totalFrames - frameIndex) / renderFramesPerSecond;
                    const elapsed = `${Math.floor(elapsedSeconds / 60)}m ${Math.floor(elapsedSeconds % 60)}s`;
                    const remaining = `${Math.floor(remainingSeconds / 60)}m ${Math.floor(remainingSeconds % 60)}s`;

                    const progressStatus = `⏱ ${elapsed} ⏲ ${remaining} ᯓ ${renderFramesPerSecond.toFixed(1)} fps ⛶ ${frameIndex}/${totalFrames}`;

                    updateExportUi(`${encoderDescription}${opusWarning}\n${progressStatus}`, frameIndex / totalFrames);
                }
            }

            muxAudioChunksUpTo(Infinity);
            updateExportUi(EXPORT_UI.finalizing, 1);

            await videoEncoder.flush();
            if (encoderError) throw encoderError;
            muxer.finalize();

            if (fileWriter) {
                await fileWriter.close();
                fileWriter = null;
            } else {
                downloadBlob(blobOutput.getBlob(), outputFileName);
            }
            isFinished = true;
        } finally {
            try {
                if (videoEncoder.state !== 'closed') videoEncoder.close();
            } catch (error) {
                /* abaikan */
            }
            if (fileWriter) {
                try {
                    await fileWriter.abort();
                } catch (error) {
                    /* abaikan */
                }
            }
            if (backgroundVideoElement) {
                backgroundVideoElement.removeAttribute('src');
                backgroundVideoElement.load();
            }
            if (introVideoElement) {
                introVideoElement.removeAttribute('src');
                introVideoElement.load();
            }
            if (!isFinished && exportInputs.directoryHandle) {
                try {
                    await exportInputs.directoryHandle.removeEntry(outputFileName);
                } catch (error) {
                    /* abaikan */
                }
            }
        }
    }

    /* Coba setiap encoder berurutan (GPU → CPU). Jika satu gagal di tengah jalan, ulang dengan berikutnya. */
    async function renderWithEncoderFallback(exportInputs) {
        const videoCandidates = await findVideoEncoderCandidates();
        let lastError = null;
        for (let candidateIndex = 0; candidateIndex < videoCandidates.length; candidateIndex++) {
            const videoCandidate = videoCandidates[candidateIndex];
            try {
                await renderVideoFile(exportInputs, videoCandidate);
                return;
            } catch (error) {
                if (error === EXPORT_CANCELLED) throw error;
                lastError = error;
                console.warn(EXPORT_UI.encoderFailed.replace('{encoder}', videoCandidate.label), error);
                if (candidateIndex < videoCandidates.length - 1) {
                    const fallbackStatus = EXPORT_UI.encoderFallback
                        .replace('{encoder}', videoCandidate.label)
                        .replace('{next}', videoCandidates[candidateIndex + 1].label);
                    updateExportUi(fallbackStatus, 0);
                    await waitMilliseconds(EXPORT_TIMING.fallbackDelayMs);
                }
            }
        }
        throw lastError || new Error(EXPORT_UI.noEncoderFallback);
    }

    async function collectExportInputs(directoryHandle) {
        const decodedMainBuffer = spectrumAnalysis.decodedAudioBuffer;
        const exportInputs = {
            directoryHandle,
            mainLeftChannel: decodedMainBuffer.getChannelData(0),
            mainRightChannel: decodedMainBuffer.numberOfChannels > 1 ? decodedMainBuffer.getChannelData(1) : null,
            introLeftChannel: null,
            introRightChannel: null,
            introDurationSeconds: 0,
            isIntroVideo: false,
            introUrl: null,
            backgroundUrl: null,
            isBackgroundVideo: false,
            staticBackground: null,
            offsetSeconds: parseFloat(document.querySelector(SELECTORS.elementInput.offset)?.value) || 0,
            headerLines: getTextareaLines(SELECTORS.elementTextarea.header),
            footerLines: getTextareaLines(SELECTORS.elementTextarea.footer),
            isSpectrumEnabled: appState.isSpectrumEnabled,
            getFrequencyFrame,
            audioChunks: [],
            muxerAudioCodec: AUDIO_EXPORT.defaultMuxerCodec,
        };

        const introFile = document.querySelector(SELECTORS.elementInput.intro)?.files?.[0];
        if (introFile) {
            exportInputs.isIntroVideo = introFile.type.startsWith('video/');
            exportInputs.introUrl = URL.createObjectURL(introFile);
            try {
                const decodedIntroBuffer = await decodeAudioFile(introFile);
                exportInputs.introLeftChannel = decodedIntroBuffer.getChannelData(0);
                exportInputs.introRightChannel = decodedIntroBuffer.numberOfChannels > 1 ? decodedIntroBuffer.getChannelData(1) : null;
                exportInputs.introDurationSeconds = decodedIntroBuffer.duration;
            } catch (error) {
                console.warn(EXPORT_UI.introAudioUnavailable, error);
            }
            if (exportInputs.isIntroVideo) {
                const probeVideo = await loadVideoElement(exportInputs.introUrl);
                exportInputs.introDurationSeconds = probeVideo.duration || exportInputs.introDurationSeconds;
                probeVideo.removeAttribute('src');
                probeVideo.load();
            }
        }

        if (appState.backgroundResource) {
            if (appState.backgroundResource.type === 'video') {
                exportInputs.isBackgroundVideo = true;
                exportInputs.backgroundUrl = appState.backgroundResource.element.src;
            } else {
                exportInputs.staticBackground = appState.backgroundResource;
            }
        }
        return exportInputs;
    }

    function waitForOverlayDismissal() {
        return new Promise((resolve) => {
            exportUi.cancelButton().onclick = () => resolve();
        });
    }

    const startExport = async () => {
        const audioElement = document.querySelector(SELECTORS.elementAudio);
        const exportButton = document.querySelector(SELECTORS.elementButton.export);

        if (!audioElement.src) {
            alert(MISSING_AUDIO);

            return;
        }

        const isWebCodecsAvailable = 'VideoEncoder' in window && 'AudioEncoder' in window && 'VideoFrame' in window && 'OffscreenCanvas' in window;
        if (!isWebCodecsAvailable) {
            alert(EXPORT_UI.unsupportedBrowser);

            return;
        }

        let directoryHandle = null;
        if (window.showDirectoryPicker) {
            try {
                directoryHandle = await window.showDirectoryPicker(FILE_PICKER);
            } catch (error) {
                if (error.name === 'AbortError') {
                    return;
                }

                console.warn(EXPORT_UI.noFolderFallback, error);
                directoryHandle = null;
            }
        }

        exportControl.isCancelRequested = false;
        appState.isExporting = true;

        stopPlaybackLoop();

        audioElement.pause();

        setExportButtonState(exportButton, true);

        exportUi.overlay().classList.replace('hidden', 'flex');
        exportUi.title().textContent = EXPORT_UI.title;
        exportUi.cancelButton().textContent = EXPORT_UI.cancel;
        updateExportUi(EXPORT_UI.preparing, 0);
        try {
            exportControl.wakeLock = await navigator.wakeLock?.request(WAKE_LOCK_TYPE);
        } catch (error) {
            console.warn(EXPORT_UI.wakeLockRequestFailed, error);
        }

        try {
            await spectrumAnalysis.promise;
            if (!spectrumAnalysis.decodedAudioBuffer || !spectrumAnalysis.frequencyFrames) {
                throw new Error(EXPORT_UI.analysisError);
            }

            updateExportUi(EXPORT_UI.preparingMedia, 0);

            const exportInputs = await collectExportInputs(directoryHandle);

            updateExportUi(EXPORT_UI.encodingAudio, 0);

            const audioTrack = await encodeAudioTrack(exportInputs, (progressRatio) => {
                exportUi.progressBar().style.width = `${progressRatio * EXPORT_TIMING.audioProgressWeight * 100}%`;
            });

            exportInputs.audioChunks = audioTrack.chunks;
            exportInputs.muxerAudioCodec = audioTrack.muxerCodec;

            await renderWithEncoderFallback(exportInputs);
            if (exportInputs.introUrl) {
                URL.revokeObjectURL(exportInputs.introUrl);
            }

            updateExportUi(directoryHandle ? EXPORT_UI.saved : EXPORT_UI.downloaded, 1);

            exportUi.cancelButton().textContent = EXPORT_UI.close;

            await waitForOverlayDismissal();
        } catch (error) {
            exportUi.cancelButton().textContent = EXPORT_UI.close;
            if (error === EXPORT_CANCELLED) {
                updateExportUi(`${EXPORT_UI.exportCancelled}\n${EXPORT_UI.incompleteOutput}`);
            } else {
                console.error(EXPORT_UI.exportFailed, error);
                exportUi.title().textContent = EXPORT_UI.exportError;

                updateExportUi(String((error && error.message) || error));
            }

            await waitForOverlayDismissal();
        } finally {
            try {
                exportControl.wakeLock?.release();
            } catch (error) {
                console.warn(EXPORT_UI.wakeLockReleaseFailed, error);
            }
            exportControl.wakeLock = null;
            exportUi.overlay().classList.replace('flex', 'hidden');
            exportUi.cancelButton().onclick = () => {
                exportControl.isCancelRequested = true;
            };

            appState.isExporting = false;
            setExportButtonState(exportButton, false);
            audioElement.currentTime = 0;
            redrawImmediately();
        }
    }

    // UI, PENYIMPANAN & TEMPLATE
    function revokeBackgroundObjectUrl() {
        const sourceUrl = appState.backgroundResource?.element?.src;
        if (sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(sourceUrl);
    }

    function updateRemoveButtonsVisibility() {
        const audioElement = document.querySelector(SELECTORS.elementAudio);
        document.querySelector(SELECTORS.elementButton.removeAudio)?.classList.toggle('hidden', !audioElement.src);
        document.querySelector(SELECTORS.elementButton.removeBackground)?.classList.toggle('hidden', !appState.backgroundResource);
        document.querySelector(SELECTORS.elementButton.removeIntro)?.classList.toggle('hidden', !(document.querySelector(SELECTORS.elementInput.intro)?.files?.length > 0));
    }

    function loadBackgroundResource(objectUrl, mediaType, onLoaded) {
        if (mediaType === 'image') {
            const imageElement = new Image();
            imageElement.onload = () => {
                appState.backgroundResource = { type: 'image', element: imageElement };
                onLoaded?.();
            };
            imageElement.src = objectUrl;
            return;
        }
        const videoElement = document.createElement('video');
        videoElement.src = objectUrl;
        videoElement.muted = true;
        videoElement.loop = true;
        videoElement.playsInline = true;
        videoElement.onloadeddata = () => {
            videoElement.play().catch(() => { });
            appState.backgroundResource = { type: 'video', element: videoElement };
            onLoaded?.();
        };
        videoElement.load();
    }

    function bindColorInput(selector, storageKey, stateKey) {
        document.querySelector(selector).addEventListener('input', (event) => {
            appState[stateKey] = event.target.value;
            writeStoredValue(storageKey, event.target.value);
            requestRedraw();
        });
    }

    // Template header / footer
    function getTemplateStorageKey(templateType) {
        return templateType === 'header' ? STORAGE_KEYS.headerTemplates : STORAGE_KEYS.footerTemplates;
    }

    function loadTemplates(templateType) {
        return JSON.parse(readStoredValue(getTemplateStorageKey(templateType), '[]'));
    }

    function saveTemplates(templateType, templates) {
        writeStoredValue(getTemplateStorageKey(templateType), JSON.stringify(templates));
    }

    function createTemplateButton(label, extraClassNames) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `cursor-pointer rounded-lg border px-4 py-2 text-xs font-bold shadow-lg transition-all active:scale-95 ${extraClassNames}`;
        button.textContent = label;
        return button;
    }

    function renderTemplateList(dialogElement, templateType) {
        const listContainer = dialogElement.querySelector('.element_template_list');
        listContainer.replaceChildren();
        const templates = loadTemplates(templateType);

        if (!templates.length) {
            const emptyMessage = document.createElement('div');
            emptyMessage.className = 'border-border text-meta rounded-2xl border border-dashed p-8 text-center text-sm';
            emptyMessage.textContent = TEMPLATE_MESSAGES.emptyState;
            listContainer.append(emptyMessage);
            return;
        }

        templates.forEach((template, templateIndex) => {
            const row = document.createElement('div');
            row.className = 'border-border bg-background/60 flex items-center justify-between gap-4 rounded-2xl border p-4';

            const infoContainer = document.createElement('div');
            infoContainer.className = 'min-w-0';
            const nameElement = document.createElement('p');
            nameElement.className = 'truncate text-sm font-bold';
            nameElement.textContent = template.name;
            const contentElement = document.createElement('p');
            contentElement.className = 'text-meta mt-1 truncate text-xs';
            contentElement.textContent = template.content;
            infoContainer.append(nameElement, contentElement);

            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'flex shrink-0 gap-2';

            const useButton = createTemplateButton(TEMPLATE_MESSAGES.useAction, 'bg-teal text-background hover:brightness-110');
            useButton.onclick = () => {
                const targetTextarea = document.querySelector(templateType === 'header' ? SELECTORS.elementTextarea.header : SELECTORS.elementTextarea.footer);
                targetTextarea.value = template.content;
                writeStoredValue(templateType === 'header' ? STORAGE_KEYS.lyricsHeader : STORAGE_KEYS.lyricsFooter, template.content);
                requestRedraw();
                dialogElement.close();
            };

            const editButton = createTemplateButton(TEMPLATE_MESSAGES.editAction, 'border-border border text-text');
            editButton.onclick = () => {
                const formElement = dialogElement.querySelector('.element_template_form');
                formElement.elements.name.value = template.name;
                formElement.elements.content.value = template.content;
                formElement.dataset.editingTemplateIndex = templateIndex;
                formElement.elements.name.focus();
            };

            const deleteButton = createTemplateButton(TEMPLATE_MESSAGES.deleteAction, 'text-red hover:bg-red/10');
            deleteButton.onclick = () => {
                if (confirm(TEMPLATE_MESSAGES.deleteConfirmation.replace('{name}', template.name))) {
                    templates.splice(templateIndex, 1);
                    saveTemplates(templateType, templates);
                    renderTemplateList(dialogElement, templateType);
                }
            };

            actionsContainer.append(useButton, editButton, deleteButton);
            row.append(infoContainer, actionsContainer);
            listContainer.append(row);
        });
    }

    function setupTemplateDialogs() {
        document.querySelectorAll(SELECTORS.elementDialog.template).forEach((dialogElement) => {
            const templateType = dialogElement.dataset.templateType;
            const openButtonSelector = templateType === 'header' ? '.element_button_select_header' : '.element_button_select_footer';

            document.querySelector(openButtonSelector).addEventListener('click', () => {
                renderTemplateList(dialogElement, templateType);
                dialogElement.showModal();
            });
            dialogElement.querySelector('.element_button_close_template').addEventListener('click', () => dialogElement.close());
            dialogElement.querySelector('.element_template_form').addEventListener('submit', (event) => {
                event.preventDefault();
                const formElement = event.currentTarget;
                const templates = loadTemplates(templateType);
                const editingIndex = formElement.dataset.editingTemplateIndex;
                const newTemplate = { name: formElement.elements.name.value.trim(), content: formElement.elements.content.value };
                if (editingIndex === undefined) {
                    templates.push(newTemplate);
                } else {
                    templates[Number(editingIndex)] = newTemplate;
                    delete formElement.dataset.editingTemplateIndex;
                }
                saveTemplates(templateType, templates);
                formElement.reset();
                renderTemplateList(dialogElement, templateType);
            });
        });
    }

    // Event listener utama
    const setupEventListeners = () => {
        const audioElement = document.querySelector(SELECTORS.elementAudio);
        const previewCanvas = document.querySelector(SELECTORS.elementCanvas.preview);
        const exportButton = document.querySelector(SELECTORS.elementButton.export);

        bindColorInput(SELECTORS.elementInput.backgroundColor, STORAGE_KEYS.colorBackground, 'backgroundColor');
        bindColorInput(SELECTORS.elementInput.keyColor, STORAGE_KEYS.colorKey, 'keyColor');
        bindColorInput(SELECTORS.elementInput.textColor, STORAGE_KEYS.colorText, 'textColor');

        const lyricsTextarea = document.querySelector(SELECTORS.elementTextarea.lyrics);
        lyricsTextarea.addEventListener('input', () => {
            const normalizedText = normalizeLyricsText(lyricsTextarea.value);
            lyricsTextarea.value = normalizedText;
            appState.parsedLyrics = parseLyricsText(normalizedText);
            redrawImmediately();
            writeStoredValue(STORAGE_KEYS.lyricsText, normalizedText);
        });

        document.querySelector(SELECTORS.elementTextarea.header).addEventListener('input', (event) => {
            writeStoredValue(STORAGE_KEYS.lyricsHeader, event.target.value);
            requestRedraw();
        });

        document.querySelector(SELECTORS.elementTextarea.footer).addEventListener('input', (event) => {
            writeStoredValue(STORAGE_KEYS.lyricsFooter, event.target.value);
            requestRedraw();
        });

        document.querySelector(SELECTORS.elementInput.offset).addEventListener('input', (event) => {
            writeStoredValue(STORAGE_KEYS.lyricsOffset, event.target.value);
            requestRedraw();
        });

        document.querySelector(SELECTORS.elementInput.audio).addEventListener('change', async (event) => {
            const audioFile = event.target.files?.[0];
            if (!audioFile) return;
            await saveToDatabase(PERSISTENCE_KEYS.audio, audioFile);
            audioElement.src = URL.createObjectURL(audioFile);
            audioElement.load();
            setupLiveAnalyser(audioElement);
            analyzeAudioBlob(audioFile);
            lyricsSettings.export.fileName = audioFile.name.replace(/\.[^/.]+$/, '');
            writeStoredValue(PERSISTENCE_KEYS.audioFileName, lyricsSettings.export.fileName);
            updateRemoveButtonsVisibility();
        });

        document.querySelector(SELECTORS.elementInput.background).addEventListener('change', async (event) => {
            const backgroundFile = event.target.files?.[0];
            if (!backgroundFile) return;
            revokeBackgroundObjectUrl();
            const mediaType = backgroundFile.type.startsWith('image/') ? 'image' : 'video';
            await saveToDatabase(PERSISTENCE_KEYS.background, backgroundFile);
            writeStoredValue(PERSISTENCE_KEYS.backgroundType, mediaType);
            loadBackgroundResource(URL.createObjectURL(backgroundFile), mediaType, () => {
                redrawImmediately();
                updateRemoveButtonsVisibility();
            });
        });

        document.querySelector(SELECTORS.elementInput.intro).addEventListener('change', async (event) => {
            const introFile = event.target.files?.[0];
            if (introFile && (introFile.type.startsWith('audio/') || introFile.type.startsWith('video/'))) {
                try {
                    await saveToDatabase(PERSISTENCE_KEYS.intro, introFile);
                    updateRemoveButtonsVisibility();
                } catch (error) {
                    console.warn(MEDIA_MESSAGES.saveIntroFailed, error);
                }
            }
        });

        document.querySelector(SELECTORS.elementButton.removeAudio).addEventListener('click', async () => {
            await saveToDatabase(PERSISTENCE_KEYS.audio, null);
            resetSpectrumAnalysis();
            audioElement.removeAttribute('src');
            audioElement.load();
            const audioInput = document.querySelector(SELECTORS.elementInput.audio);
            if (audioInput) audioInput.value = '';
            updateRemoveButtonsVisibility();
        });

        document.querySelector(SELECTORS.elementButton.removeBackground).addEventListener('click', async () => {
            revokeBackgroundObjectUrl();
            await saveToDatabase(PERSISTENCE_KEYS.background, null);
            writeStoredValue(PERSISTENCE_KEYS.backgroundType, '');
            appState.backgroundResource = null;
            const backgroundInput = document.querySelector(SELECTORS.elementInput.background);
            if (backgroundInput) backgroundInput.value = '';
            redrawImmediately();
            updateRemoveButtonsVisibility();
        });

        document.querySelector(SELECTORS.elementButton.removeIntro).addEventListener('click', async () => {
            await saveToDatabase(PERSISTENCE_KEYS.intro, null);
            const introInput = document.querySelector(SELECTORS.elementInput.intro);
            if (introInput) introInput.value = '';
            updateRemoveButtonsVisibility();
        });

        document.querySelector(SELECTORS.elementButton.fullscreen).addEventListener('click', () => {
            if (document.fullscreenElement) document.exitFullscreen();
            else previewCanvas.requestFullscreen().catch(console.error);
        });

        document.addEventListener('fullscreenchange', () => {
            setPreviewLevel(document.fullscreenElement ? 0 : Math.max(1, STATE_PREVIEW.previewLevelIndex));
            requestRedraw();
        });

        exportButton.addEventListener('click', () => {
            if (appState.isExporting) {
                exportControl.isCancelRequested = true;
            } else {
                startExport();
            }
        });

        exportUi.cancelButton().onclick = () => {
            exportControl.isCancelRequested = true;
        };

        document.querySelector(SELECTORS.elementInput.spectrum).addEventListener('change', (event) => {
            appState.isSpectrumEnabled = event.target.checked;
            requestRedraw();
        });

        document.querySelectorAll(SELECTORS.elementRadio.displayVersion).forEach((radioElement) => {
            radioElement.addEventListener('change', (event) => {
                if (!event.target.checked) return;
                appState.displayMode = event.target.value;
                writeStoredValue(STORAGE_KEYS.displayVersion, event.target.value);
                requestRedraw();
            });
        });

        audioElement.addEventListener('loadedmetadata', () => {
            document.querySelector(SELECTORS.elementContainer.control).classList.replace('hidden', 'grid');
            requestRedraw();
        });

        audioElement.addEventListener('play', async () => {
            await resumeAudioContext();
            startPlaybackLoop();
        });

        audioElement.addEventListener('pause', () => {
            if (appState.isExporting) return;
            stopPlaybackLoop();
            requestRedraw();
        });

        audioElement.addEventListener('seeked', () => {
            redrawImmediately();
            if (!audioElement.paused) startPlaybackLoop();
        });

        previewCanvas.addEventListener('mousemove', (event) => {
            const canvasRectangle = previewCanvas.getBoundingClientRect();
            STATE_PREVIEW.mouse.horizontalRatio = (event.clientX - canvasRectangle.left) / canvasRectangle.width;
            STATE_PREVIEW.mouse.isInside = true;
        });

        previewCanvas.addEventListener('mouseleave', () => {
            STATE_PREVIEW.mouse.isInside = false;
        });

        setupTemplateDialogs();
    }

    // Inisialisasi & pemulihan data tersimpan
    async function restoreSavedState() {
        const audioElement = document.querySelector(SELECTORS.elementAudio);
        const lyricsTextarea = document.querySelector(SELECTORS.elementTextarea.lyrics);

        lyricsTextarea.value = normalizeLyricsText(readStoredValue(STORAGE_KEYS.lyricsText, ''));
        document.querySelector(SELECTORS.elementTextarea.header).value = readStoredValue(STORAGE_KEYS.lyricsHeader, '');
        document.querySelector(SELECTORS.elementTextarea.footer).value = readStoredValue(STORAGE_KEYS.lyricsFooter, '');
        document.querySelector(SELECTORS.elementInput.offset).value = readStoredValue(STORAGE_KEYS.lyricsOffset, '0');
        document.querySelector(SELECTORS.elementInput.backgroundColor).value = appState.backgroundColor;
        document.querySelector(SELECTORS.elementInput.keyColor).value = appState.keyColor;
        document.querySelector(SELECTORS.elementInput.textColor).value = appState.textColor;
        document.querySelector(SELECTORS.elementInput.spectrum).checked = appState.isSpectrumEnabled;

        const storedBaseYRatio = readStoredValue(STORAGE_KEYS.lineBaseYRatio, '');
        if (storedBaseYRatio !== '' && !Number.isNaN(parseFloat(storedBaseYRatio))) {
            appState.lineBaseYRatio = parseFloat(storedBaseYRatio);
        }
        document.querySelectorAll(SELECTORS.elementRadio.displayVersion).forEach((radioElement) => {
            radioElement.checked = radioElement.value === appState.displayMode;
        });
        appState.parsedLyrics = parseLyricsText(lyricsTextarea.value);

        let restoredAudioFile = null;
        const savedAudioFile = await loadFromDatabase(PERSISTENCE_KEYS.audio);
        if (savedAudioFile) {
            audioElement.src = URL.createObjectURL(savedAudioFile);
            audioElement.load();
            setupLiveAnalyser(audioElement);
            restoredAudioFile = savedAudioFile;
            lyricsSettings.export.fileName = readStoredValue(PERSISTENCE_KEYS.audioFileName, '') || savedAudioFile.name?.replace(/\.[^/.]+$/, '') || lyricsSettings.export.fileName;
        }

        const savedBackgroundFile = await loadFromDatabase(PERSISTENCE_KEYS.background);
        const savedBackgroundType = readStoredValue(PERSISTENCE_KEYS.backgroundType, '');
        if (savedBackgroundFile && savedBackgroundType) {
            loadBackgroundResource(URL.createObjectURL(savedBackgroundFile), savedBackgroundType, () => redrawImmediately());
        }

        const savedIntroFile = await loadFromDatabase(PERSISTENCE_KEYS.intro);
        if (savedIntroFile && savedIntroFile instanceof Blob && savedIntroFile.type) {
            try {
                const restoredFile = new File([savedIntroFile], savedIntroFile.name || 'intro', { type: savedIntroFile.type });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(restoredFile);
                document.querySelector(SELECTORS.elementInput.intro).files = dataTransfer.files;
            } catch (error) {
                console.warn(MEDIA_MESSAGES.restoreIntroFailed, error);
            }
        }

        setExportButtonState(document.querySelector(SELECTORS.elementButton.export), false);
        updateRemoveButtonsVisibility();
        requestAnimationFrame(() => redrawImmediately());
        if (restoredAudioFile) analyzeAudioBlob(restoredAudioFile);
        document.fonts?.ready.then(() => redrawImmediately());
    }

    const init = () => {
        STATE_PREVIEW.previewContext = document.querySelector(SELECTORS.elementCanvas.preview).getContext('2d', {
            alpha: true
        });

        setPreviewLevel(PREVIEW_DEFAULT_LEVEL_INDEX);
        setupEventListeners();
        restoreSavedState();
    }

    init();
})();