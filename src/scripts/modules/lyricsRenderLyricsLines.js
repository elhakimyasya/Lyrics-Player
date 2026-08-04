import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderTextLine } from './lyricsRenderTextLine';

const getAnimationProgress = (lineState, adjustedRenderTime) => {
    if (!lineState.currentLineStart || !lineState.currentLineEnd) {
        return 0;
    }

    const duration = lineState.currentLineEnd - lineState.currentLineStart;
    if (duration <= 0) {
        return 0;
    }

    return Math.max(0, Math.min(1, (adjustedRenderTime - lineState.currentLineStart) / duration));
};

const getPreviousLineAlpha = (lineState, adjustedRenderTime, animationProgress) => {
    if (lineState.isCurrentInstrumental || lineState.isEnding) {
        const timeSinceStart = adjustedRenderTime - lineState.currentLineStart;
        return Math.max(0, (1 - timeSinceStart / lyricsSettings.lyricsPreviousLineFadeOutMs) * lyricsSettings.lyricsInactiveLineOpacity);
    }

    return (1 - animationProgress) * lyricsSettings.lyricsInactiveLineOpacity;
};

const getNextLineAlpha = (lineState) => {
    if (lineState.timeUntilNextLine === undefined || lineState.timeUntilNextLine === null) {
        return lyricsSettings.lyricsInactiveLineOpacity;
    }

    if (lineState.timeUntilNextLine <= lyricsSettings.lyricsNextLineFadeInMs) {
        const fadeProgress = 1 - (lineState.timeUntilNextLine / lyricsSettings.lyricsNextLineFadeInMs);
        return Math.max(0, Math.min(1, fadeProgress)) * lyricsSettings.lyricsInactiveLineOpacity;
    }

    return 0;
};

const isValidLyricsText = (text) => {
    if (!text || typeof text !== 'string') {
        return false;
    }
    
    const trimmed = text.trim();
    if (trimmed === '' || trimmed === lyricsSettings.lyricsInstrumentalSymbol) {
        return false;
    }

    return true;
};

export const lyricsRenderLyricsLines = (drawContext, lineState, adjustedRenderTime) => {
    if (lineState.totalLines === 0) {
        return;
    }

    const animationProgress = getAnimationProgress(lineState, adjustedRenderTime);
    const lineSpacing = lyricsSettings.lyricsLineSpacing;
    const yBase = lyricsSettings.lyricsPreviewHeight * lyricsSettings.lyricsLineBaseYRatio;

    const scrollOffset = (animationProgress - 0.5) * lineSpacing;
    const centerX = lyricsSettings.lyricsPreviewWidth / 2;

    drawContext.textAlign = 'center';
    drawContext.textBaseline = 'middle';

    if (isValidLyricsText(lineState.textPrevious)) {
        lyricsRenderTextLine(drawContext, {
            text: lineState.textPrevious,
            x: centerX,
            y: yBase - lineSpacing - scrollOffset,
            color: lyricsSettings.lyricsNonActiveTextColor,
            alpha: getPreviousLineAlpha(lineState, adjustedRenderTime, animationProgress),
        });
    }

    if (isValidLyricsText(lineState.textActive)) {
        lyricsRenderTextLine(drawContext, {
            text: lineState.textActive,
            x: centerX,
            y: yBase - scrollOffset,
            color: lyricsSettings.lyricsKeyColor,
            alpha: 1,
        });
    }

    if (isValidLyricsText(lineState.textNext)) {
        const nextAlpha = getNextLineAlpha(lineState);

        if (nextAlpha > 0) {
            lyricsRenderTextLine(drawContext, {
                text: lineState.textNext,
                x: centerX,
                y: yBase + lineSpacing - scrollOffset,
                color: lyricsSettings.lyricsNonActiveTextColor,
                alpha: nextAlpha,
            });
        }
    }
};