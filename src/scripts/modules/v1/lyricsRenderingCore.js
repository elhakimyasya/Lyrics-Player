import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderingEffectsEnsureBackgroundVideoPlaying } from './lyricsRenderingEffects';
import { lyricsRenderingEffectsUpdateBackgroundOpacity } from './lyricsRenderingEffects';
import { lyricsRenderingEffectsRenderBackground } from './lyricsRenderingEffects';
import { lyricsRenderingEffectsRenderBackgroundIntro } from './lyricsRenderingEffects';
import { lyricsRenderingEffectsRenderSpectrumLayer } from './lyricsRenderingEffects';

const renderingCoreFindActiveLineIndex = (adjustedRenderTime) => {
    let activeLineIndex = -1;
    const totalLines = lyricsSettings.state.parsedLyrics.length;

    if (totalLines === 0) {
        return -1;
    }

    for (let index = 0; index < totalLines; index++) {
        if (lyricsSettings.state.parsedLyrics[index].timeMs <= adjustedRenderTime) {
            activeLineIndex = index;
        } else {
            break;
        }
    }

    // Removed fallback to line 0 to allow proper start timing based on first timestamp.
    return activeLineIndex;
};

const renderingCoreGetLineTexts = (activeLineIndex, totalLines) => {
    const textActiveRaw = activeLineIndex >= 0 ? lyricsSettings.state.parsedLyrics[activeLineIndex]?.text || '' : '';
    const textNextRaw = activeLineIndex + 1 < totalLines ? lyricsSettings.state.parsedLyrics[activeLineIndex + 1].text || '' : '';
    const textPreviousRaw = activeLineIndex > 0 ? lyricsSettings.state.parsedLyrics[activeLineIndex - 1].text : '';

    const isCurrentInstrumental = textActiveRaw.includes(lyricsSettings.rendering.lyrics.instrumentalSymbol);
    const isNextInstrumental = textNextRaw.includes(lyricsSettings.rendering.lyrics.instrumentalSymbol);
    const isPreviousInstrumental = textPreviousRaw.includes(lyricsSettings.rendering.lyrics.instrumentalSymbol);

    return {
        textActiveRaw,
        textNextRaw,
        textPreviousRaw,
        textActive: isCurrentInstrumental ? '' : textActiveRaw,
        textNext: isNextInstrumental ? '' : textNextRaw,
        textPrevious: isPreviousInstrumental ? '' : textPreviousRaw,
        isCurrentInstrumental,
        isNextInstrumental,
        isPreviousInstrumental,
    };
};

const renderingCoreGetAnimationProgress = (lineState, adjustedRenderTime) => {
    return Math.max(0, Math.min(1, (adjustedRenderTime - lineState.currentLineStart) / (lineState.currentLineEnd - lineState.currentLineStart)));
};

const renderingCoreGetPreviousLineAlpha = (lineState, adjustedRenderTime, animationProgress) => {
    if (lineState.isCurrentInstrumental || lineState.isEnding) {
        return Math.max(0, (1 - (adjustedRenderTime - lineState.currentLineStart) / lyricsSettings.rendering.lyrics.previousLineFadeOutMilliseconds) * lyricsSettings.rendering.lyrics.inactiveLineOpacity);
    }

    return (1 - animationProgress) * lyricsSettings.rendering.lyrics.inactiveLineOpacity;
};

const renderingCoreGetNextLineAlpha = (lineState) => {
    if (lineState.timeUntilNextLine > lyricsSettings.rendering.lyrics.nextLineFadeInMilliseconds) {
        return 0;
    }

    return Math.max(0, (1 - lineState.timeUntilNextLine / lyricsSettings.rendering.lyrics.nextLineFadeInMilliseconds) * lyricsSettings.rendering.lyrics.inactiveLineOpacity);
};

const renderingCoreGetLyricFont = (text) => {
    const fontStyle = /^\(.*\)$/.test(text) ? 'italic ' : '';

    return `${fontStyle}${lyricsSettings.rendering.lyrics.lyricFontSize}px ${lyricsSettings.rendering.lyrics.fontFamily}`;
};

