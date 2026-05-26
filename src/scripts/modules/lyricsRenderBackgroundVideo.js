import { lyricsSettings } from './lyricsSettings';

export const lyricsEnsureBackgroundVideoPlaying = () => {
    if (lyricsSettings.lyricsResourceBackground?.type !== 'video') {
        return;
    }

    const videoElement = lyricsSettings.lyricsResourceBackground.element;
    if (!videoElement.paused || videoElement.ended) {
        return;
    }

    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.play().catch(() => {});
};
