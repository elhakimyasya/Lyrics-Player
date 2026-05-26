import { lyricsSettings } from './lyricsSettings';
import { lyricsEnsureAudioContextActive } from './lyricsAudioContext';
import { lyricsRenderPreviewFrame } from './lyricsCanvasRender';
import { lyricsStartPreviewLoop, lyricsStopPreviewLoop } from './lyricsPreviewLoop';

export const lyricsBindPlayerEvents = (dom) => {
    dom.audioPlayer.addEventListener('loadedmetadata', () => {
        dom.containerControl.classList.replace('hidden', 'grid');
    });

    dom.audioPlayer.addEventListener('play', async () => {
        await lyricsEnsureAudioContextActive();

        lyricsStartPreviewLoop();
    });

    dom.audioPlayer.addEventListener('pause', () => {
        if (!lyricsSettings.lyricsStateIsRecording) {
            lyricsStopPreviewLoop();
        }
    });

    dom.audioPlayer.addEventListener('seeked', () => {
        lyricsRenderPreviewFrame(dom.audioPlayer);

        if (lyricsSettings.lyricsStateIsRecording && !dom.audioPlayer.paused) {
            lyricsStartPreviewLoop();
        }
    });
};
