import { lyricsSettings } from './lyricsCore';
import { lyricsRenderingEffectsEnsureBackgroundVideoPlaying } from './lyricsRenderingEffects';
import { lyricsRenderingEffectsUpdateBackgroundOpacity } from './lyricsRenderingEffects';
import { lyricsRenderingEffectsRenderBackground } from './lyricsRenderingEffects';
import { lyricsRenderingEffectsRenderBackgroundIntro } from './lyricsRenderingEffects';
import { lyricsRenderingEffectsRenderSpectrumLayer } from './lyricsRenderingEffects';

const renderingCoreFindActiveLineIndex = (adjustedRenderTime) => {
    let activeLineIndex = -1;
    const totalLines = lyricsSettings.lyricsDataParsed.length;

    if (totalLines === 0) {
        return -1;
    }

    for (let index = 0; index < totalLines; index++) {
        if (lyricsSettings.lyricsDataParsed[index].timeMs <= adjustedRenderTime) {
            activeLineIndex = index;
        } else {
            break;
        }
    }

    // Removed fallback to line 0 to allow proper start timing based on first timestamp.
    return activeLineIndex;
};

const renderingCoreGetLineTexts = (activeLineIndex, totalLines) => {
    const textActiveRaw = activeLineIndex >= 0 ? lyricsSettings.lyricsDataParsed[activeLineIndex]?.text || '' : '';
    const textNextRaw = activeLineIndex + 1 < totalLines ? lyricsSettings.lyricsDataParsed[activeLineIndex + 1].text || '' : '';
    const textPreviousRaw = activeLineIndex > 0 ? lyricsSettings.lyricsDataParsed[activeLineIndex - 1].text : '';

    const isCurrentInstrumental = textActiveRaw.includes(lyricsSettings.lyricsInstrumentalSymbol);
    const isNextInstrumental = textNextRaw.includes(lyricsSettings.lyricsInstrumentalSymbol);
    const isPreviousInstrumental = textPreviousRaw.includes(lyricsSettings.lyricsInstrumentalSymbol);

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
        return Math.max(0, (1 - (adjustedRenderTime - lineState.currentLineStart) / lyricsSettings.lyricsPreviousLineFadeOutMs) * lyricsSettings.lyricsInactiveLineOpacity);
    }

    return (1 - animationProgress) * lyricsSettings.lyricsInactiveLineOpacity;
};

const renderingCoreGetNextLineAlpha = (lineState) => {
    if (lineState.timeUntilNextLine > lyricsSettings.lyricsNextLineFadeInMs) {
        return 0;
    }

    return Math.max(0, (1 - lineState.timeUntilNextLine / lyricsSettings.lyricsNextLineFadeInMs) * lyricsSettings.lyricsInactiveLineOpacity);
};

const renderingCoreGetLyricFont = (text) => {
    const fontStyle = /^\(.*\)$/.test(text) ? 'italic ' : '';

    return `${fontStyle}${lyricsSettings.lyricsLineFontSize}px "${lyricsSettings.lyricsFontFace}", sans-serif`;
};

