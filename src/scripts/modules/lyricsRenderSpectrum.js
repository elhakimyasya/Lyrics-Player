import { lyricsSettings } from "./lyricsSettings";

const hexToRGBA = (hex, alpha) => {
    const red = parseInt(hex.slice(1, 3), 16);
    const green = parseInt(hex.slice(3, 5), 16);
    const blue = parseInt(hex.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
};

let cachedGradient = null;
let lastKeyColor = '';

export const lyricsRenderSpectrum = (drawContext) => {
    const {
        lyricsAudioAnalyser,
        lyricsAudioFrequencyData,
        lyricsPreviewWidth,
        lyricsPreviewHeight,
        lyricsKeyColor
    } = lyricsSettings;

    if (!lyricsAudioAnalyser || !lyricsAudioFrequencyData) {
        return;
    }

    lyricsAudioAnalyser.getByteFrequencyData(lyricsAudioFrequencyData);

    const spectrumBarsCount = 100;
    const spectrumBarGap = 3;
    const halfWidth = lyricsPreviewWidth / 2;
    const spectrumBarWidth = halfWidth / spectrumBarsCount;
    const spectrumMaxHeight = lyricsPreviewHeight * 0.10;
    const spectrumBaseY = lyricsPreviewHeight;
    const keyColor = lyricsKeyColor || '#3b82f6';

    if (!cachedGradient || lastKeyColor !== keyColor) {
        cachedGradient = drawContext.createLinearGradient(0, spectrumBaseY, 0, spectrumBaseY - spectrumMaxHeight);
        cachedGradient.addColorStop(0, hexToRGBA(keyColor, 0.2));
        cachedGradient.addColorStop(1, hexToRGBA(keyColor, 0.9));
        lastKeyColor = keyColor;
    }

    drawContext.fillStyle = cachedGradient;

    const step = Math.floor(lyricsAudioFrequencyData.length / (spectrumBarsCount * 1.5));

    for (let index = 0; index < spectrumBarsCount; index++) {
        const dataIndex = index * step;
        let frequencyValue = lyricsAudioFrequencyData[dataIndex];

        const boost = index < 10 ? 1.2 : 1.0;
        const spectrumScale = 1 - (index / (spectrumBarsCount - 1)) * 0.99;
        const spectrumBarHeight = (frequencyValue / 255) * spectrumMaxHeight * spectrumScale * boost;
        const drawY = spectrumBaseY - spectrumBarHeight;
        const barWidthWithGap = spectrumBarWidth - spectrumBarGap;

        drawContext.fillRect(index * spectrumBarWidth, drawY, barWidthWithGap, spectrumBarHeight);

        const rightX = lyricsPreviewWidth - (index + 1) * spectrumBarWidth + spectrumBarGap / 2;
        drawContext.fillRect(rightX, drawY, barWidthWithGap, spectrumBarHeight);
    }
};