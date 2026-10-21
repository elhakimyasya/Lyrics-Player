import { lyricsSettings } from './lyricsCore';
import { lyricsRenderingCoreRender } from './lyricsRenderingCore';

let idlePreviewRequestID = null;
let lastRenderTime = 0;

export const lyricsLoopsRenderCurrentFrame = (audioElement, drawContext) => {
    lyricsRenderingCoreRender(audioElement.currentTime * lyricsSettings.lyricsMillisecondsPerSecond, drawContext);
};

export const lyricsLoopsRenderPreviewFrame = (audioElement) => {
    lyricsLoopsRenderCurrentFrame(audioElement, lyricsSettings.lyricsCanvasContext);
};

export const lyricsLoopsRenderPreviewFrameWhenIdle = (audioElement) => {
    if (lyricsSettings.lyricsStateIsPlaying || idlePreviewRequestID) {
        return;
    }

    // Coalesce bursts from text/color inputs into one paint.
    idlePreviewRequestID = requestAnimationFrame(() => {
        idlePreviewRequestID = null;
        if (!lyricsSettings.lyricsStateIsPlaying) {
            lyricsLoopsRenderPreviewFrame(audioElement);
        }
    });
};

export const lyricsLoopsStartPreviewLoop = () => {
    if (lyricsSettings.lyricsAnimationRequestID) {
        return;
    }

    lyricsSettings.lyricsStateIsPlaying = true;
    lyricsSettings.lyricsAnimationRequestID = requestAnimationFrame(lyricsLoopsRenderLoop);
};

export const lyricsLoopsStopPreviewLoop = () => {
    if (lyricsSettings.lyricsAnimationRequestID) {
        cancelAnimationFrame(lyricsSettings.lyricsAnimationRequestID);
        lyricsSettings.lyricsAnimationRequestID = null;
    }

    if (idlePreviewRequestID) {
        cancelAnimationFrame(idlePreviewRequestID);
        idlePreviewRequestID = null;
    }

    lyricsSettings.lyricsStateIsPlaying = false;
};

export const lyricsLoopsRenderLoop = () => {
    const audioPlayerElement = document.querySelector(lyricsSettings.elementSelectorAudio);
    if (!audioPlayerElement || !lyricsSettings.lyricsStateIsPlaying) {
        lyricsSettings.lyricsAnimationRequestID = null;
        return;
    }

    const currentTimeMilliseconds = performance.now();
    const renderThrottleMilliseconds = lyricsSettings.lyricsStateIsRecording ? 0 : lyricsSettings.lyricsMillisecondsPerSecond / lyricsSettings.lyricsFramesPerSecond;

    if (!lyricsSettings.lyricsStateIsRecording && currentTimeMilliseconds - lastRenderTime < renderThrottleMilliseconds) {
        lyricsSettings.lyricsAnimationRequestID = requestAnimationFrame(lyricsLoopsRenderLoop);

        return;
    }

    lastRenderTime = currentTimeMilliseconds;

    lyricsRenderingCoreRender(audioPlayerElement.currentTime * lyricsSettings.lyricsMillisecondsPerSecond, lyricsSettings.lyricsCanvasContext);

    lyricsSettings.lyricsAnimationRequestID = requestAnimationFrame(lyricsLoopsRenderLoop);
};
