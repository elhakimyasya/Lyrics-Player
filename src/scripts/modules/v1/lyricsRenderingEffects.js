import { lyricsSettings } from './lyricsSettings';

let mouseX = 0;
let mouseY = 0;
let isMouseOver = false;
let spectrumPeakStates = [];
let spectrumPeakConfiguration = '';
let spectrumPeakLastRenderTimeMilliseconds = null;
const spectrumPeakGravityRampSeconds = 1;
const spectrumPeakSpringStiffness = 180;
const spectrumPeakSpringDamping = 18;
const spectrumPeakRiseImpulse = 4;

const renderingEffectsConvertHexColorToRgb = (hex) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
});

const renderingEffectsDrawResourceCover = (drawContext, resource, canvasWidth, canvasHeight) => {
    const element = resource.element;
    const resourceWidth = resource.type === lyricsSettings.media.types.video ? element.videoWidth : element.width;
    const resourceHeight = resource.type === lyricsSettings.media.types.video ? element.videoHeight : element.height;
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
        return lyricsSettings.rendering.fade.backgroundMaximumOpacity;
    }

    if (!lineState.isNextInstrumental && lineState.textNextRaw.trim() !== '' && lineState.timeUntilNextLine < lyricsSettings.rendering.fade.backgroundPreloadMilliseconds) {
        return lyricsSettings.rendering.fade.backgroundMaximumOpacity;
    }

    return 0;
};

const renderingEffectsConvertHexColorToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const renderingEffectsInitializeMouseTracking = (element) => {
    if (!element || element._mouseTrackingSetup) {
        return;
    }

    element.addEventListener('mousemove', (event) => {
        const canvasBounds = element.getBoundingClientRect();
        mouseX = (event.clientX - canvasBounds.left) / canvasBounds.width;
        mouseY = (event.clientY - canvasBounds.top) / canvasBounds.height;

        isMouseOver = true;
    });

    element.addEventListener('mouseleave', () => {
        isMouseOver = false;
    });

    element._mouseTrackingSetup = true;
};

export const lyricsRenderingEffectsRenderBackground = (drawContext) => {
    const canvasWidth = lyricsSettings.canvas.width;
    const canvasHeight = lyricsSettings.canvas.height;
    const backgroundColor = lyricsSettings.colors.background;
    const { r, g, b } = renderingEffectsConvertHexColorToRgb(backgroundColor);

    drawContext.save();

    if (!lyricsSettings.state.backgroundResource) {
        drawContext.fillStyle = backgroundColor;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
        drawContext.restore();

        return;
    }

    renderingEffectsDrawResourceCover(drawContext, lyricsSettings.state.backgroundResource, canvasWidth, canvasHeight);
    drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, ${lyricsSettings.state.backgroundOpacity})`;
    drawContext.fillRect(0, 0, canvasWidth, canvasHeight);

    if (lyricsSettings.state.backgroundOpacity < lyricsSettings.rendering.fade.backgroundRevealThreshold) {
        drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, ${lyricsSettings.rendering.fade.backgroundRevealOverlayOpacity})`;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    drawContext.restore();
};

