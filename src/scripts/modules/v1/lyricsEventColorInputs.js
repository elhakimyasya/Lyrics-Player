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
        storageKey: lyricsSettings.lyricsStorageKeys.bgColor,
        settingKey: lyricsSettings.lyricsColorSettingKeys.bgColor,
        audioElement: dom.audioPlayer,
    });

    bindColorInput({
        inputElement: dom.inputKeyColor,
        storageKey: lyricsSettings.lyricsStorageKeys.keyColor,
        settingKey: lyricsSettings.lyricsColorSettingKeys.keyColor,
        audioElement: dom.audioPlayer,
    });

    bindColorInput({
        inputElement: dom.inputNonActiveTextColor,
        storageKey: lyricsSettings.lyricsStorageKeys.nonActiveTextColor,
        settingKey: lyricsSettings.lyricsColorSettingKeys.nonActiveTextColor,
        audioElement: dom.audioPlayer,
    });
};
