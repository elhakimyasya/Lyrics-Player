import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderingCoreRender } from './lyricsRenderingCore';

let idlePreviewRequestID = null;
let lastRenderTime = 0;

export const lyricsLoopsRenderCurrentFrame = (audioElement, drawContext) => {
    lyricsRenderingCoreRender(audioElement.currentTime * 1000, drawContext);
};

export const lyricsLoopsRenderPreviewFrame = (audioElement) => {
    lyricsLoopsRenderCurrentFrame(audioElement, lyricsSettings.canvas.context);
};

export const lyricsLoopsRenderPreviewFrameWhenIdle = (audioElement) => {
    if (lyricsSettings.state.isPlaying || idlePreviewRequestID) {
        return;
    }

    // Coalesce bursts from text/color inputs into one paint.
    idlePreviewRequestID = requestAnimationFrame(() => {
        idlePreviewRequestID = null;
        if (!lyricsSettings.state.isPlaying) {
            lyricsLoopsRenderPreviewFrame(audioElement);
        }
    });
};

export const lyricsLoopsStartPreviewLoop = () => {
    if (lyricsSettings.state.animationRequestId) {
        return;
    }

    lyricsSettings.state.isPlaying = true;
    lyricsSettings.state.animationRequestId = requestAnimationFrame(lyricsLoopsRenderLoop);
};

export const lyricsLoopsStopPreviewLoop = () => {
    if (lyricsSettings.state.animationRequestId) {
        cancelAnimationFrame(lyricsSettings.state.animationRequestId);
        lyricsSettings.state.animationRequestId = null;
    }

    if (idlePreviewRequestID) {
        cancelAnimationFrame(idlePreviewRequestID);
        idlePreviewRequestID = null;
    }

    lyricsSettings.state.isPlaying = false;
};

export const lyricsLoopsRenderLoop = () => {
    const audioPlayerElement = document.querySelector(lyricsSettings.selectors.elementAudio);
    if (!audioPlayerElement || !lyricsSettings.state.isPlaying) {
        lyricsSettings.state.animationRequestId = null;
        return;
    }

    const currentTimeMilliseconds = performance.now();
    const renderThrottleMilliseconds = lyricsSettings.state.isRecording ? 0 : 1000 / lyricsSettings.canvas.framesPerSecond;

    if (!lyricsSettings.state.isRecording && currentTimeMilliseconds - lastRenderTime < renderThrottleMilliseconds) {
        lyricsSettings.state.animationRequestId = requestAnimationFrame(lyricsLoopsRenderLoop);

        return;
    }

    lastRenderTime = currentTimeMilliseconds;

    lyricsRenderingCoreRender(audioPlayerElement.currentTime * 1000, lyricsSettings.canvas.context);

    lyricsSettings.state.animationRequestId = requestAnimationFrame(lyricsLoopsRenderLoop);
};