const renderingCoreGetLoopingOverlayLineState = (textLines, currentTimeMilliseconds, renderOptions) => {
    const currentTimeSeconds = currentTimeMilliseconds / 1000;
    const lineDurationSeconds = renderOptions.lineDuration || lyricsSettings.rendering.fade.overlayLineDurationSeconds;
    const fadeDurationSeconds = Math.min(renderOptions.fadeDuration || lyricsSettings.rendering.fade.overlayFadeDurationSeconds, lineDurationSeconds / 2);
    const currentLineIndex = Math.floor(currentTimeSeconds / lineDurationSeconds) % textLines.length;
    const timeWithinCycle = currentTimeSeconds % lineDurationSeconds;

    let lineAlpha = 1;
    if (timeWithinCycle < fadeDurationSeconds) {
        lineAlpha = timeWithinCycle / fadeDurationSeconds;
    } else if (timeWithinCycle > lineDurationSeconds - fadeDurationSeconds) {
        lineAlpha = (lineDurationSeconds - timeWithinCycle) / fadeDurationSeconds;
    }

    return {
        lineIndex: currentLineIndex,
        alpha: Math.max(0, Math.min(1, lineAlpha)),
    };
};

const renderingCoreColorForLine = (lineIndex) => (lineIndex % 2 === 0 ? lyricsSettings.colors.key : lyricsSettings.colors.text);

const renderingCoreGetOverlayTextareaLines = (selector) => {
    const element = document.querySelector(selector);
    if (!element?.value.trim()) {
        return [];
    }

    return element.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
};

const renderingCoreRenderOverlayTextLines = (drawContext, lines, adjustedRenderTime, renderOptions) => {
    if (!lines.length) {
        return;
    }

    lyricsRenderingCoreRenderHeaderFooter(drawContext, lines, adjustedRenderTime, renderOptions);
};

export const lyricsRenderingCoreRender = (currentTimeMilliseconds, drawContext, renderOptions = {}) => {
    const audioPlayerElement = document.querySelector(lyricsSettings.selectors.elementAudio);
    const adjustedRenderTime = lyricsRenderingCoreGetAdjustedRenderTime(currentTimeMilliseconds);
    const lineState = lyricsRenderingCoreGetRenderLineState(adjustedRenderTime, audioPlayerElement);

    if (!renderOptions.isOfflineExport) {
        lyricsRenderingEffectsEnsureBackgroundVideoPlaying();
    }
    lyricsRenderingEffectsUpdateBackgroundOpacity(lineState, renderOptions.snapBackgroundFade);

    drawContext.clearRect(0, 0, lyricsSettings.canvas.width, lyricsSettings.canvas.height);
    if (lyricsSettings.state.isRecordingIntro && lyricsSettings.state.recordingIntroType === 'video') {
        return;
    }

    if (lyricsSettings.state.isRecordingIntro && lyricsSettings.state.recordingIntroType === 'audio') {
        lyricsRenderingEffectsRenderBackgroundIntro(drawContext);
        return;
    }

    lyricsRenderingEffectsRenderBackground(drawContext);
    if (lyricsSettings.state.isRecordingIntro) {
        return;
    }

    lyricsRenderingCoreRenderOverlayText(drawContext, adjustedRenderTime);
    lyricsRenderingCoreRenderLyricsLines(drawContext, lineState, adjustedRenderTime);
    lyricsRenderingEffectsRenderSpectrumLayer(drawContext, renderOptions.frequencyData, renderOptions.isOfflineExport, currentTimeMilliseconds);
};

