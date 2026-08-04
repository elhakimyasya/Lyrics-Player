import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderTextLine } from './lyricsRenderTextLine';

const getAnimationProgress = (lineState, adjustedRenderTime) => {
    return Math.max(0, Math.min(1, (adjustedRenderTime - lineState.currentLineStart) / (lineState.currentLineEnd - lineState.currentLineStart)));
};

const getPreviousLineAlpha = (lineState, adjustedRenderTime, animationProgress) => {
    if (lineState.isCurrentInstrumental || lineState.isEnding) {
        return Math.max(0, (1 - (adjustedRenderTime - lineState.currentLineStart) / lyricsSettings.lyricsPreviousLineFadeOutMs) * lyricsSettings.lyricsInactiveLineOpacity);
    }

    return (1 - animationProgress) * lyricsSettings.lyricsInactiveLineOpacity;
};

const getNextLineAlpha = (lineState) => {
    if (lineState.timeUntilNextLine > lyricsSettings.lyricsNextLineFadeInMs) {
        return 0;
    }

    return Math.max(0, (1 - lineState.timeUntilNextLine / lyricsSettings.lyricsNextLineFadeInMs) * lyricsSettings.lyricsInactiveLineOpacity);
};

export const lyricsRenderLyricsLines = (drawContext, lineState, adjustedRenderTime) => {
    if (lineState.totalLines === 0) {
        return;
    }

    const animationProgress = getAnimationProgress(lineState, adjustedRenderTime);
    const lineSpacing = lyricsSettings.lyricsLineSpacing;
    const yBase = lyricsSettings.lyricsPreviewHeight * lyricsSettings.lyricsLineBaseYRatio;
    const scroll = animationProgress * lineSpacing;
    const centerX = lyricsSettings.lyricsPreviewWidth / 2;

    drawContext.textAlign = 'center';
    drawContext.textBaseline = 'middle';

    lyricsRenderTextLine(drawContext, {
        text: lineState.textPrevious,
        x: centerX,
        y: yBase - lineSpacing - scroll,
        color: lyricsSettings.lyricsNonActiveTextColor,
        alpha: getPreviousLineAlpha(lineState, adjustedRenderTime, animationProgress),
    });

    lyricsRenderTextLine(drawContext, {
        text: lineState.textActive,
        x: centerX,
        y: yBase - scroll,
        color: lyricsSettings.lyricsKeyColor,
    });

    lyricsRenderTextLine(drawContext, {
        text: lineState.textNext,
        x: centerX,
        y: yBase + lineSpacing - scroll,
        color: lyricsSettings.lyricsNonActiveTextColor,
        alpha: getNextLineAlpha(lineState),
    });
};
