import { lyricsSettings } from './lyricsSettings';
import { lyricsStorageSave } from './lyricsStorageSave';
import { lyricsRenderPreviewFrameWhenIdle } from './lyricsCanvasRender';

const bindColorInput = ({ inputElement, storageKey, settingKey, audioElement }) => {
    inputElement.addEventListener('input', (event) => {
        const color = event.target.value;
        lyricsSettings[settingKey] = color;

        lyricsStorageSave(storageKey, color);
        lyricsRenderPreviewFrameWhenIdle(audioElement);
    });
};

export const lyricsBindColorInputEvents = (dom) => {
    bindColorInput({
        inputElement: dom.inputBgColor,
        storageKey: 'lyricsBgColor',
        settingKey: 'lyricsBgColor',
        audioElement: dom.audioPlayer,
    });

    bindColorInput({
        inputElement: dom.inputKeyColor,
        storageKey: 'lyricsKeyColor',
        settingKey: 'lyricsKeyColor',
        audioElement: dom.audioPlayer,
    });

    bindColorInput({
        inputElement: dom.inputNonActiveTextColor,
        storageKey: 'lyricsNonActiveTextColor',
        settingKey: 'lyricsNonActiveTextColor',
        audioElement: dom.audioPlayer,
    });
};