export const lyricsRenderingCoreGetRenderLineState = (adjustedRenderTime, audioElement) => {
    const totalLines = lyricsSettings.state.parsedLyrics.length;
    const activeLineIndex = renderingCoreFindActiveLineIndex(adjustedRenderTime);
    const currentLineStart = (totalLines > 0 && activeLineIndex >= 0) ? lyricsSettings.state.parsedLyrics[activeLineIndex].timeMs : 0;
    const currentLineEnd = (activeLineIndex + 1 < totalLines && activeLineIndex >= 0) ? lyricsSettings.state.parsedLyrics[activeLineIndex + 1].timeMs : audioElement.duration * 1000;
    const timeUntilNextLine = currentLineEnd - adjustedRenderTime;
    const lineTexts = renderingCoreGetLineTexts(activeLineIndex, totalLines);
    const isEnding = activeLineIndex >= totalLines - 2 && lineTexts.textActiveRaw.trim() === '' && lineTexts.textNextRaw.trim() === '';

    return {
        ...lineTexts,
        activeLineIndex,
        totalLines,
        currentLineStart,
        currentLineEnd,
        timeUntilNextLine,
        isEnding,
    };
};

const renderingCoreGetTripleShiftDuration = (lineState) => {
    const lineDuration = Math.max(1, lineState.currentLineEnd - lineState.currentLineStart);
    return Math.min(
        lyricsSettings.rendering.lyrics.tripleShiftDurationMilliseconds,
        Math.max(200, Math.round(lineDuration * 0.55))
    );
};

const renderingCoreGetTripleShiftOffset = (lineState, adjustedRenderTime) => {
    const elapsed = adjustedRenderTime - lineState.currentLineStart;
    const shiftDuration = renderingCoreGetTripleShiftDuration(lineState);
    if (elapsed >= shiftDuration) return 1;
    const t = Math.max(0, elapsed / shiftDuration);
    return 0.5 - 0.5 * Math.cos(t * Math.PI);
};

// Prev (top) fades out and next (bottom) fades in together — one shared
// fade duration, symmetric, running concurrently.
const renderingCoreGetTriplePrevNextAlpha = (lineState, adjustedRenderTime) => {
    const elapsed = adjustedRenderTime - lineState.currentLineStart;
    const fadeDuration = Math.max(200, Math.round(renderingCoreGetTripleShiftDuration(lineState) * 0.8));
    const t = Math.min(1, Math.max(0, elapsed / fadeDuration));
    const eased = 0.5 - 0.5 * Math.cos(t * Math.PI);

    return {
        prevAlpha: (1 - eased) * lyricsSettings.rendering.lyrics.inactiveLineOpacity,
        nextAlpha: eased * lyricsSettings.rendering.lyrics.inactiveLineOpacity,
    };
};

// During an instrumental line the whole triple block fades out; when the next
// regular line starts it fades back in.
const renderingCoreGetTripleVisibility = (lineState, adjustedRenderTime) => {
    const fadeDuration = lyricsSettings.rendering.lyrics.tripleFadeDurationMilliseconds;
    const elapsed = adjustedRenderTime - lineState.currentLineStart;
    if (lineState.isCurrentInstrumental) {
        return Math.max(0, 1 - elapsed / fadeDuration);
    }
    if (lineState.isPreviousInstrumental) {
        return Math.min(1, elapsed / fadeDuration);
    }
    return 1;
};

