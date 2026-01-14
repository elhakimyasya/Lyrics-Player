import { lyricsSettings } from "./lyricsSettings";

export const lyricsRenderAnalyzer = (audioElement) => {
    if (!lyricsSettings.lyricsAudioContext) {
        lyricsSettings.lyricsAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        lyricsSettings.lyricsAudioAnalyser = lyricsSettings.lyricsAudioContext.createAnalyser();
        lyricsSettings.lyricsAudioAnalyser.fftSize = 1024;
        lyricsSettings.lyricsAudioAnalyser.smoothingTimeConstant = 0.1;

        lyricsSettings.lyricsAudioSource = lyricsSettings.lyricsAudioContext.createMediaElementSource(audioElement);

        const audioBassFilter = lyricsSettings.lyricsAudioContext.createBiquadFilter();
        audioBassFilter.type = 'lowshelf';
        audioBassFilter.frequency.value = 150;
        audioBassFilter.gain.value = 6;

        const audioGainNode = lyricsSettings.lyricsAudioContext.createGain();
        audioGainNode.gain.value = 1.0;

        lyricsSettings.lyricsAudioSource.connect(audioBassFilter);
        audioBassFilter.connect(lyricsSettings.lyricsAudioAnalyser);
        lyricsSettings.lyricsAudioAnalyser.connect(audioGainNode);
        audioGainNode.connect(lyricsSettings.lyricsAudioContext.destination);

        lyricsSettings.lyricsAudioFrequencyData = new Uint8Array(lyricsSettings.lyricsAudioAnalyser.frequencyBinCount);
    }
};