import { lyricsSettings } from './lyricsSettings';

export const lyricsDom = {
    inputOffset: document.querySelector(lyricsSettings.elementSelectorInputOffset),
    inputSpectrum: document.querySelector(lyricsSettings.elementSelectorInputSpectrum),
    inputBackground: document.querySelector(lyricsSettings.elementSelectorInputBackground),
    inputAudio: document.querySelector(lyricsSettings.elementSelectorInputAudio),
    textareaLyrics: document.querySelector(lyricsSettings.elementSelectorTextareaLyrics),
    textareaHeader: document.querySelector(lyricsSettings.elementSelectorTextareaHeader),
    textareaFooter: document.querySelector(lyricsSettings.elementSelectorTextareaFooter),
    buttonExport: document.querySelector(lyricsSettings.elementSelectorButtonExport),
    buttonFullscreen: document.querySelector(lyricsSettings.elementSelectorButtonFullscreen),
    audioPlayer: document.querySelector(lyricsSettings.elementSelectorAudio),
    containerControl: document.querySelector(lyricsSettings.elementSelectorContainerControl),
    canvasPreview: document.querySelector(lyricsSettings.elementSelectorCanvas),
    inputBgColor: document.querySelector(lyricsSettings.elementSelectorBgColor),
    inputKeyColor: document.querySelector(lyricsSettings.elementSelectorKeyColor),
    inputNonActiveTextColor: document.querySelector(lyricsSettings.elementSelectorNonActiveTextColor),
};

export const lyricsGetCanvasContext = (canvasElement) => {
    return canvasElement.getContext(lyricsSettings.lyricsCanvasContextType, lyricsSettings.lyricsCanvasContextOptions);
};
