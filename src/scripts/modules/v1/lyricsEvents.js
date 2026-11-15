import { lyricsSettings } from './lyricsSettings';
import { lyricsStorageSave } from './lyricsStorage';
import { lyricsLoopsRenderPreviewFrameWhenIdle } from './lyricsLoops';
import { lyricsRecordingStart, lyricsRecordingStop } from './lyricsRecording';
import { lyricsMp4ExportStart } from './lyricsMp4Export';
import { lyricsMediaHandleAudioFileChange, lyricsMediaHandleBackgroundFileChange, lyricsMediaHandleIntroFileChange, lyricsMediaRemoveAudioAsset, lyricsMediaRemoveBackgroundAsset, lyricsMediaRemoveIntroAsset } from './lyricsMedia';
import { lyricsMediaEnsureAudioContextActive } from './lyricsMedia';
import { lyricsLoopsRenderPreviewFrame } from './lyricsLoops';
import { lyricsLoopsStartPreviewLoop, lyricsLoopsStopPreviewLoop } from './lyricsLoops';
import { lyricsParsingParse } from './lyricsParsing';
import { lyricsParsingNormalize } from './lyricsParsing';

const eventsBindColorInput = ({ elementInput, keyStorage, colorName, elementAudio }) => {
    elementInput.addEventListener('input', (inputEvent) => {
        const color = inputEvent.target.value;
        lyricsSettings.colors[colorName] = color;

        lyricsStorageSave(keyStorage, color);
        lyricsLoopsRenderPreviewFrameWhenIdle(elementAudio);
    });
};

const eventsPersistOverlayText = (keyStorage, elementHTML, elementAudio) => {
    lyricsLoopsRenderPreviewFrameWhenIdle(elementAudio);
    lyricsStorageSave(keyStorage, elementHTML.value);
};

const eventsBindSpectrumSetting = (elementInput, settingsGroup, settingName, storageKey) => {
    const isCheckbox = elementInput.type === 'checkbox';
    const isSelect = elementInput.tagName === 'SELECT';
    const eventType = isCheckbox || isSelect ? 'change' : 'input';

    elementInput.addEventListener(eventType, (inputEvent) => {
        let value;
        if (isCheckbox) {
            value = inputEvent.target.checked;
        } else if (elementInput.type === 'number' || elementInput.type === 'range') {
            value = inputEvent.target.valueAsNumber;
            if (!Number.isFinite(value)) return;

            const minimum = elementInput.min === '' ? -Infinity : Number(elementInput.min);
            const maximum = elementInput.max === '' ? Infinity : Number(elementInput.max);
            value = Math.min(maximum, Math.max(minimum, value));

            const step = Number(elementInput.step);
            if (Number.isFinite(step) && step > 0) {
                value = minimum + Math.round((value - minimum) / step) * step;
            }

            elementInput.value = value;
        } else {
            value = inputEvent.target.value;
        }

        settingsGroup[settingName] = value;
        lyricsStorageSave(storageKey, value);

        if (elementInput.type === 'range') {
            elementInput.parentElement.querySelector('output').textContent = `${value}%`;
        }

        lyricsLoopsRenderPreviewFrameWhenIdle(document.querySelector(lyricsSettings.selectors.elementAudio));
    });
};

export const lyricsEventsBindColorInput = () => {
    eventsBindColorInput({
        elementInput: document.querySelector(lyricsSettings.selectors.elementInput.backgroundColor),
        keyStorage: lyricsSettings.storage.keys.colorBackground,
        colorName: 'background',
        elementAudio: document.querySelector(lyricsSettings.selectors.elementAudio),
    });

    eventsBindColorInput({
        elementInput: document.querySelector(lyricsSettings.selectors.elementInput.keyColor),
        keyStorage: lyricsSettings.storage.keys.colorKey,
        colorName: 'key',
        elementAudio: document.querySelector(lyricsSettings.selectors.elementAudio),
    });

    eventsBindColorInput({
        elementInput: document.querySelector(lyricsSettings.selectors.elementInput.textColor),
        keyStorage: lyricsSettings.storage.keys.colorText,
        colorName: 'text',
        elementAudio: document.querySelector(lyricsSettings.selectors.elementAudio),
    });
};

