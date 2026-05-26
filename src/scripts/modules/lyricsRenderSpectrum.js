import { lyricsSettings } from './lyricsSettings';

/**
 * Mengonversi HEX ke RGBA string
 */
const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), lyricsSettings.lyricsHexColorRadix);
    const g = parseInt(hex.slice(3, 5), lyricsSettings.lyricsHexColorRadix);
    const b = parseInt(hex.slice(5, 7), lyricsSettings.lyricsHexColorRadix);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Track mouse position for interactive spectrum
let mouseX = 0;
let mouseY = 0;
let isMouseOver = false;

const setupMouseTracking = (canvasElement) => {
    if (!canvasElement || canvasElement._mouseTrackingSetup) return;

    canvasElement.addEventListener('mousemove', (e) => {
        const rect = canvasElement.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / rect.width;
        mouseY = (e.clientY - rect.top) / rect.height;
        isMouseOver = true;
    });

    canvasElement.addEventListener('mouseleave', () => {
        isMouseOver = false;
    });

    canvasElement._mouseTrackingSetup = true;
};

export const lyricsRenderSpectrum = (drawContext) => {
    if (!lyricsSettings.lyricsAudioAnalyser || !lyricsSettings.lyricsAudioFrequencyData) {
        return;
    }

    // Setup mouse tracking on canvas
    const canvasElement = document.querySelector(lyricsSettings.elementSelectorCanvas);
    if (canvasElement) {
        setupMouseTracking(canvasElement);
    }

    // Ambil Key Color terbaru dari settings
    const keyColor = lyricsSettings.lyricsKeyColor || lyricsSettings.lyricsDefaultKeyColor;

    lyricsSettings.lyricsAudioAnalyser.getByteFrequencyData(lyricsSettings.lyricsAudioFrequencyData);

    const spectrumBarsCount = lyricsSettings.lyricsSpectrumBarsCount;
    const spectrumBinSize = Math.floor(lyricsSettings.lyricsAudioFrequencyData.length / spectrumBarsCount);
    const spectrumBarGap = lyricsSettings.lyricsSpectrumBarGap;
    const spectrumBarWidth = lyricsSettings.lyricsPreviewWidth / (spectrumBarsCount * 2);
    const spectrumMaxHeight = lyricsSettings.lyricsPreviewHeight * lyricsSettings.lyricsSpectrumMaxHeightRatio;
    const spectrumBaseY = lyricsSettings.lyricsPreviewHeight;
    const spectrumThreshold = lyricsSettings.lyricsSpectrumThreshold;

    // Buat Gradien berdasarkan Key Color yang dipilih user
    const spectrumGradient = drawContext.createLinearGradient(0, spectrumBaseY, 0, spectrumBaseY - spectrumMaxHeight);
    spectrumGradient.addColorStop(0, hexToRgba(keyColor, lyricsSettings.lyricsSpectrumGradientStartAlpha));
    spectrumGradient.addColorStop(1, hexToRgba(keyColor, lyricsSettings.lyricsSpectrumGradientEndAlpha));

    drawContext.fillStyle = spectrumGradient;

    for (let index = 0; index < spectrumBarsCount; index++) {
        let frequencyMaxValue = 0;
        for (let binIndex = 0; binIndex < spectrumBinSize; binIndex++) {
            const frequencyValue = lyricsSettings.lyricsAudioFrequencyData[index * spectrumBinSize + binIndex];
            if (frequencyValue > frequencyMaxValue) {
                frequencyMaxValue = frequencyValue;
            }
        }

        if (frequencyMaxValue < spectrumThreshold) {
            frequencyMaxValue = 0;
        }

        // Interactive mouse effect: boost bars near mouse X position
        let interactiveBoost = 1.0;
        if (isMouseOver) {
            const barCenterX = index / spectrumBarsCount;
            const distance = Math.abs(barCenterX - mouseX);
            // Max 30% boost near mouse
            interactiveBoost = 1 + (1 - distance) * lyricsSettings.lyricsSpectrumInteractiveBoost;
        }

        frequencyMaxValue = Math.min(255, frequencyMaxValue * interactiveBoost);

        const spectrumScale = 1 - (index / (spectrumBarsCount - 1)) * lyricsSettings.lyricsSpectrumEdgeScale;
        const spectrumBarHeight = (frequencyMaxValue / 255) * spectrumMaxHeight * spectrumScale;
        const drawY = spectrumBaseY - spectrumBarHeight;

        // Draw Left Side
        const drawXLeft = index * spectrumBarWidth;
        drawContext.fillRect(drawXLeft, drawY, spectrumBarWidth - spectrumBarGap, spectrumBarHeight);

        // Draw Right Side (Mirrored)
        const drawXRight = lyricsSettings.lyricsPreviewWidth / 2 + (spectrumBarsCount - index - 1) * spectrumBarWidth;
        drawContext.fillRect(drawXRight, drawY, spectrumBarWidth - spectrumBarGap, spectrumBarHeight);
    }
};
