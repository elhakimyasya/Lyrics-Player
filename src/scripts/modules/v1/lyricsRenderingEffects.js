import { lyricsSettings } from './lyricsCore';

let mouseX = 0;
let mouseY = 0;
let isMouseOver = false;

const renderingEffectsConvertHexColorToRgb = (hex) => ({
    r: parseInt(hex.slice(1, 3), lyricsSettings.lyricsHexColorRadix),
    g: parseInt(hex.slice(3, 5), lyricsSettings.lyricsHexColorRadix),
    b: parseInt(hex.slice(5, 7), lyricsSettings.lyricsHexColorRadix),
});

const renderingEffectsDrawResourceCover = (drawContext, resource, canvasWidth, canvasHeight) => {
    const element = resource.element;
    const resourceWidth = resource.type === lyricsSettings.lyricsMediaTypes.video ? element.videoWidth : element.width;
    const resourceHeight = resource.type === lyricsSettings.lyricsMediaTypes.video ? element.videoHeight : element.height;
    if (!resourceWidth || !resourceHeight) {
        return;
    }

    const resourceRatio = resourceWidth / resourceHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    let drawWidth;
    let drawHeight;
    let offsetX;
    let offsetY;

    if (resourceRatio > canvasRatio) {
        drawHeight = canvasHeight;
        drawWidth = canvasHeight * resourceRatio;
        offsetX = (canvasWidth - drawWidth) / 2;
        offsetY = 0;
    } else {
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / resourceRatio;
        offsetX = 0;
        offsetY = (canvasHeight - drawHeight) / 2;
    }

    drawContext.drawImage(element, offsetX, offsetY, drawWidth, drawHeight);
};

const renderingEffectsGetBackgroundTargetOpacity = (lineState) => {
    if (!lineState.isEnding && !lineState.isCurrentInstrumental) {
        return lyricsSettings.lyricsBackgroundMaxOpacity;
    }

    if (!lineState.isNextInstrumental && lineState.textNextRaw.trim() !== '' && lineState.timeUntilNextLine < lyricsSettings.lyricsBackgroundNextLinePreloadMs) {
        return lyricsSettings.lyricsBackgroundMaxOpacity;
    }

    return 0;
};

const renderingEffectsConvertHexColorToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), lyricsSettings.lyricsHexColorRadix);
    const g = parseInt(hex.slice(3, 5), lyricsSettings.lyricsHexColorRadix);
    const b = parseInt(hex.slice(5, 7), lyricsSettings.lyricsHexColorRadix);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const renderingEffectsInitializeMouseTracking = (canvasElement) => {
    if (!canvasElement || canvasElement._mouseTrackingSetup) return;

    canvasElement.addEventListener('mousemove', (mouseMoveEvent) => {
        const canvasBounds = canvasElement.getBoundingClientRect();
        mouseX = (mouseMoveEvent.clientX - canvasBounds.left) / canvasBounds.width;
        mouseY = (mouseMoveEvent.clientY - canvasBounds.top) / canvasBounds.height;
        isMouseOver = true;
    });

    canvasElement.addEventListener('mouseleave', () => {
        isMouseOver = false;
    });

    canvasElement._mouseTrackingSetup = true;
};

export const lyricsRenderingEffectsRenderBackground = (drawContext) => {
    const canvasWidth = lyricsSettings.lyricsPreviewWidth;
    const canvasHeight = lyricsSettings.lyricsPreviewHeight;
    const backgroundColor = lyricsSettings.lyricsBgColor;
    const { r, g, b } = renderingEffectsConvertHexColorToRgb(backgroundColor);

    drawContext.save();

    if (!lyricsSettings.lyricsResourceBackground) {
        drawContext.fillStyle = backgroundColor;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
        drawContext.restore();

        return;
    }

    renderingEffectsDrawResourceCover(drawContext, lyricsSettings.lyricsResourceBackground, canvasWidth, canvasHeight);
    drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, ${lyricsSettings.lyricsBackgroundCurrentOpacity})`;
    drawContext.fillRect(0, 0, canvasWidth, canvasHeight);

    if (lyricsSettings.lyricsBackgroundCurrentOpacity < lyricsSettings.lyricsBackgroundRevealThreshold) {
        drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, ${lyricsSettings.lyricsBackgroundRevealOverlayOpacity})`;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    drawContext.restore();
};

