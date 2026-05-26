import { lyricsSettings } from './lyricsSettings';
import { lyricsParse } from './lyricsParse';
import { lyricsStorageLoad } from './lyricsStorageLoad';
import { lyricsNormalize } from './lyricsNormalize';
import { lyricsRender } from './lyricsRender';
import { lyricsRestoreAudioAsset, lyricsRestoreBackgroundAsset } from './lyricsMediaAssets';

export const lyricsInitializeApplication = async (dom) => {
    dom.textareaLyrics.value = lyricsNormalize(lyricsStorageLoad(lyricsSettings.lyricsStorageKeys.lyricsText, lyricsSettings.lyricsDefaultLyrics));
    dom.textareaHeader.value = lyricsStorageLoad(lyricsSettings.lyricsStorageKeys.lyricsHeader, '');
    dom.textareaFooter.value = lyricsStorageLoad(lyricsSettings.lyricsStorageKeys.lyricsFooter, '');
    dom.inputOffset.value = lyricsStorageLoad(lyricsSettings.lyricsStorageKeys.lyricsOffset, lyricsSettings.lyricsDefaultOffset);

    dom.inputBgColor.value = lyricsSettings.lyricsBgColor;
    dom.inputKeyColor.value = lyricsSettings.lyricsKeyColor;
    dom.inputNonActiveTextColor.value = lyricsSettings.lyricsNonActiveTextColor;
    dom.inputSpectrum.checked = lyricsSettings.lyricsStateRenderSpectrum;

    lyricsSettings.lyricsDataParsed = lyricsParse(dom.textareaLyrics.value);

    await lyricsRestoreAudioAsset(dom.audioPlayer);
    await lyricsRestoreBackgroundAsset(dom.audioPlayer);

    requestAnimationFrame(() => {
        lyricsRender(0, lyricsSettings.lyricsCanvasContext);
    });
};
