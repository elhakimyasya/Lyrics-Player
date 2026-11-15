import { lyricsSettings } from './lyricsSettings';
import { lyricsParsingParse } from './lyricsParsing';
import { lyricsStorageLoad } from './lyricsStorage';
import { lyricsParsingNormalize } from './lyricsParsing';
import { lyricsRenderingCoreRender } from './lyricsRenderingCore';
import { lyricsMediaRestoreAudioAsset, lyricsMediaRestoreBackgroundAsset, lyricsMediaRestoreIntroAsset, lyricsMediaUpdateRemoveButtonVisibility } from './lyricsMedia';

export const lyricsAppInit = async () => {
    const elementTextareaLyrics = document.querySelector(lyricsSettings.selectors.elementTextarea.lyrics);
    const elementTextareaHeader = document.querySelector(lyricsSettings.selectors.elementTextarea.header);
    const elementTextareaFooter = document.querySelector(lyricsSettings.selectors.elementTextarea.footer);
    const elementInputOffset = document.querySelector(lyricsSettings.selectors.elementInput.offset);
    const elementInputColorBackground = document.querySelector(lyricsSettings.selectors.elementInput.backgroundColor);
    const elementInputColorKey = document.querySelector(lyricsSettings.selectors.elementInput.keyColor);
    const elementInputColorText = document.querySelector(lyricsSettings.selectors.elementInput.textColor);
    const elementInputSpectrum = document.querySelector(lyricsSettings.selectors.elementInput.spectrum);
    const elementAudioPlayer = document.querySelector(lyricsSettings.selectors.elementAudio);
    const elementInputIntro = document.querySelector(lyricsSettings.selectors.elementInput.intro);

    elementTextareaLyrics.value = lyricsParsingNormalize(lyricsStorageLoad(lyricsSettings.storage.keys.lyricsText, lyricsSettings.storage.defaults.lyrics));
    elementTextareaHeader.value = lyricsStorageLoad(lyricsSettings.storage.keys.lyricsHeader, '');
    elementTextareaFooter.value = lyricsStorageLoad(lyricsSettings.storage.keys.lyricsFooter, '');
    elementInputOffset.value = lyricsStorageLoad(lyricsSettings.storage.keys.lyricsOffset, lyricsSettings.storage.defaults.offset);
    elementInputColorBackground.value = lyricsSettings.colors.background;
    elementInputColorKey.value = lyricsSettings.colors.key;
    elementInputColorText.value = lyricsSettings.colors.text;
    elementInputSpectrum.checked = lyricsSettings.state.renderSpectrum;
    document.querySelector(lyricsSettings.selectors.elementInput.spectrumBarCount).value = lyricsSettings.spectrum.barCount;
    document.querySelector(lyricsSettings.selectors.elementInput.spectrumBarGap).value = lyricsSettings.spectrum.barGap;
    document.querySelector(lyricsSettings.selectors.elementInput.spectrumPeakEnabled).checked = lyricsSettings.spectrum.peak.enabled;
    document.querySelector(lyricsSettings.selectors.elementInput.spectrumPeakThickness).value = lyricsSettings.spectrum.peak.thickness;
    const elementInputSpectrumPeakOpacity = document.querySelector(lyricsSettings.selectors.elementInput.spectrumPeakOpacity);
    elementInputSpectrumPeakOpacity.value = lyricsSettings.spectrum.peak.opacityPercent;
    elementInputSpectrumPeakOpacity.parentElement.querySelector('output').textContent = `${lyricsSettings.spectrum.peak.opacityPercent}%`;
    document.querySelector(lyricsSettings.selectors.elementInput.spectrumPeakHoldTime).value = lyricsSettings.spectrum.peak.holdTimeMilliseconds;
    document.querySelector(lyricsSettings.selectors.elementInput.spectrumPeakFallingMode).value = lyricsSettings.spectrum.peak.fallingMode;
    document.querySelector(lyricsSettings.selectors.elementInput.spectrumPeakFallSpeed).value = lyricsSettings.spectrum.peak.fallSpeedDecibelsPerSecond;

    // Restore saved lineBaseYRatio
    const savedBaseYRatio = lyricsStorageLoad(lyricsSettings.storage.keys.lineBaseYRatio, '');
    if (savedBaseYRatio !== '') {
        const parsed = parseFloat(savedBaseYRatio);
        if (!Number.isNaN(parsed)) {
            lyricsSettings.rendering.lyrics.defaultBaseYRatio = parsed;
        }
    }

    // Set display version radio state
    document.querySelectorAll(lyricsSettings.selectors.elementRadio.displayVersion).forEach((radioInput) => {
        radioInput.checked = radioInput.value === lyricsSettings.display.version;
    });

    lyricsSettings.state.parsedLyrics = lyricsParsingParse(elementTextareaLyrics.value);

    await lyricsMediaRestoreAudioAsset(elementAudioPlayer);
    await lyricsMediaRestoreBackgroundAsset(elementAudioPlayer);
    await lyricsMediaRestoreIntroAsset(elementInputIntro);
    lyricsMediaUpdateRemoveButtonVisibility();

    requestAnimationFrame(() => lyricsRenderingCoreRender(0, lyricsSettings.canvas.context));
};