export const lyricsRenderingEffectsRenderBackgroundIntro = (drawContext) => {
    const canvasWidth = lyricsSettings.lyricsPreviewWidth;
    const canvasHeight = lyricsSettings.lyricsPreviewHeight;
    const backgroundColor = lyricsSettings.lyricsBgColor;
    const { r, g, b } = renderingEffectsConvertHexColorToRgb(backgroundColor);

    drawContext.save();
    if (!lyricsSettings.lyricsResourceBackground) {
        drawContext.fillStyle = backgroundColor;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
        renderingEffectsDrawResourceCover(drawContext, lyricsSettings.lyricsResourceBackground, canvasWidth, canvasHeight);
        drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, 0)`;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    drawContext.restore();
};

export const lyricsRenderingEffectsUpdateBackgroundOpacity = (lineState) => {
    if (lyricsSettings.lyricsStateIsRecording && lyricsSettings.lyricsRecordingMainTransitionPending) {
        lyricsSettings.lyricsBackgroundCurrentOpacity = lyricsSettings.lyricsBackgroundMaxOpacity;
        return;
    }

    if (lyricsSettings.lyricsStateIsRecordingIntro && lyricsSettings.lyricsRecordingIntroType === 'audio') {
        lyricsSettings.lyricsBackgroundCurrentOpacity = lyricsSettings.lyricsBackgroundMaxOpacity;
        return;
    }

    const targetOpacity = renderingEffectsGetBackgroundTargetOpacity(lineState);

    if (lyricsSettings.lyricsBackgroundCurrentOpacity > targetOpacity) {
        lyricsSettings.lyricsBackgroundCurrentOpacity = Math.max(targetOpacity, lyricsSettings.lyricsBackgroundCurrentOpacity - lyricsSettings.lyricsFadeSpeed);

        return;
    }

    if (lyricsSettings.lyricsBackgroundCurrentOpacity < targetOpacity) {
        lyricsSettings.lyricsBackgroundCurrentOpacity = Math.min(targetOpacity, lyricsSettings.lyricsBackgroundCurrentOpacity + lyricsSettings.lyricsFadeSpeed);
    }
};

export const lyricsRenderingEffectsEnsureBackgroundVideoPlaying = () => {
    if (lyricsSettings.lyricsResourceBackground?.type !== lyricsSettings.lyricsMediaTypes.video) {
        return;
    }

    const videoElement = lyricsSettings.lyricsResourceBackground.element;
    if (!videoElement.paused || videoElement.ended) {
        return;
    }

    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.play().catch(() => { });
};

export const lyricsRenderingEffectsRenderAnalyzer = (audioElement) => {
    if (!lyricsSettings.lyricsAudioContext) {
        lyricsSettings.lyricsAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        lyricsSettings.lyricsAudioAnalyser = lyricsSettings.lyricsAudioContext.createAnalyser();
        lyricsSettings.lyricsAudioAnalyser.fftSize = lyricsSettings.lyricsAudioAnalyserFftSize;
        lyricsSettings.lyricsAudioAnalyser.smoothingTimeConstant = lyricsSettings.lyricsAudioAnalyserSmoothing;
        lyricsSettings.lyricsAudioSource = lyricsSettings.lyricsAudioContext.createMediaElementSource(audioElement);

        const audioBassFilterNode = lyricsSettings.lyricsAudioContext.createBiquadFilter();
        audioBassFilterNode.type = lyricsSettings.lyricsAudioBassFilterType;
        audioBassFilterNode.frequency.value = lyricsSettings.lyricsAudioBassFilterFrequency;
        audioBassFilterNode.gain.value = lyricsSettings.lyricsAudioBassFilterGain;

        const audioGainNode = lyricsSettings.lyricsAudioContext.createGain();
        audioGainNode.gain.value = lyricsSettings.lyricsAudioOutputGain;
        lyricsSettings.lyricsAudioSource.connect(audioBassFilterNode);
        audioBassFilterNode.connect(lyricsSettings.lyricsAudioAnalyser);
        lyricsSettings.lyricsAudioAnalyser.connect(audioGainNode);
        audioGainNode.connect(lyricsSettings.lyricsAudioContext.destination);

        lyricsSettings.lyricsAudioFrequencyData = new Uint8Array(lyricsSettings.lyricsAudioAnalyser.frequencyBinCount);
    }
};

export const lyricsRenderingEffectsRenderSpectrum = (drawContext) => {
    if (!lyricsSettings.lyricsAudioAnalyser || !lyricsSettings.lyricsAudioFrequencyData) {
        return;
    }

    // Setup mouse tracking on canvas
    const canvasElement = document.querySelector(lyricsSettings.elementSelectorCanvas);
    if (canvasElement) {
        renderingEffectsInitializeMouseTracking(canvasElement);
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
    spectrumGradient.addColorStop(0, renderingEffectsConvertHexColorToRgba(keyColor, lyricsSettings.lyricsSpectrumGradientStartAlpha));
    spectrumGradient.addColorStop(1, renderingEffectsConvertHexColorToRgba(keyColor, lyricsSettings.lyricsSpectrumGradientEndAlpha));

    drawContext.fillStyle = spectrumGradient;

    for (let index = 0; index < spectrumBarsCount; index++) {
        let frequencyMaxValue = 0;
        for (let frequencyBinIndex = 0; frequencyBinIndex < spectrumBinSize; frequencyBinIndex++) {
            const frequencyValue = lyricsSettings.lyricsAudioFrequencyData[index * spectrumBinSize + frequencyBinIndex];
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

export const lyricsRenderingEffectsRenderSpectrumLayer = (drawContext) => {
    if (!lyricsSettings.lyricsStateRenderSpectrum) {
        return;
    }

    drawContext.save();

    lyricsRenderingEffectsRenderSpectrum(drawContext);

    drawContext.restore();
};
