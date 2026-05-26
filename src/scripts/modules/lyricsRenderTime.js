import { lyricsSettings } from './lyricsSettings';

export const lyricsGetAdjustedRenderTime = (currentTimeMs) => {
    const domInputOffset = document.querySelector(lyricsSettings.elementSelectorInputOffset);
    const timeOffsetMs = (parseFloat(domInputOffset?.value) || 0) * 1000;
    
    return currentTimeMs + timeOffsetMs;
};
