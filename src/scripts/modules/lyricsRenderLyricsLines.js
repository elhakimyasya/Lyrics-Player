import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderTextLine } from './lyricsRenderTextLine';

const getAnimationProgress = (lineState, adjustedRenderTime) => {
    return Math.max(0, Math.min(1, (adjustedRenderTime - lineState.currentLineStart) / (lineState.currentLineEnd - lineState.currentLineStart)));
};

const getPreviousLineAlpha = (lineState, adjustedRenderTime, animationProgress) => {
    if (lineState.isCurrentInstrumental || lineState.isEnding) {
        return Math.max(0, (1 - (adjustedRenderTime - lineState.currentLineStart) / 200) * 0.5);
    }

    return (1 - animationProgress) * 0.5;
};

const getNextLineAlpha = (lineState) => {
    if (lineState.timeUntilNextLine > 1000) {
        return 0;
    }

    return Math.max(0, (1 - lineState.timeUntilNextLine / 1000) * 0.5);
};

export const lyricsRenderLyricsLines = (drawContext, lineState, adjustedRenderTime) => {
    if (lineState.totalLines === 0) {
        return;
    }

    const animationProgress = getAnimationProgress(lineState, adjustedRenderTime);
    const lineSpacing = 120;
    const yBase = lyricsSettings.lyricsPreviewHeight * 0.55;
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
