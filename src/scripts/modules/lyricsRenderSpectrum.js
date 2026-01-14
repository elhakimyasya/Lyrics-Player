import { lyricsSettings } from "./lyricsSettings";

/**
 * Mengonversi HEX ke RGBA string
 */
const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const lyricsRenderSpectrum = (drawContext) => {
    if (!lyricsSettings.lyricsAudioAnalyser || !lyricsSettings.lyricsAudioFrequencyData) return;

    // Ambil Key Color terbaru dari settings
    const keyColor = lyricsSettings.lyricsKeyColor || '#3b82f6';

    lyricsSettings.lyricsAudioAnalyser.getByteFrequencyData(lyricsSettings.lyricsAudioFrequencyData);

    const spectrumBarsCount = 80;
    const spectrumBinSize = Math.floor(lyricsSettings.lyricsAudioFrequencyData.length / spectrumBarsCount);
    const spectrumBarGap = 3;
    const spectrumBarWidth = (lyricsSettings.lyricsPreviewWidth / 2) / spectrumBarsCount;
    const spectrumMaxHeight = lyricsSettings.lyricsPreviewHeight * 0.12;
    const spectrumBaseY = lyricsSettings.lyricsPreviewHeight;
    const spectrumThreshold = 5;

    // Buat Gradien berdasarkan Key Color yang dipilih user
    const spectrumGradient = drawContext.createLinearGradient(0, spectrumBaseY, 0, spectrumBaseY - spectrumMaxHeight);
    spectrumGradient.addColorStop(0, hexToRgba(keyColor, 0.1));
    spectrumGradient.addColorStop(1, hexToRgba(keyColor, 0.9));

    drawContext.fillStyle = spectrumGradient;

    for (let index = 0; index < spectrumBarsCount; index++) {
        let frequencyMaxValue = 0;
        for (let binIndex = 0; binIndex < spectrumBinSize; binIndex++) {
            const frequencyValue = lyricsSettings.lyricsAudioFrequencyData[index * spectrumBinSize + binIndex];
            if (frequencyValue > frequencyMaxValue) frequencyMaxValue = frequencyValue;
        }

        if (frequencyMaxValue < spectrumThreshold) frequencyMaxValue = 0;

        const spectrumScale = 1 - (index / (spectrumBarsCount - 1)) * 0.98;
        const spectrumBarHeight = (frequencyMaxValue / 255) * spectrumMaxHeight * spectrumScale;
        const drawY = spectrumBaseY - spectrumBarHeight;

        // Draw Left Side
        const drawXLeft = index * spectrumBarWidth;
        drawContext.fillRect(drawXLeft, drawY, spectrumBarWidth - spectrumBarGap, spectrumBarHeight);

        // Draw Right Side (Mirrored)
        const drawXRight = (lyricsSettings.lyricsPreviewWidth / 2) + (spectrumBarsCount - index - 1) * spectrumBarWidth;
        drawContext.fillRect(drawXRight, drawY, spectrumBarWidth - spectrumBarGap, spectrumBarHeight);
    }
};