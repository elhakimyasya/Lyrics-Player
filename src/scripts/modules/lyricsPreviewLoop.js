import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderLoop } from './lyricsRenderLoop';

export const lyricsStartPreviewLoop = () => {
    if (lyricsSettings.lyricsAnimationRequestID) {
        cancelAnimationFrame(lyricsSettings.lyricsAnimationRequestID);
    }

    lyricsSettings.lyricsAnimationRequestID = requestAnimationFrame(lyricsRenderLoop);
    lyricsSettings.lyricsStateIsPlaying = true;
};

export const lyricsStopPreviewLoop = () => {
    if (lyricsSettings.lyricsAnimationRequestID) {
        cancelAnimationFrame(lyricsSettings.lyricsAnimationRequestID);
        lyricsSettings.lyricsAnimationRequestID = null;
    }

    lyricsSettings.lyricsStateIsPlaying = false;
};