export const lyricsRenderingEffectsRenderBackgroundIntro = (drawContext) => {
    const canvasWidth = lyricsSettings.canvas.width;
    const canvasHeight = lyricsSettings.canvas.height;
    const backgroundColor = lyricsSettings.colors.background;
    const { r, g, b } = renderingEffectsConvertHexColorToRgb(backgroundColor);

    drawContext.save();
    if (!lyricsSettings.state.backgroundResource) {
        drawContext.fillStyle = backgroundColor;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
        renderingEffectsDrawResourceCover(drawContext, lyricsSettings.state.backgroundResource, canvasWidth, canvasHeight);
        drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, 0)`;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
    }
    drawContext.restore();
};

export const lyricsRenderingEffectsUpdateBackgroundOpacity = (lineState, snapToTarget = false) => {
    if (snapToTarget) {
        lyricsSettings.state.backgroundOpacity = renderingEffectsGetBackgroundTargetOpacity(lineState);
        return;
    }

    if (lyricsSettings.state.isRecording && lyricsSettings.state.recordingMainTransitionPending) {
        lyricsSettings.state.backgroundOpacity = lyricsSettings.rendering.fade.backgroundMaximumOpacity;
        return;
    }

    if (lyricsSettings.state.isRecordingIntro && lyricsSettings.state.recordingIntroType === 'audio') {
        lyricsSettings.state.backgroundOpacity = lyricsSettings.rendering.fade.backgroundMaximumOpacity;
        return;
    }

    const targetOpacity = renderingEffectsGetBackgroundTargetOpacity(lineState);

    if (lyricsSettings.state.backgroundOpacity > targetOpacity) {
        lyricsSettings.state.backgroundOpacity = Math.max(targetOpacity, lyricsSettings.state.backgroundOpacity - lyricsSettings.rendering.fade.speedPerFrame);

        return;
    }

    if (lyricsSettings.state.backgroundOpacity < targetOpacity) {
        lyricsSettings.state.backgroundOpacity = Math.min(targetOpacity, lyricsSettings.state.backgroundOpacity + lyricsSettings.rendering.fade.speedPerFrame);
    }
};

export const lyricsRenderingEffectsEnsureBackgroundVideoPlaying = () => {
    if (lyricsSettings.state.backgroundResource?.type !== lyricsSettings.media.types.video) {
        return;
    }

    const videoElement = lyricsSettings.state.backgroundResource.element;
    if (!videoElement.paused || videoElement.ended) {
        return;
    }

    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.play().catch(() => { });
};

export const lyricsRenderingEffectsRenderAnalyzer = (audioElement) => {
    if (!lyricsSettings.audio.context) {
        lyricsSettings.audio.context = new (window.AudioContext || window.webkitAudioContext)();
        lyricsSettings.audio.analyser = lyricsSettings.audio.context.createAnalyser();
        lyricsSettings.audio.analyser.fftSize = lyricsSettings.audio.analyserOptions.fftSize;
        lyricsSettings.audio.analyser.smoothingTimeConstant = lyricsSettings.audio.analyserOptions.smoothingFactor;
        lyricsSettings.audio.source = lyricsSettings.audio.context.createMediaElementSource(audioElement);

        const audioBassFilterNode = lyricsSettings.audio.context.createBiquadFilter();
        audioBassFilterNode.type = lyricsSettings.audio.bassFilter.type;
        audioBassFilterNode.frequency.value = lyricsSettings.audio.bassFilter.frequency;
        audioBassFilterNode.gain.value = lyricsSettings.audio.bassFilter.gainDecibels;

        const audioGainNode = lyricsSettings.audio.context.createGain();
        audioGainNode.gain.value = 1;
        lyricsSettings.audio.source.connect(audioBassFilterNode);
        audioBassFilterNode.connect(lyricsSettings.audio.analyser);
        lyricsSettings.audio.analyser.connect(audioGainNode);
        audioGainNode.connect(lyricsSettings.audio.context.destination);

        lyricsSettings.audio.frequencyData = new Uint8Array(lyricsSettings.audio.analyser.frequencyBinCount);
    }
};

export const lyricsRenderingEffectsRenderSpectrum = (drawContext, frameFrequencyData = null, isOfflineExport = false, renderTimeMilliseconds = 0) => {
    const frequencyData = frameFrequencyData || lyricsSettings.audio.frequencyData;
    if (!frequencyData) {
        return;
    }

    // Setup mouse tracking on canvas
    const elementCanvas = document.querySelector(lyricsSettings.selectors.elementCanvas.preview);
    if (elementCanvas) {
        renderingEffectsInitializeMouseTracking(elementCanvas);
    }

    if (!frameFrequencyData) {
        if (!lyricsSettings.audio.analyser) return;
        lyricsSettings.audio.analyser.getByteFrequencyData(frequencyData);
    }

    const spectrumBarsCount = lyricsSettings.spectrum.barCount;
    const spectrumBarGap = lyricsSettings.spectrum.barGap;
    const spectrumThreshold = lyricsSettings.spectrum.silenceThreshold || 10;
    const spectrumBinSize = Math.floor(frequencyData.length / spectrumBarsCount);
    const spectrumBarWidth = lyricsSettings.canvas.width / (spectrumBarsCount * 2);
    const spectrumMaxHeight = lyricsSettings.canvas.height * (lyricsSettings.spectrum.maximumHeightRatio || 0.12);
    const spectrumBaseY = lyricsSettings.canvas.height;
    const peakSettings = lyricsSettings.spectrum.peak;
    const spectrumTimeMilliseconds = Number.isFinite(renderTimeMilliseconds) ? renderTimeMilliseconds : 0;
    const timeWentBackwards = spectrumPeakLastRenderTimeMilliseconds !== null
        && spectrumTimeMilliseconds < spectrumPeakLastRenderTimeMilliseconds;
    const peakConfiguration = [
        spectrumBarsCount,
        peakSettings.enabled,
        peakSettings.holdTimeMilliseconds,
        peakSettings.fallingMode,
        peakSettings.fallSpeedDecibelsPerSecond,
    ].join(':');
    const elapsedSeconds = spectrumPeakLastRenderTimeMilliseconds === null || timeWentBackwards
        ? 1 / 60
        : Math.min(0.05, Math.max(0, (spectrumTimeMilliseconds - spectrumPeakLastRenderTimeMilliseconds) / 1000));

    if (
        peakConfiguration !== spectrumPeakConfiguration
        || spectrumPeakStates.length !== spectrumBarsCount
        || timeWentBackwards
    ) {
        spectrumPeakStates = Array.from({ length: spectrumBarsCount }, () => ({
            value: 0,
            previousBarValue: 0,
            holdUntilMilliseconds: 0,
            fallStartTimeMilliseconds: null,
            fallStartValue: 0,
            markerHeight: 0,
            markerVelocity: 0,
        }));
    }

    spectrumPeakConfiguration = peakConfiguration;
    spectrumPeakLastRenderTimeMilliseconds = spectrumTimeMilliseconds;

    const spectrumGradient = drawContext.createLinearGradient(0, spectrumBaseY, 0, spectrumBaseY - spectrumMaxHeight);
    const spectrumColorKey = lyricsSettings.colors.key || lyricsSettings.colors.default.key;
    spectrumGradient.addColorStop(0, renderingEffectsConvertHexColorToRgba(spectrumColorKey, lyricsSettings.spectrum.gradientStartAlpha));
    spectrumGradient.addColorStop(1, renderingEffectsConvertHexColorToRgba(spectrumColorKey, lyricsSettings.spectrum.gradientEndAlpha));
    const minimumDecibels = lyricsSettings.spectrum.minimumDecibels;
    const decibelRange = lyricsSettings.spectrum.maximumDecibels - minimumDecibels;
    const originalGlobalAlpha = drawContext.globalAlpha;

    for (let index = 0; index < spectrumBarsCount; index++) {
        let frequencyMaxValue = 0;
        for (let frequencyBinIndex = 0; frequencyBinIndex < spectrumBinSize; frequencyBinIndex++) {
            const frequencyValue = frequencyData[index * spectrumBinSize + frequencyBinIndex];
            if (frequencyValue > frequencyMaxValue) {
                frequencyMaxValue = frequencyValue;
            }
        }

        if (frequencyMaxValue < spectrumThreshold) {
            frequencyMaxValue = 0;
        }

        // Interactive mouse effect: boost bars near mouse X position
        let interactiveBoost = 1.0;
        if (isMouseOver && !isOfflineExport) {
            const barCenterX = index / spectrumBarsCount;
            const distance = Math.abs(barCenterX - mouseX);
            // Max 30% boost near mouse
            interactiveBoost = 1 + (1 - distance) * lyricsSettings.spectrum.mouseBoostStrength;
        }

        const spectrumScale = 1 - (index / Math.max(1, spectrumBarsCount - 1)) * lyricsSettings.spectrum.edgeScale;
        frequencyMaxValue = Math.min(255, frequencyMaxValue * interactiveBoost);
        const peakState = spectrumPeakStates[index];
        const previousBarValue = peakState.previousBarValue;

        const spectrumBarHeight = (frequencyMaxValue / 255) * spectrumMaxHeight * spectrumScale;
        const drawY = spectrumBaseY - spectrumBarHeight;
        const barDrawWidth = Math.max(0, spectrumBarWidth - spectrumBarGap);
        drawContext.fillStyle = spectrumGradient;

        // Draw Left Side
        const drawXLeft = index * spectrumBarWidth;
        drawContext.fillRect(drawXLeft, drawY, barDrawWidth, spectrumBarHeight);

        // Draw Right Side (Mirrored)
        const drawXRight = lyricsSettings.canvas.width / 2 + (spectrumBarsCount - index - 1) * spectrumBarWidth;
        drawContext.fillRect(drawXRight, drawY, barDrawWidth, spectrumBarHeight);

        if (!peakSettings.enabled) {
            peakState.previousBarValue = frequencyMaxValue;
            continue;
        }

        let peakFadeOpacity = 1;
        if (frequencyMaxValue >= peakState.value) {
            const isNewPeak = frequencyMaxValue > peakState.value;
            peakState.value = frequencyMaxValue;
            peakState.holdUntilMilliseconds = spectrumTimeMilliseconds + peakSettings.holdTimeMilliseconds;
            peakState.fallStartTimeMilliseconds = null;
            peakState.fallStartValue = frequencyMaxValue;

            if (isNewPeak && frequencyMaxValue > previousBarValue) {
                const riseHeight = ((frequencyMaxValue - previousBarValue) / 255) * spectrumMaxHeight * spectrumScale;
                peakState.markerVelocity += riseHeight * spectrumPeakRiseImpulse;
            }
        } else if (peakState.value > 0 && spectrumTimeMilliseconds > peakState.holdUntilMilliseconds) {
            if (peakState.fallStartTimeMilliseconds === null) {
                peakState.fallStartTimeMilliseconds = peakState.holdUntilMilliseconds;
                peakState.fallStartValue = peakState.value;
            }

            const fallElapsedSeconds = (spectrumTimeMilliseconds - peakState.fallStartTimeMilliseconds) / 1000;
            if (peakSettings.fallingMode === 'fade-out') {
                const fadeDurationSeconds = decibelRange / peakSettings.fallSpeedDecibelsPerSecond;
                peakFadeOpacity = Math.max(0, 1 - fallElapsedSeconds / fadeDurationSeconds);
            } else {
                const fallDistanceDecibels = peakSettings.fallingMode === 'gravity'
                    ? peakSettings.fallSpeedDecibelsPerSecond * (
                        fallElapsedSeconds < spectrumPeakGravityRampSeconds
                            ? 0.5 * fallElapsedSeconds ** 2
                            : fallElapsedSeconds - (spectrumPeakGravityRampSeconds / 2)
                    )
                    : peakSettings.fallSpeedDecibelsPerSecond * fallElapsedSeconds;
                const peakDecibels = minimumDecibels + (peakState.fallStartValue / 255) * decibelRange;
                peakState.value = Math.max(0, ((peakDecibels - fallDistanceDecibels - minimumDecibels) / decibelRange) * 255);
            }
        }
        peakState.previousBarValue = frequencyMaxValue;

        const targetPeakHeight = (peakState.value / 255) * spectrumMaxHeight * spectrumScale;
        peakState.markerVelocity += (targetPeakHeight - peakState.markerHeight) * spectrumPeakSpringStiffness * elapsedSeconds;
        peakState.markerVelocity *= Math.exp(-spectrumPeakSpringDamping * elapsedSeconds);
        peakState.markerHeight += peakState.markerVelocity * elapsedSeconds;
        if (peakState.markerHeight < 0) {
            peakState.markerHeight = 0;
            peakState.markerVelocity = Math.max(0, peakState.markerVelocity);
        }

        if (peakState.markerHeight <= 0 || peakFadeOpacity <= 0 || peakSettings.opacityPercent <= 0) continue;

        const peakDrawY = Math.max(0, spectrumBaseY - peakState.markerHeight - peakSettings.thickness / 2);
        drawContext.fillStyle = spectrumColorKey;
        drawContext.globalAlpha = originalGlobalAlpha * (peakSettings.opacityPercent / 100) * peakFadeOpacity;
        drawContext.fillRect(drawXLeft, peakDrawY, barDrawWidth, peakSettings.thickness);
        drawContext.fillRect(drawXRight, peakDrawY, barDrawWidth, peakSettings.thickness);
        drawContext.globalAlpha = originalGlobalAlpha;
    }
};

export const lyricsRenderingEffectsRenderSpectrumLayer = (drawContext, frameFrequencyData = null, isOfflineExport = false, renderTimeMilliseconds = 0) => {
    if (!lyricsSettings.state.renderSpectrum) {
        return;
    }

    drawContext.save();

    lyricsRenderingEffectsRenderSpectrum(drawContext, frameFrequencyData, isOfflineExport, renderTimeMilliseconds);

    drawContext.restore();
};
