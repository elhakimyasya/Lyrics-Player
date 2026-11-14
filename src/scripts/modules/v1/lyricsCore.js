import { lyricsSettings } from './lyricsSettings';

export const lyricsCoreGetCanvasContext = () => {
    const elementCanvas = document.querySelector(lyricsSettings.elementSelectorCanvas);
    return elementCanvas.getContext(lyricsSettings.lyricsCanvasContextType, lyricsSettings.lyricsCanvasContextOptions);
};
