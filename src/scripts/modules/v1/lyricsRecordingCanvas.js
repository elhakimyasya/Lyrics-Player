import { lyricsSettings } from './lyricsSettings';

export const lyricsCreateRecordingCanvas = () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = lyricsSettings.lyricsPreviewWidth;
    exportCanvas.height = lyricsSettings.lyricsPreviewHeight;
    
    return exportCanvas;
};
