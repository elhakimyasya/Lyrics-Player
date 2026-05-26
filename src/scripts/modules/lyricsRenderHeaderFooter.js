import { lyricsSettings } from './lyricsSettings';

const getLoopingLineState = (textLines, currentTimeMs, options) => {
    const currentTimeSeconds = currentTimeMs / 1000;
    const lineDurationSeconds = options.lineDuration || 6;
    const fadeDurationSeconds = Math.min(options.fadeDuration || 1, lineDurationSeconds / 2);
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

const colorForLine = (lineIndex) => (lineIndex % 2 === 0 ? lyricsSettings.lyricsKeyColor : lyricsSettings.lyricsNonActiveTextColor);

export const lyricsRenderHeaderFooter = (drawContext, textLines, currentTimeMs, options) => {
    if (!textLines || !textLines.length) {
        return;
    }

    drawContext.font = options.font;
    drawContext.textAlign = 'center';
    drawContext.textBaseline = options.baseline;

    const baseAlpha = Math.max(0, Math.min(1, options.baseAlpha ?? 1));
    const maxOpacity = 0.5;

    if (textLines.length === 1) {
        drawContext.save();
        drawContext.globalAlpha = maxOpacity * baseAlpha;
        drawContext.fillStyle = lyricsSettings.lyricsNonActiveTextColor;
        drawContext.fillText(textLines[0], options.x, options.y);
        drawContext.restore();

        return;
    }

    const { lineIndex, alpha } = getLoopingLineState(textLines, currentTimeMs, options);

    drawContext.save();
    drawContext.globalAlpha = alpha * maxOpacity * baseAlpha;
    drawContext.fillStyle = colorForLine(lineIndex);
    drawContext.fillText(textLines[lineIndex], options.x, options.y);
    drawContext.restore();
};
