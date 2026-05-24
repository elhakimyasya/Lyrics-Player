import { lyricsSettings } from "./lyricsSettings";

/**
 * Merender teks header atau footer dengan fade yang halus.
 * Gerakan alpha mengikuti kondisi global dan crossfade antar baris.
 */
export const lyricsRenderHeaderFooter = (drawContext, textLines, currentTimeMs, options) => {
    if (!textLines || !textLines.length) return;

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

    const currentTimeSeconds = currentTimeMs / 1000;
    const lineDurationSeconds = options.lineDuration || 6;
    const fadeDurationSeconds = 1.0;
    const totalLines = textLines.length;
    const currentLineIndex = Math.floor(currentTimeSeconds / lineDurationSeconds) % totalLines;
    const nextLineIndex = (currentLineIndex + 1) % totalLines;
    const timeWithinCycle = currentTimeSeconds % lineDurationSeconds;
    const fadeStart = Math.max(0, lineDurationSeconds - fadeDurationSeconds);

    const transitionProgress = timeWithinCycle >= fadeStart
        ? Math.max(0, Math.min(1, (timeWithinCycle - fadeStart) / fadeDurationSeconds))
        : 0;

    const currentAlpha = 1 - transitionProgress;
    const nextAlpha = transitionProgress;

    const colorForLine = (lineIndex) => (lineIndex % 2 === 0)
        ? lyricsSettings.lyricsKeyColor
        : lyricsSettings.lyricsNonActiveTextColor;

    drawContext.save();

    drawContext.globalAlpha = currentAlpha * maxOpacity * baseAlpha;
    drawContext.fillStyle = colorForLine(currentLineIndex);
    drawContext.fillText(textLines[currentLineIndex], options.x, options.y);

    drawContext.globalAlpha = nextAlpha * maxOpacity * baseAlpha;
    drawContext.fillStyle = colorForLine(nextLineIndex);
    drawContext.fillText(textLines[nextLineIndex], options.x, options.y);

    drawContext.restore();
};