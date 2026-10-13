import { lyricsSettings } from './lyricsSettings';
import { lyricsGetAdjustedRenderTime } from './lyricsRenderTime';
import { lyricsGetRenderLineState } from './lyricsRenderLineState';
import { lyricsEnsureBackgroundVideoPlaying } from './lyricsRenderBackgroundVideo';
import { lyricsUpdateBackgroundOpacity } from './lyricsRenderBackgroundOpacity';
import { lyricsRenderBackground } from './lyricsRenderBackground';
import { lyricsRenderOverlayText } from './lyricsRenderOverlayText';
import { lyricsRenderLyricsLines } from './lyricsRenderLyricsLines';
import { lyricsRenderSpectrumLayer } from './lyricsRenderSpectrumLayer';

export const lyricsRender = (currentTimeMs, drawContext) => {
    const domAudioPlayer = document.querySelector(lyricsSettings.elementSelectorAudio);
    const adjustedRenderTime = lyricsGetAdjustedRenderTime(currentTimeMs);
    const lineState = lyricsGetRenderLineState(adjustedRenderTime, domAudioPlayer);

    lyricsEnsureBackgroundVideoPlaying();
    lyricsUpdateBackgroundOpacity(lineState);

    drawContext.clearRect(0, 0, lyricsSettings.lyricsPreviewWidth, lyricsSettings.lyricsPreviewHeight);
    lyricsRenderBackground(drawContext);
    lyricsRenderOverlayText(drawContext, adjustedRenderTime);
    lyricsRenderLyricsLines(drawContext, lineState, adjustedRenderTime);
    lyricsRenderSpectrumLayer(drawContext);
};