const renderingCoreGetLoopingOverlayLineState = (textLines, currentTimeMilliseconds, renderOptions) => {
    const currentTimeSeconds = currentTimeMilliseconds / lyricsSettings.lyricsMillisecondsPerSecond;
    const lineDurationSeconds = renderOptions.lineDuration || lyricsSettings.lyricsOverlayLineDurationSeconds;
    const fadeDurationSeconds = Math.min(renderOptions.fadeDuration || lyricsSettings.lyricsOverlayFadeDurationSeconds, lineDurationSeconds / 2);
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

const renderingCoreColorForLine = (lineIndex) => (lineIndex % 2 === 0 ? lyricsSettings.lyricsKeyColor : lyricsSettings.lyricsNonActiveTextColor);

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

export const lyricsRenderingCoreRender = (currentTimeMilliseconds, drawContext) => {
    const audioPlayerElement = document.querySelector(lyricsSettings.elementSelectorAudio);
    const adjustedRenderTime = lyricsRenderingCoreGetAdjustedRenderTime(currentTimeMilliseconds);
    const lineState = lyricsRenderingCoreGetRenderLineState(adjustedRenderTime, audioPlayerElement);

    lyricsRenderingEffectsEnsureBackgroundVideoPlaying();
    lyricsRenderingEffectsUpdateBackgroundOpacity(lineState);

    drawContext.clearRect(0, 0, lyricsSettings.lyricsPreviewWidth, lyricsSettings.lyricsPreviewHeight);
    if (lyricsSettings.lyricsStateIsRecordingIntro && lyricsSettings.lyricsRecordingIntroType === 'video') {
        return;
    }

    if (lyricsSettings.lyricsStateIsRecordingIntro && lyricsSettings.lyricsRecordingIntroType === 'audio') {
        lyricsRenderingEffectsRenderBackgroundIntro(drawContext);
        return;
    }

    lyricsRenderingEffectsRenderBackground(drawContext);
    if (lyricsSettings.lyricsStateIsRecordingIntro) {
        return;
    }

    lyricsRenderingCoreRenderOverlayText(drawContext, adjustedRenderTime);
    lyricsRenderingCoreRenderLyricsLines(drawContext, lineState, adjustedRenderTime);
    lyricsRenderingEffectsRenderSpectrumLayer(drawContext);
};

export const lyricsRenderingCoreGetRenderLineState = (adjustedRenderTime, audioElement) => {
    const totalLines = lyricsSettings.lyricsDataParsed.length;
    const activeLineIndex = renderingCoreFindActiveLineIndex(adjustedRenderTime);
    const currentLineStart = (totalLines > 0 && activeLineIndex >= 0) ? lyricsSettings.lyricsDataParsed[activeLineIndex].timeMs : 0;
    const currentLineEnd = (activeLineIndex + 1 < totalLines && activeLineIndex >= 0) ? lyricsSettings.lyricsDataParsed[activeLineIndex + 1].timeMs : audioElement.duration * lyricsSettings.lyricsMillisecondsPerSecond;
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

export const lyricsRenderingCoreRenderLyricsLines = (drawContext, lineState, adjustedRenderTime) => {
    if (lineState.totalLines === 0) {
        return;
    }

    const animationProgress = renderingCoreGetAnimationProgress(lineState, adjustedRenderTime);
    const lineSpacing = lyricsSettings.lyricsLineSpacing;
    const yBase = lyricsSettings.lyricsPreviewHeight * lyricsSettings.lyricsLineBaseYRatio;
    const scroll = animationProgress * lineSpacing;
    const centerX = lyricsSettings.lyricsPreviewWidth / 2;

    drawContext.textAlign = 'center';
    drawContext.textBaseline = 'middle';

    lyricsRenderingCoreRenderTextLine(drawContext, {
        text: lineState.textPrevious,
        x: centerX,
        y: yBase - lineSpacing - scroll,
        color: lyricsSettings.lyricsNonActiveTextColor,
        alpha: renderingCoreGetPreviousLineAlpha(lineState, adjustedRenderTime, animationProgress),
    });

    lyricsRenderingCoreRenderTextLine(drawContext, {
        text: lineState.textActive,
        x: centerX,
        y: yBase - scroll,
        color: lyricsSettings.lyricsKeyColor,
    });

    lyricsRenderingCoreRenderTextLine(drawContext, {
        text: lineState.textNext,
        x: centerX,
        y: yBase + lineSpacing - scroll,
        color: lyricsSettings.lyricsNonActiveTextColor,
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
    const maxOpacity = lyricsSettings.lyricsOverlayMaxOpacity;

    if (textLines.length === 1) {
        drawContext.save();
        drawContext.globalAlpha = maxOpacity * baseAlpha;
        drawContext.fillStyle = lyricsSettings.lyricsNonActiveTextColor;
        drawContext.fillText(textLines[0], renderOptions.x, renderOptions.y);
        drawContext.restore();

        return;
    }

    const { lineIndex, alpha } = renderingCoreGetLoopingOverlayLineState(textLines, currentTimeMilliseconds, renderOptions);

    drawContext.save();
    drawContext.globalAlpha = alpha * maxOpacity * baseAlpha;
    drawContext.fillStyle = renderingCoreColorForLine(lineIndex);
    drawContext.fillText(textLines[lineIndex], renderOptions.x, renderOptions.y);
    drawContext.restore();
};

export const lyricsRenderingCoreRenderOverlayText = (drawContext, adjustedRenderTime) => {
    // Determine if the current line is instrumental (contains the instrumental symbol).
    const activeLineIdx = renderingCoreFindActiveLineIndex(adjustedRenderTime);
    const currentLine = activeLineIdx >= 0 ? lyricsSettings.lyricsDataParsed[activeLineIdx] : null;
    const isInstrumental = currentLine && currentLine.text && currentLine.text.includes(lyricsSettings.lyricsInstrumentalSymbol);

    // Desired target opacity: 0 for instrumental, otherwise based on background opacity ratio.
    const backgroundRatio = Math.max(0, Math.min(1, lyricsSettings.lyricsBackgroundCurrentOpacity / lyricsSettings.lyricsOverlayOpacityReference));
    const targetOpacity = isInstrumental ? 0 : backgroundRatio;

    // Apply fade logic (respect recording transition pending flag).
    if (lyricsSettings.lyricsStateIsRecording && lyricsSettings.lyricsRecordingMainTransitionPending) {
        lyricsSettings.lyricsOverlayCurrentOpacity = targetOpacity;
    } else if (lyricsSettings.lyricsOverlayCurrentOpacity < targetOpacity) {
        lyricsSettings.lyricsOverlayCurrentOpacity = Math.min(targetOpacity, lyricsSettings.lyricsOverlayCurrentOpacity + lyricsSettings.lyricsFadeSpeed);
    } else if (lyricsSettings.lyricsOverlayCurrentOpacity > targetOpacity) {
        lyricsSettings.lyricsOverlayCurrentOpacity = Math.max(targetOpacity, lyricsSettings.lyricsOverlayCurrentOpacity - lyricsSettings.lyricsFadeSpeed);
    }

    const overlayAlpha = lyricsSettings.lyricsOverlayCurrentOpacity;

    renderingCoreRenderOverlayTextLines(drawContext, renderingCoreGetOverlayTextareaLines(lyricsSettings.elementSelectorTextareaHeader), adjustedRenderTime, {
        font: `${lyricsSettings.lyricsOverlayHeaderFontSize}px "${lyricsSettings.lyricsFontFace}", sans-serif`,
        x: lyricsSettings.lyricsPreviewWidth / 2,
        y: lyricsSettings.lyricsOverlayHeaderY,
        baseline: 'top',
        baseAlpha: overlayAlpha,
    });

    renderingCoreRenderOverlayTextLines(drawContext, renderingCoreGetOverlayTextareaLines(lyricsSettings.elementSelectorTextareaFooter), adjustedRenderTime, {
        font: `${lyricsSettings.lyricsOverlayFooterFontSize}px "${lyricsSettings.lyricsFontFace}", sans-serif`,
        x: lyricsSettings.lyricsPreviewWidth / 2,
        y: lyricsSettings.lyricsPreviewHeight - lyricsSettings.lyricsOverlayFooterBottomOffset,
        baseline: 'bottom',
        baseAlpha: overlayAlpha,
    });
};

export const lyricsRenderingCoreGetAdjustedRenderTime = (currentTimeMilliseconds) => {
    const offsetInputElement = document.querySelector(lyricsSettings.elementSelectorInputOffset);
    const timeOffsetMilliseconds = (parseFloat(offsetInputElement?.value) || 0) * lyricsSettings.lyricsMillisecondsPerSecond;

    return currentTimeMilliseconds + timeOffsetMilliseconds;
};
