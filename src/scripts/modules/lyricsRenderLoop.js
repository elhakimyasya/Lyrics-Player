import { lyricsSettings } from './lyricsSettings';
import { lyricsRender } from './lyricsRender';

let lastRenderTime = 0;

export const lyricsRenderLoop = () => {
    const audioPlayerElement = document.querySelector(lyricsSettings.elementSelectorAudio);
    const currentTime = performance.now();
    const renderThrottleMs = lyricsSettings.lyricsStateIsRecording ? 0 : 1000 / lyricsSettings.lyricsFramesPerSecond;

    if (!lyricsSettings.lyricsStateIsRecording && currentTime - lastRenderTime < renderThrottleMs) {
        lyricsSettings.lyricsAnimationRequestID = requestAnimationFrame(lyricsRenderLoop);

        return;
    }

    lastRenderTime = currentTime;
    
    lyricsRender(audioPlayerElement.currentTime * 1000, lyricsSettings.lyricsCanvasContext);

    lyricsSettings.lyricsAnimationRequestID = requestAnimationFrame(lyricsRenderLoop);
};