export const lyricsEventsBindTextInput = () => {
    document.querySelector(lyricsSettings.selectors.elementTextarea.lyrics).addEventListener('input', () => {
        const content = lyricsParsingNormalize(document.querySelector(lyricsSettings.selectors.elementTextarea.lyrics).value);
        document.querySelector(lyricsSettings.selectors.elementTextarea.lyrics).value = content;
        lyricsSettings.state.parsedLyrics = lyricsParsingParse(content);

        lyricsLoopsRenderPreviewFrame(document.querySelector(lyricsSettings.selectors.elementAudio));
        lyricsStorageSave(lyricsSettings.storage.keys.lyricsText, content);
    });

    document.querySelector(lyricsSettings.selectors.elementTextarea.header).addEventListener('input', () => {
        eventsPersistOverlayText(lyricsSettings.storage.keys.lyricsHeader, document.querySelector(lyricsSettings.selectors.elementTextarea.header), document.querySelector(lyricsSettings.selectors.elementAudio));
    });

    document.querySelector(lyricsSettings.selectors.elementTextarea.footer).addEventListener('input', () => {
        eventsPersistOverlayText(lyricsSettings.storage.keys.lyricsFooter, document.querySelector(lyricsSettings.selectors.elementTextarea.footer), document.querySelector(lyricsSettings.selectors.elementAudio));
    });

    document.querySelector(lyricsSettings.selectors.elementInput.offset).addEventListener('input', () => {
        lyricsStorageSave(lyricsSettings.storage.keys.lyricsOffset, document.querySelector(lyricsSettings.selectors.elementInput.offset).value);
        lyricsLoopsRenderPreviewFrameWhenIdle(document.querySelector(lyricsSettings.selectors.elementAudio));
    });
};

export const lyricsEventsBindMediaInput = () => {
    document.querySelector(lyricsSettings.selectors.elementInput.audio).addEventListener('change', (inputEvent) => {
        lyricsMediaHandleAudioFileChange(inputEvent, document.querySelector(lyricsSettings.selectors.elementAudio));
    });

    document.querySelector(lyricsSettings.selectors.elementInput.background).addEventListener('change', (inputEvent) => {
        lyricsMediaHandleBackgroundFileChange(inputEvent, document.querySelector(lyricsSettings.selectors.elementAudio));
    });

    document.querySelector(lyricsSettings.selectors.elementInput.intro).addEventListener('change', (inputEvent) => {
        lyricsMediaHandleIntroFileChange(inputEvent);
    });

    document.querySelector(lyricsSettings.selectors.elementButton.removeAudio).addEventListener('click', () => {
        lyricsMediaRemoveAudioAsset(document.querySelector(lyricsSettings.selectors.elementAudio));
    });

    document.querySelector(lyricsSettings.selectors.elementButton.removeBackground).addEventListener('click', () => {
        lyricsMediaRemoveBackgroundAsset(document.querySelector(lyricsSettings.selectors.elementAudio));
    });

    document.querySelector(lyricsSettings.selectors.elementButton.removeIntro).addEventListener('click', () => {
        lyricsMediaRemoveIntroAsset();
    });
};

