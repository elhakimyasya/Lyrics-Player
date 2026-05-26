import { lyricsSettings } from './lyricsSettings';
import { lyricsRender } from './lyricsRender';

export const lyricsRenderCurrentFrame = (audioElement, drawContext) => {
    lyricsRender(audioElement.currentTime * 1000, drawContext);
};

export const lyricsRenderPreviewFrame = (audioElement) => {
    lyricsRenderCurrentFrame(audioElement, lyricsSettings.lyricsCanvasContext);
};

export const lyricsRenderPreviewFrameWhenIdle = (audioElement) => {
    if (!lyricsSettings.lyricsStateIsPlaying) {
        lyricsRenderPreviewFrame(audioElement);
    }
};
