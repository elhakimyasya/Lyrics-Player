import { lyricsSettings } from './lyricsSettings';
import { lyricsParse } from './lyricsParse';
import { lyricsStorageLoad } from './lyricsStorageLoad';
import { lyricsNormalize } from './lyricsNormalize';
import { lyricsRender } from './lyricsRender';
import { lyricsRestoreAudioAsset, lyricsRestoreBackgroundAsset } from './lyricsMediaAssets';

const defaultLyrics = '[00:00.00] Intro\n[00:05.00] Lirik Baris Pertama';

export const lyricsInitializeApplication = async (dom) => {
    dom.textareaLyrics.value = lyricsNormalize(lyricsStorageLoad('lyrics_textarea', defaultLyrics));
    dom.textareaHeader.value = lyricsStorageLoad('lyrics_header', '');
    dom.textareaFooter.value = lyricsStorageLoad('lyrics_footer', '');
    dom.inputOffset.value = lyricsStorageLoad('lyrics_offset', '0');

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