export const lyricsEventsBindControl = () => {
    document.querySelector(lyricsSettings.selectors.elementButton.fullscreen).addEventListener('click', () => {
        const canvasElement = document.querySelector(lyricsSettings.selectors.elementCanvas.preview)
        if (!document.fullscreenElement) {
            canvasElement.requestFullscreen().catch(console.error);

            return;
        }

        document.exitFullscreen();
    });

    document.querySelector(lyricsSettings.selectors.elementButton.export).addEventListener('click', () => {
        if (lyricsSettings.state.isMp4Exporting) return;
        const audioElement = document.querySelector(lyricsSettings.selectors.elementAudio);
        const buttonElement = document.querySelector(lyricsSettings.selectors.elementButton.export);

        if (lyricsSettings.state.isRecording) {
            lyricsRecordingStop();

            return;
        }

        lyricsRecordingStart({ audioElement, buttonElement });
    });

    document.querySelector(lyricsSettings.selectors.elementButton.exportMp4).addEventListener('click', () => {
        lyricsMp4ExportStart({
            audioElement: document.querySelector(lyricsSettings.selectors.elementAudio),
            buttonElement: document.querySelector(lyricsSettings.selectors.elementButton.exportMp4),
        });
    });

    [
        [lyricsSettings.selectors.elementInput.spectrum, lyricsSettings.state, 'renderSpectrum', lyricsSettings.storage.keys.spectrumEnabled],
        [lyricsSettings.selectors.elementInput.spectrumBarCount, lyricsSettings.spectrum, 'barCount', lyricsSettings.storage.keys.spectrumBarCount],
        [lyricsSettings.selectors.elementInput.spectrumBarGap, lyricsSettings.spectrum, 'barGap', lyricsSettings.storage.keys.spectrumBarGap],
        [lyricsSettings.selectors.elementInput.spectrumPeakEnabled, lyricsSettings.spectrum.peak, 'enabled', lyricsSettings.storage.keys.spectrumPeakEnabled],
        [lyricsSettings.selectors.elementInput.spectrumPeakThickness, lyricsSettings.spectrum.peak, 'thickness', lyricsSettings.storage.keys.spectrumPeakThickness],
        [lyricsSettings.selectors.elementInput.spectrumPeakOpacity, lyricsSettings.spectrum.peak, 'opacityPercent', lyricsSettings.storage.keys.spectrumPeakOpacity],
        [lyricsSettings.selectors.elementInput.spectrumPeakHoldTime, lyricsSettings.spectrum.peak, 'holdTimeMilliseconds', lyricsSettings.storage.keys.spectrumPeakHoldTime],
        [lyricsSettings.selectors.elementInput.spectrumPeakFallingMode, lyricsSettings.spectrum.peak, 'fallingMode', lyricsSettings.storage.keys.spectrumPeakFallingMode],
        [lyricsSettings.selectors.elementInput.spectrumPeakFallSpeed, lyricsSettings.spectrum.peak, 'fallSpeedDecibelsPerSecond', lyricsSettings.storage.keys.spectrumPeakFallSpeed],
    ].forEach(([selector, settingsGroup, settingName, storageKey]) => {
        eventsBindSpectrumSetting(document.querySelector(selector), settingsGroup, settingName, storageKey);
    });

    // Display version radio buttons — auto-saved on change
    document.querySelectorAll(lyricsSettings.selectors.elementRadio.displayVersion).forEach((radioInput) => {
        radioInput.addEventListener('change', (radioEvent) => {
            if (radioEvent.target.checked) {
                lyricsSettings.display.version = radioEvent.target.value;
                lyricsStorageSave(lyricsSettings.storage.keys.displayVersion, radioEvent.target.value);
                lyricsLoopsRenderPreviewFrameWhenIdle(document.querySelector(lyricsSettings.selectors.elementAudio));
            }
        });
    });
};

export const lyricsEventsBindPlayer = () => {
    document.querySelector(lyricsSettings.selectors.elementAudio).addEventListener('loadedmetadata', () => {
        document.querySelector(lyricsSettings.selectors.elementContainer.control).classList.replace('hidden', 'grid');
    });

    document.querySelector(lyricsSettings.selectors.elementAudio).addEventListener('play', async () => {
        await lyricsMediaEnsureAudioContextActive();

        lyricsLoopsStartPreviewLoop();
    });

    document.querySelector(lyricsSettings.selectors.elementAudio).addEventListener('pause', () => {
        if (!lyricsSettings.state.isRecording) {
            lyricsLoopsStopPreviewLoop();
        }
    });

    document.querySelector(lyricsSettings.selectors.elementAudio).addEventListener('seeked', () => {
        lyricsLoopsRenderPreviewFrame(document.querySelector(lyricsSettings.selectors.elementAudio));

        if (lyricsSettings.state.isRecording && !document.querySelector(lyricsSettings.selectors.elementAudio).paused) {
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