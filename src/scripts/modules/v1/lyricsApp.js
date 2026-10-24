import { lyricsSettings } from './lyricsCore';
import { lyricsParsingParse } from './lyricsParsing';
import { lyricsStorageLoad } from './lyricsStorage';
import { lyricsParsingNormalize } from './lyricsParsing';
import { lyricsRenderingCoreRender } from './lyricsRenderingCore';
import { lyricsMediaRestoreAudioAsset, lyricsMediaRestoreBackgroundAsset, lyricsMediaRestoreIntroAsset, lyricsMediaUpdateRemoveButtonVisibility } from './lyricsMedia';

export const lyricsAppInit = async () => {
    const elementTextareaLyrics = document.querySelector(lyricsSettings.elementSelectorTextareaLyrics);
    const elementTextareaHeader = document.querySelector(lyricsSettings.elementSelectorTextareaHeader);
    const elementTextareaFooter = document.querySelector(lyricsSettings.elementSelectorTextareaFooter);
    const elementInputOffset = document.querySelector(lyricsSettings.elementSelectorInputOffset);
    const elementInputColorBackground = document.querySelector(lyricsSettings.elementSelectorColorBackground);
    const elementInputColorKey = document.querySelector(lyricsSettings.elementSelectorColorKey);
    const elementInputColorText = document.querySelector(lyricsSettings.elementSelectorColorText);
    const elementInputSpectrum = document.querySelector(lyricsSettings.elementSelectorInputSpectrum);
    const elementAudioPlayer = document.querySelector(lyricsSettings.elementSelectorAudio);
    const elementInputIntro = document.querySelector(lyricsSettings.elementSelectorInputIntro);

    elementTextareaLyrics.value = lyricsParsingNormalize(lyricsStorageLoad(lyricsSettings.lyricsStorageKeys.lyricsText, lyricsSettings.lyricsDefaultLyrics));
    elementTextareaHeader.value = lyricsStorageLoad(lyricsSettings.lyricsStorageKeys.lyricsHeader, '');
    elementTextareaFooter.value = lyricsStorageLoad(lyricsSettings.lyricsStorageKeys.lyricsFooter, '');
    elementInputOffset.value = lyricsStorageLoad(lyricsSettings.lyricsStorageKeys.lyricsOffset, lyricsSettings.lyricsDefaultOffset);
    elementInputColorBackground.value = lyricsSettings.lyricsBgColor;
    elementInputColorKey.value = lyricsSettings.lyricsKeyColor;
    elementInputColorText.value = lyricsSettings.lyricsNonActiveTextColor;
    elementInputSpectrum.checked = lyricsSettings.lyricsStateRenderSpectrum;

    // Restore saved lineBaseYRatio
    const savedBaseYRatio = lyricsStorageLoad(lyricsSettings.lyricsStorageKeys.lineBaseYRatio, '');
    if (savedBaseYRatio !== '') {
        const parsed = parseFloat(savedBaseYRatio);
        if (!Number.isNaN(parsed)) {
            lyricsSettings.lyricsLineBaseYRatio = parsed;
        }
    }

    // Set display version radio state
    document.querySelectorAll(lyricsSettings.elementSelectorRadioDisplayVersion).forEach((radioInput) => {
        radioInput.checked = radioInput.value === lyricsSettings.lyricsDisplayVersion;
    });

    lyricsSettings.lyricsDataParsed = lyricsParsingParse(elementTextareaLyrics.value);

    await lyricsMediaRestoreAudioAsset(elementAudioPlayer);
    await lyricsMediaRestoreBackgroundAsset(elementAudioPlayer);
    await lyricsMediaRestoreIntroAsset(elementInputIntro);
    lyricsMediaUpdateRemoveButtonVisibility();

    requestAnimationFrame(() => lyricsRenderingCoreRender(0, lyricsSettings.lyricsCanvasContext));
};