export const lyricsRenderingCoreRenderLyricsLines = (drawContext, lineState, adjustedRenderTime) => {
    if (lineState.totalLines === 0) {
        return;
    }

    const animationProgress = renderingCoreGetAnimationProgress(lineState, adjustedRenderTime);
    const lineSpacing = lyricsSettings.rendering.lyrics.lineSpacing;
    const centerX = lyricsSettings.canvas.width / 2;

    drawContext.textAlign = 'center';
    drawContext.textBaseline = 'middle';

    if (lyricsSettings.display.version === 'triple') {
        // Active line is always at height/2 (truly centered), independent of baseYRatio.
        // At the start of a new line the block is offset by lineSpacing (lines are one
        // spacing lower) and eases up to zero over lyricsTripleShiftDurationMs.
        const centerY = lyricsSettings.canvas.height / 2;
        const shiftFactor = renderingCoreGetTripleShiftOffset(lineState, adjustedRenderTime);
        const shiftOffset = (1 - shiftFactor) * lineSpacing;
        const visibility = renderingCoreGetTripleVisibility(lineState, adjustedRenderTime);

        // Prev and next fade out/in together, symmetrically.
        const { prevAlpha, nextAlpha } = renderingCoreGetTriplePrevNextAlpha(lineState, adjustedRenderTime);

        // Top line: fades out while the block shifts up
        lyricsRenderingCoreRenderTextLine(drawContext, {
            text: lineState.textPrevious,
            x: centerX,
            y: centerY - lineSpacing + shiftOffset,
            color: lyricsSettings.colors.text,
            alpha: prevAlpha * visibility,
        });

        // Active line: immediately solid key color, no fade
        lyricsRenderingCoreRenderTextLine(drawContext, {
            text: lineState.textActive,
            x: centerX,
            y: centerY + shiftOffset,
            color: lyricsSettings.colors.key,
            alpha: visibility,
        });

        // Bottom line: fades in while the block shifts up
        lyricsRenderingCoreRenderTextLine(drawContext, {
            text: lineState.textNext,
            x: centerX,
            y: centerY + lineSpacing + shiftOffset,
            color: lyricsSettings.colors.text,
            alpha: nextAlpha * visibility,
        });

        return;
    }

    // Dual mode (default)
    const yBase = lyricsSettings.canvas.height * lyricsSettings.rendering.lyrics.defaultBaseYRatio;
    const scroll = animationProgress * lineSpacing;

    lyricsRenderingCoreRenderTextLine(drawContext, {
        text: lineState.textPrevious,
        x: centerX,
        y: yBase - lineSpacing - scroll,
        color: lyricsSettings.colors.text,
        alpha: renderingCoreGetPreviousLineAlpha(lineState, adjustedRenderTime, animationProgress),
    });

    lyricsRenderingCoreRenderTextLine(drawContext, {
        text: lineState.textActive,
        x: centerX,
        y: yBase - scroll,
        color: lyricsSettings.colors.key,
    });

    lyricsRenderingCoreRenderTextLine(drawContext, {
        text: lineState.textNext,
        x: centerX,
        y: yBase + lineSpacing - scroll,
        color: lyricsSettings.colors.text,
        alpha: renderingCoreGetNextLineAlpha(lineState),
    });
};

export const lyricsRenderingCoreRenderTextLine = (drawContext, { text, x, y, color, alpha = 1 }) => {
    if (!text) {
        return;
    }

    drawContext.save();
    drawContext.font = renderingCoreGetLyricFont(text);
    drawContext.fillStyle = color;
    drawContext.globalAlpha = alpha;
    drawContext.fillText(text, x, y);
    drawContext.restore();
};

export const lyricsRenderingCoreRenderHeaderFooter = (drawContext, textLines, currentTimeMilliseconds, renderOptions) => {
    if (!textLines || !textLines.length) {
        return;
    }

    drawContext.font = renderOptions.font;
    drawContext.textAlign = 'center';
    drawContext.textBaseline = renderOptions.baseline;

    const baseAlpha = Math.max(0, Math.min(1, renderOptions.baseAlpha ?? 1));
    const maxOpacity = lyricsSettings.rendering.fade.overlayMaximumOpacity;
    const lineState = textLines.length === 1
        ? { lineIndex: 0, alpha: 1, color: lyricsSettings.colors.text }
        : renderingCoreGetLoopingOverlayLineState(textLines, currentTimeMilliseconds, renderOptions);
    const lineText = textLines[lineState.lineIndex];

    drawContext.save();
    drawContext.globalAlpha = lineState.alpha * maxOpacity * baseAlpha;

    const textSegments = lineText.split(/(SyncMusics)/g);
    if (textSegments.length === 1) {
        drawContext.fillStyle = lineState.color || renderingCoreColorForLine(lineState.lineIndex);
        drawContext.fillText(lineText, renderOptions.x, renderOptions.y);
    } else {
        drawContext.textAlign = 'left';
        let segmentX = renderOptions.x - drawContext.measureText(lineText).width / 2;
        const textColor = lineState.color || renderingCoreColorForLine(lineState.lineIndex);

        for (const segment of textSegments) {
            if (segment === 'SyncMusics') {
                drawContext.fillStyle = lyricsSettings.colors.key;
                drawContext.fillText('Sync', segmentX, renderOptions.y);
                segmentX += drawContext.measureText('Sync').width;
                drawContext.fillStyle = textColor;
                drawContext.fillText('Musics', segmentX, renderOptions.y);
                segmentX += drawContext.measureText('Musics').width;
            } else if (segment) {
                drawContext.fillStyle = textColor;
                drawContext.fillText(segment, segmentX, renderOptions.y);
                segmentX += drawContext.measureText(segment).width;
            }
        }
    }

    drawContext.restore();
};

