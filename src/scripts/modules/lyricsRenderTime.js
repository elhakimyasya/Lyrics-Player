import { lyricsSettings } from './lyricsSettings';

export const lyricsGetAdjustedRenderTime = (currentTimeMs) => {
    const domInputOffset = document.querySelector(lyricsSettings.elementSelectorInputOffset);
    const timeOffsetMs = (parseFloat(domInputOffset?.value) || 0) * lyricsSettings.lyricsMillisecondsPerSecond;

    return currentTimeMs + timeOffsetMs;
};
