import { lyricsSettings } from "./lyricsSettings";

/**
 * Merender teks header atau footer dengan efek fade in/out yang halus.
 * Opacity dikunci maksimal di 50% (0.5) tanpa ada lonjakan ke 100%.
 */
export const lyricsRenderHeaderFooter = (drawContext, textLines, currentTimeMs, options) => {
    if (!textLines || !textLines.length) return;

    // 1. Setup dasar font
    drawContext.font = options.font;
    drawContext.textAlign = 'center';
    drawContext.textBaseline = options.baseline;

    const maxOpacity = 0.5;

    // Jika hanya 1 baris, tampilkan statis permanen di 50%
    if (textLines.length === 1) {
        drawContext.save();
        drawContext.globalAlpha = maxOpacity;
        drawContext.fillStyle = '#ffffff';
        drawContext.fillText(textLines[0], options.x, options.y);
        drawContext.restore();
        return;
    }

    // 2. Kalkulasi waktu untuk rotasi teks
    const currentTimeSeconds = currentTimeMs / 1000;
    const lineDurationSeconds = options.lineDuration || 6;
    const fadeDurationSeconds = 1.0;

    const totalLines = textLines.length;
    const currentLineIndex = Math.floor(currentTimeSeconds / lineDurationSeconds) % totalLines;
    const timeWithinCycle = currentTimeSeconds % lineDurationSeconds;

    // 3. Logika Alpha yang aman (Linear Ramp)
    // Kita mulai dengan asumsi opacity penuh (dalam konteks 0.5)
    let calculatedAlpha = maxOpacity;

    if (timeWithinCycle < fadeDurationSeconds) {
        // Fade In: dari 0.0 ke 0.5
        calculatedAlpha = (timeWithinCycle / fadeDurationSeconds) * maxOpacity;
    }
    else if (timeWithinCycle > (lineDurationSeconds - fadeDurationSeconds)) {
        // Fade Out: dari 0.5 ke 0.0
        const timeInFadeOutZone = timeWithinCycle - (lineDurationSeconds - fadeDurationSeconds);
        calculatedAlpha = maxOpacity - ((timeInFadeOutZone / fadeDurationSeconds) * maxOpacity);
    }

    // 4. Eksekusi Rendering dengan Proteksi State
    const elementColor = (currentLineIndex % 2 === 0) ? lyricsSettings.lyricsKeyColor : '#ffffff';

    drawContext.save();

    // Gunakan clamp agar tidak pernah lebih dari 0.5 atau kurang dari 0
    const finalAlpha = Math.max(0, Math.min(maxOpacity, calculatedAlpha));

    drawContext.globalAlpha = finalAlpha;
    drawContext.fillStyle = elementColor;

    // Gambar teks
    drawContext.fillText(textLines[currentLineIndex], options.x, options.y);

    drawContext.restore();
};