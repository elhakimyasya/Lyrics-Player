import { lyricsSettings } from './lyricsSettings';
import { lyricsParse } from './lyricsParse';
import { lyricsStorageSave } from './lyricsStorageSave';
import { lyricsNormalize } from './lyricsNormalize';
import { lyricsRenderPreviewFrame, lyricsRenderPreviewFrameWhenIdle } from './lyricsCanvasRender';

const persistOverlayText = (storageKey, htmlElement, audioElement) => {
    lyricsRenderPreviewFrameWhenIdle(audioElement);
    lyricsStorageSave(storageKey, htmlElement.value);
};

export const lyricsBindTextInputEvents = (dom) => {
    dom.textareaLyrics.addEventListener('input', () => {
        const content = lyricsNormalize(dom.textareaLyrics.value);
        dom.textareaLyrics.value = content;
        lyricsSettings.lyricsDataParsed = lyricsParse(content);

        lyricsRenderPreviewFrame(dom.audioPlayer);
        lyricsStorageSave(lyricsSettings.lyricsStorageKeys.lyricsText, content);
    });

    dom.textareaHeader.addEventListener('input', () => {
        persistOverlayText(lyricsSettings.lyricsStorageKeys.lyricsHeader, dom.textareaHeader, dom.audioPlayer);
    });

    dom.textareaFooter.addEventListener('input', () => {
        persistOverlayText(lyricsSettings.lyricsStorageKeys.lyricsFooter, dom.textareaFooter, dom.audioPlayer);
    });

    dom.inputOffset.addEventListener('input', () => {
        lyricsStorageSave(lyricsSettings.lyricsStorageKeys.lyricsOffset, dom.inputOffset.value);
        lyricsRenderPreviewFrameWhenIdle(dom.audioPlayer);
    });
};
