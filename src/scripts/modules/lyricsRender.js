import { lyricsSettings } from "./lyricsSettings";
import { lyricsRenderSpectrum } from "./lyricsRenderSpectrum";
import { lyricsRenderHeaderFooter } from "./lyricsRenderHeaderFooter";

const drawResourceCover = (ctx, resource, canvasWidth, canvasHeight) => {
    const element = resource.element;
    const rWidth = resource.type === 'video' ? element.videoWidth : element.width;
    const rHeight = resource.type === 'video' ? element.videoHeight : element.height;
    if (!rWidth || !rHeight) return;

    const rRatio = rWidth / rHeight;
    const cRatio = canvasWidth / canvasHeight;
    let drawW, drawH, offsetX, offsetY;

    if (rRatio > cRatio) {
        drawH = canvasHeight;
        drawW = canvasHeight * rRatio;
        offsetX = (canvasWidth - drawW) / 2;
        offsetY = 0;
    } else {
        drawW = canvasWidth;
        drawH = canvasWidth / rRatio;
        offsetX = 0;
        offsetY = (canvasHeight - drawH) / 2;
    }
    ctx.drawImage(element, offsetX, offsetY, drawW, drawH);
};

export const lyricsRender = (currentTimeMs, drawContext) => {
    const domInputOffset = document.querySelector(lyricsSettings.elementSelectorInputOffset);
    const domAudioPlayer = document.querySelector(lyricsSettings.elementSelectorAudio);
    const timeOffsetMs = (parseFloat(domInputOffset?.value) || 0) * 1000;
    const adjustedRenderTime = currentTimeMs + timeOffsetMs;

    // --- FIX VIDEO PLAYBACK ---
    if (lyricsSettings.lyricsResourceBackground?.type === 'video') {
        const vid = lyricsSettings.lyricsResourceBackground.element;
        if (vid.paused && !vid.ended) {
            vid.muted = true;
            vid.playsInline = true;
            vid.play().catch(() => {});
        }
    }

    const bgColor = lyricsSettings.lyricsBgColor;
    const keyColor = lyricsSettings.lyricsKeyColor;
    drawContext.clearRect(0, 0, lyricsSettings.lyricsPreviewWidth, lyricsSettings.lyricsPreviewHeight);

    // 1. Identifikasi Baris Aktif
    let activeLineIndex = -1;
    const totalLines = lyricsSettings.lyricsDataParsed.length;
    if (totalLines > 0) {
        for (let i = 0; i < totalLines; i++) {
            if (lyricsSettings.lyricsDataParsed[i].timeMs <= adjustedRenderTime) activeLineIndex = i;
            else break;
        }
    }
    if (activeLineIndex < 0 && totalLines > 0) activeLineIndex = 0;

    // 2. Setup Data
    const currentLineStart = totalLines > 0 ? lyricsSettings.lyricsDataParsed[activeLineIndex].timeMs : 0;
    const currentLineEnd = (activeLineIndex + 1 < totalLines)
        ? lyricsSettings.lyricsDataParsed[activeLineIndex + 1].timeMs
        : (domAudioPlayer.duration * 1000);

    const timeUntilNextLine = currentLineEnd - adjustedRenderTime;
    const textActiveRaw = activeLineIndex >= 0 ? (lyricsSettings.lyricsDataParsed[activeLineIndex]?.text || '') : '';
    const textNextRaw = (activeLineIndex + 1 < totalLines) ? (lyricsSettings.lyricsDataParsed[activeLineIndex + 1].text || '') : '';
    const textPreviousRaw = (activeLineIndex > 0) ? lyricsSettings.lyricsDataParsed[activeLineIndex - 1].text : '';

    // Logika Deteksi Simbol (Patokan)
    const isCurrentInstrumental = textActiveRaw.includes(lyricsSettings.lyricsInstrumentalSymbol);
    const isNextInstrumental = textNextRaw.includes(lyricsSettings.lyricsInstrumentalSymbol);
    const isPreviousInstrumental = textPreviousRaw.includes(lyricsSettings.lyricsInstrumentalSymbol);
    const isEnding = (activeLineIndex >= totalLines - 2 && textActiveRaw.trim() === '' && textNextRaw.trim() === '');

    // Bersihkan teks dari simbol agar tidak muncul di layar
    const textActive = isCurrentInstrumental ? "" : textActiveRaw;
    const textNext = isNextInstrumental ? "" : textNextRaw;
    const textPrevious = isPreviousInstrumental ? "" : textPreviousRaw;

    // 3. Logika Antisipasi Fade Background
    let targetOpacity = 0.9; // Default Gelap

    if (isEnding || isCurrentInstrumental) {
        targetOpacity = 0.0; // Terang
        // Mulai menggelap 1.5 detik SEBELUM lirik asli muncul
        if (!isNextInstrumental && textNextRaw.trim() !== '' && timeUntilNextLine < 1500) {
            targetOpacity = 0.9;
        }
    }

    const speed = 0.08; 
    if (lyricsSettings.lyricsBackgroundCurrentOpacity > targetOpacity) {
        lyricsSettings.lyricsBackgroundCurrentOpacity = Math.max(targetOpacity, lyricsSettings.lyricsBackgroundCurrentOpacity - speed);
    } else if (lyricsSettings.lyricsBackgroundCurrentOpacity < targetOpacity) {
        lyricsSettings.lyricsBackgroundCurrentOpacity = Math.min(targetOpacity, lyricsSettings.lyricsBackgroundCurrentOpacity + speed);
    }

    const r = parseInt(bgColor.slice(1, 3), 16);
    const g = parseInt(bgColor.slice(3, 5), 16);
    const b = parseInt(bgColor.slice(5, 7), 16);

    // 4. Render Background
    drawContext.save();
    if (lyricsSettings.lyricsResourceBackground) {
        drawResourceCover(drawContext, lyricsSettings.lyricsResourceBackground, lyricsSettings.lyricsPreviewWidth, lyricsSettings.lyricsPreviewHeight);
        drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, ${lyricsSettings.lyricsBackgroundCurrentOpacity})`;
        drawContext.fillRect(0, 0, lyricsSettings.lyricsPreviewWidth, lyricsSettings.lyricsPreviewHeight);
        
        if (lyricsSettings.lyricsBackgroundCurrentOpacity < 0.3) {
            drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
            drawContext.fillRect(0, 0, lyricsSettings.lyricsPreviewWidth, lyricsSettings.lyricsPreviewHeight);
        }
    } else {
        drawContext.fillStyle = bgColor;
        drawContext.fillRect(0, 0, lyricsSettings.lyricsPreviewWidth, lyricsSettings.lyricsPreviewHeight);
    }
    drawContext.restore();

    // 5. Header & Footer
    const hfAlpha = Math.max(0, (lyricsSettings.lyricsBackgroundCurrentOpacity / 0.9));
    const domHeader = document.querySelector(lyricsSettings.elementSelectorTextareaHeader);
    const domFooter = document.querySelector(lyricsSettings.elementSelectorTextareaFooter);

    if (domHeader?.value.trim() && hfAlpha > 0.01) {
        drawContext.save();
        drawContext.globalAlpha = hfAlpha;
        const lines = domHeader.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        lyricsRenderHeaderFooter(drawContext, lines, adjustedRenderTime, {
            font: `48px "${lyricsSettings.lyricsFontFace}", sans-serif`,
            x: lyricsSettings.lyricsPreviewWidth / 2, y: 120, baseline: 'top'
        });
        drawContext.restore();
    }

    if (domFooter?.value.trim() && hfAlpha > 0.01) {
        drawContext.save();
        drawContext.globalAlpha = hfAlpha;
        const lines = domFooter.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        lyricsRenderHeaderFooter(drawContext, lines, adjustedRenderTime, {
            font: `32px "${lyricsSettings.lyricsFontFace}", sans-serif`,
            x: lyricsSettings.lyricsPreviewWidth / 2, y: lyricsSettings.lyricsPreviewHeight - 120, baseline: 'bottom'
        });
        drawContext.restore();
    }

    if (totalLines === 0) return;

    // 6. Render Lirik
    const animProgress = Math.max(0, Math.min(1, (adjustedRenderTime - currentLineStart) / (currentLineEnd - currentLineStart)));
    const lineSpacing = 120;
    const yBase = lyricsSettings.lyricsPreviewHeight * 0.55;
    const scroll = animProgress * lineSpacing;

    drawContext.textAlign = 'center';
    drawContext.textBaseline = 'middle';

    // Previous Line (Hanya muncul jika bukan simbol)
    if (textPrevious) {
        drawContext.save();
        const pAlpha = (isCurrentInstrumental || isEnding) 
            ? Math.max(0, (1 - ((adjustedRenderTime - currentLineStart) / 200)) * 0.5)
            : (1 - animProgress) * 0.5;
        drawContext.font = `${/^\(.*\)$/.test(textPrevious) ? "italic " : ""}82px "${lyricsSettings.lyricsFontFace}", sans-serif`;
        drawContext.fillStyle = '#ffffff';
        drawContext.globalAlpha = pAlpha;
        drawContext.fillText(textPrevious, lyricsSettings.lyricsPreviewWidth / 2, (yBase - lineSpacing) - scroll);
        drawContext.restore();
    }

    // Active Line (Hanya muncul jika bukan simbol)
    if (textActive) {
        drawContext.save();
        drawContext.font = `${/^\(.*\)$/.test(textActive) ? "italic " : ""}82px "${lyricsSettings.lyricsFontFace}", sans-serif`;
        drawContext.fillStyle = keyColor;
        drawContext.fillText(textActive, lyricsSettings.lyricsPreviewWidth / 2, yBase - scroll);
        drawContext.restore();
    }

    // Next Line (Hanya muncul jika bukan simbol)
    if (textNext) {
        drawContext.save();
        const nAlpha = timeUntilNextLine <= 1000 ? (1 - (timeUntilNextLine / 1000)) * 0.5 : 0;
        drawContext.font = `${/^\(.*\)$/.test(textNext) ? "italic " : ""}82px "${lyricsSettings.lyricsFontFace}", sans-serif`;
        drawContext.fillStyle = '#ffffff';
        drawContext.globalAlpha = Math.max(0, nAlpha);
        drawContext.fillText(textNext, lyricsSettings.lyricsPreviewWidth / 2, (yBase + lineSpacing) - scroll);
        drawContext.restore();
    }

    // 7. Spectrum
    if (lyricsSettings.lyricsStateRenderSpectrum) {
        drawContext.save();
        lyricsRenderSpectrum(drawContext);
        drawContext.restore();
    }
};