export const lyricsRenderingCoreRenderOverlayText = (drawContext, adjustedRenderTime) => {
    // Determine if the current line is instrumental (contains the instrumental symbol).
    const activeLineIdx = renderingCoreFindActiveLineIndex(adjustedRenderTime);
    const currentLine = activeLineIdx >= 0 ? lyricsSettings.state.parsedLyrics[activeLineIdx] : null;
    const isInstrumental = currentLine && currentLine.text && currentLine.text.includes(lyricsSettings.rendering.lyrics.instrumentalSymbol);

    // Desired target opacity: 0 for instrumental, otherwise based on background opacity ratio.
    const backgroundRatio = Math.max(0, Math.min(1, lyricsSettings.state.backgroundOpacity / lyricsSettings.rendering.fade.overlayOpacityReference));
    const targetOpacity = isInstrumental ? 0 : backgroundRatio;

    // Apply fade logic (respect recording transition pending flag).
    if (lyricsSettings.state.isRecording && lyricsSettings.state.recordingMainTransitionPending) {
        lyricsSettings.state.overlayOpacity = targetOpacity;
    } else if (lyricsSettings.state.overlayOpacity < targetOpacity) {
        lyricsSettings.state.overlayOpacity = Math.min(targetOpacity, lyricsSettings.state.overlayOpacity + lyricsSettings.rendering.fade.speedPerFrame);
    } else if (lyricsSettings.state.overlayOpacity > targetOpacity) {
        lyricsSettings.state.overlayOpacity = Math.max(targetOpacity, lyricsSettings.state.overlayOpacity - lyricsSettings.rendering.fade.speedPerFrame);
    }

    const overlayAlpha = lyricsSettings.state.overlayOpacity;

    renderingCoreRenderOverlayTextLines(drawContext, renderingCoreGetOverlayTextareaLines(lyricsSettings.selectors.elementTextarea.header), adjustedRenderTime, {
        font: `${lyricsSettings.rendering.overlay.header.fontSize}px ${lyricsSettings.rendering.lyrics.fontFamily}`,
        x: lyricsSettings.canvas.width / 2,
        y: lyricsSettings.rendering.overlay.header.topY,
        baseline: 'top',
        baseAlpha: overlayAlpha,
    });

    renderingCoreRenderOverlayTextLines(drawContext, renderingCoreGetOverlayTextareaLines(lyricsSettings.selectors.elementTextarea.footer), adjustedRenderTime, {
        font: `${lyricsSettings.rendering.overlay.footer.fontSize}px ${lyricsSettings.rendering.lyrics.fontFamily}`,
        x: lyricsSettings.canvas.width / 2,
        y: lyricsSettings.canvas.height - lyricsSettings.rendering.overlay.footer.bottomOffset,
        baseline: 'bottom',
        baseAlpha: overlayAlpha,
    });
};

export const lyricsRenderingCoreGetAdjustedRenderTime = (currentTimeMilliseconds) => {
    const offsetInputElement = document.querySelector(lyricsSettings.selectors.elementInput.offset);
    const timeOffsetMilliseconds = (parseFloat(offsetInputElement?.value) || 0) * 1000;

    return currentTimeMilliseconds + timeOffsetMilliseconds;
};
