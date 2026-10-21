import { lyricsSettings } from './lyricsCore';
import { lyricsStorageSave } from './lyricsStorage';
import { lyricsLoopsRenderPreviewFrameWhenIdle } from './lyricsLoops';
import { lyricsRecordingStart, lyricsRecordingStop } from './lyricsRecording';
import { lyricsMediaHandleAudioFileChange, lyricsMediaHandleBackgroundFileChange, lyricsMediaHandleIntroFileChange, lyricsMediaRemoveAudioAsset, lyricsMediaRemoveBackgroundAsset, lyricsMediaRemoveIntroAsset } from './lyricsMedia';
import { lyricsMediaEnsureAudioContextActive } from './lyricsMedia';
import { lyricsLoopsRenderPreviewFrame } from './lyricsLoops';
import { lyricsLoopsStartPreviewLoop, lyricsLoopsStopPreviewLoop } from './lyricsLoops';
import { lyricsParsingParse } from './lyricsParsing';
import { lyricsParsingNormalize } from './lyricsParsing';

const eventsBindColorInput = ({ elementInput, keyStorage, keySettings, elementAudio }) => {
    elementInput.addEventListener('input', (inputEvent) => {
        const color = inputEvent.target.value;
        lyricsSettings[keySettings] = color;

        lyricsStorageSave(keyStorage, color);
        lyricsLoopsRenderPreviewFrameWhenIdle(elementAudio);
    });
};

const eventsPersistOverlayText = (keyStorage, elementHTML, elementAudio) => {
    lyricsLoopsRenderPreviewFrameWhenIdle(elementAudio);
    lyricsStorageSave(keyStorage, elementHTML.value);
};

export const lyricsEventsBindColorInput = () => {
    eventsBindColorInput({
        elementInput: document.querySelector(lyricsSettings.elementSelectorColorBackground),
        keyStorage: lyricsSettings.lyricsStorageKeys.colorBackground,
        keySettings: lyricsSettings.lyricsColorSettingKeys.colorBackground,
        elementAudio: document.querySelector(lyricsSettings.elementSelectorAudio),
    });

    eventsBindColorInput({
        elementInput: document.querySelector(lyricsSettings.elementSelectorColorKey),
        keyStorage: lyricsSettings.lyricsStorageKeys.colorKey,
        keySettings: lyricsSettings.lyricsColorSettingKeys.colorKey,
        elementAudio: document.querySelector(lyricsSettings.elementSelectorAudio),
    });

    eventsBindColorInput({
        elementInput: document.querySelector(lyricsSettings.elementSelectorColorText),
        keyStorage: lyricsSettings.lyricsStorageKeys.colorText,
        keySettings: lyricsSettings.lyricsColorSettingKeys.colorText,
        elementAudio: document.querySelector(lyricsSettings.elementSelectorAudio),
    });
};

export const lyricsEventsBindTextInput = () => {
    document.querySelector(lyricsSettings.elementSelectorTextareaLyrics).addEventListener('input', () => {
        const content = lyricsParsingNormalize(document.querySelector(lyricsSettings.elementSelectorTextareaLyrics).value);
        document.querySelector(lyricsSettings.elementSelectorTextareaLyrics).value = content;
        lyricsSettings.lyricsDataParsed = lyricsParsingParse(content);

        lyricsLoopsRenderPreviewFrame(document.querySelector(lyricsSettings.elementSelectorAudio));
        lyricsStorageSave(lyricsSettings.lyricsStorageKeys.lyricsText, content);
    });

    document.querySelector(lyricsSettings.elementSelectorTextareaHeader).addEventListener('input', () => {
        eventsPersistOverlayText(lyricsSettings.lyricsStorageKeys.lyricsHeader, document.querySelector(lyricsSettings.elementSelectorTextareaHeader), document.querySelector(lyricsSettings.elementSelectorAudio));
    });

    document.querySelector(lyricsSettings.elementSelectorTextareaFooter).addEventListener('input', () => {
        eventsPersistOverlayText(lyricsSettings.lyricsStorageKeys.lyricsFooter, document.querySelector(lyricsSettings.elementSelectorTextareaFooter), document.querySelector(lyricsSettings.elementSelectorAudio));
    });

    document.querySelector(lyricsSettings.elementSelectorInputOffset).addEventListener('input', () => {
        lyricsStorageSave(lyricsSettings.lyricsStorageKeys.lyricsOffset, document.querySelector(lyricsSettings.elementSelectorInputOffset).value);
        lyricsLoopsRenderPreviewFrameWhenIdle(document.querySelector(lyricsSettings.elementSelectorAudio));
    });
};

