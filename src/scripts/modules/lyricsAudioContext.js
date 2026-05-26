import { lyricsSettings } from './lyricsSettings';

export const lyricsEnsureAudioContextActive = async () => {
    if (!lyricsSettings.lyricsAudioContext || lyricsSettings.lyricsAudioContext.state !== 'suspended') {
        return;
    }

    try {
        await lyricsSettings.lyricsAudioContext.resume();
    } catch (error) {
        console.error('Failed to resume AudioContext:', error);
    }
};
