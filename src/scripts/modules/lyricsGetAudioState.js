export const lyricsGetAudioState = (audioElement) => {
    return new Promise((resolve, reject) => {
        if (audioElement.readyState >= 2) return resolve();

        const handleCanPlay = () => {
            cleanupListeners();
            resolve();
        };

        const handleError = () => {
            cleanupListeners();
            reject(new Error('Audio resource failed to load.'));
        };

        const cleanupListeners = () => {
            audioElement.removeEventListener('canplay', handleCanPlay);
            audioElement.removeEventListener('error', handleError);
        };

        audioElement.addEventListener('canplay', handleCanPlay);
        audioElement.addEventListener('error', handleError);
    });
};