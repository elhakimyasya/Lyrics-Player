import { lyricsHandleAudioFileChange, lyricsHandleBackgroundFileChange } from './lyricsMediaAssets';

export const lyricsBindMediaInputEvents = (dom) => {
    dom.inputAudio.addEventListener('change', (event) => {
        lyricsHandleAudioFileChange(event, dom.audioPlayer);
    });

    dom.inputBackground.addEventListener('change', (event) => {
        lyricsHandleBackgroundFileChange(event, dom.audioPlayer);
    });
};