export const lyricsEventsBindMediaInput = () => {
    document.querySelector(lyricsSettings.elementSelectorInputAudio).addEventListener('change', (inputEvent) => {
        lyricsMediaHandleAudioFileChange(inputEvent, document.querySelector(lyricsSettings.elementSelectorAudio));
    });

    document.querySelector(lyricsSettings.elementSelectorInputBackground).addEventListener('change', (inputEvent) => {
        lyricsMediaHandleBackgroundFileChange(inputEvent, document.querySelector(lyricsSettings.elementSelectorAudio));
    });

    document.querySelector(lyricsSettings.elementSelectorInputIntro).addEventListener('change', (inputEvent) => {
        lyricsMediaHandleIntroFileChange(inputEvent);
    });

    document.querySelector(lyricsSettings.elementSelectorButtonRemoveAudio).addEventListener('click', () => {
        lyricsMediaRemoveAudioAsset(document.querySelector(lyricsSettings.elementSelectorAudio));
    });

    document.querySelector(lyricsSettings.elementSelectorButtonRemoveBackground).addEventListener('click', () => {
        lyricsMediaRemoveBackgroundAsset(document.querySelector(lyricsSettings.elementSelectorAudio));
    });

    document.querySelector(lyricsSettings.elementSelectorButtonRemoveIntro).addEventListener('click', () => {
        lyricsMediaRemoveIntroAsset();
    });
};

export const lyricsEventsBindControl = () => {
    document.querySelector(lyricsSettings.elementSelectorButtonFullscreen).addEventListener('click', () => {
        const canvasElement = document.querySelector(lyricsSettings.elementSelectorCanvas)
        if (!document.fullscreenElement) {
            canvasElement.requestFullscreen().catch(console.error);

            return;
        }

        document.exitFullscreen();
    });

    document.querySelector(lyricsSettings.elementSelectorButtonExport).addEventListener('click', () => {
        const audioElement = document.querySelector(lyricsSettings.elementSelectorAudio);
        const buttonElement = document.querySelector(lyricsSettings.elementSelectorButtonExport);

        if (lyricsSettings.lyricsStateIsRecording) {
            lyricsRecordingStop();

            return;
        }

        lyricsRecordingStart({ audioElement, buttonElement });
    });

    document.querySelector(lyricsSettings.elementSelectorInputSpectrum).addEventListener('change', (inputEvent) => {
        lyricsSettings.lyricsStateRenderSpectrum = inputEvent.target.checked;

        lyricsLoopsRenderPreviewFrameWhenIdle(document.querySelector(lyricsSettings.elementSelectorAudio));
    });
};

export const lyricsEventsBindPlayer = () => {
    document.querySelector(lyricsSettings.elementSelectorAudio).addEventListener('loadedmetadata', () => {
        document.querySelector(lyricsSettings.elementSelectorContainerControl).classList.replace('hidden', 'grid');
    });

    document.querySelector(lyricsSettings.elementSelectorAudio).addEventListener('play', async () => {
        await lyricsMediaEnsureAudioContextActive();

        lyricsLoopsStartPreviewLoop();
    });

    document.querySelector(lyricsSettings.elementSelectorAudio).addEventListener('pause', () => {
        if (!lyricsSettings.lyricsStateIsRecording) {
            lyricsLoopsStopPreviewLoop();
        }
    });

    document.querySelector(lyricsSettings.elementSelectorAudio).addEventListener('seeked', () => {
        lyricsLoopsRenderPreviewFrame(document.querySelector(lyricsSettings.elementSelectorAudio));

        if (lyricsSettings.lyricsStateIsRecording && !document.querySelector(lyricsSettings.elementSelectorAudio).paused) {
            lyricsLoopsStartPreviewLoop();
        }
    });
};

export const lyricsEventsBind = () => {
    lyricsEventsBindColorInput();
    lyricsEventsBindTextInput();
    lyricsEventsBindMediaInput();
    lyricsEventsBindControl();
    lyricsEventsBindPlayer();
};