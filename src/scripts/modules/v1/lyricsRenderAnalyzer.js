import { lyricsSettings } from './lyricsSettings';

export const lyricsRenderAnalyzer = (audioElement) => {
    if (!lyricsSettings.lyricsAudioContext) {
        lyricsSettings.lyricsAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        lyricsSettings.lyricsAudioAnalyser = lyricsSettings.lyricsAudioContext.createAnalyser();
        lyricsSettings.lyricsAudioAnalyser.fftSize = lyricsSettings.lyricsAudioAnalyserFftSize;
        lyricsSettings.lyricsAudioAnalyser.smoothingTimeConstant = lyricsSettings.lyricsAudioAnalyserSmoothing;
        lyricsSettings.lyricsAudioSource = lyricsSettings.lyricsAudioContext.createMediaElementSource(audioElement);

        const audioBassFilter = lyricsSettings.lyricsAudioContext.createBiquadFilter();
        audioBassFilter.type = lyricsSettings.lyricsAudioBassFilterType;
        audioBassFilter.frequency.value = lyricsSettings.lyricsAudioBassFilterFrequency;
        audioBassFilter.gain.value = lyricsSettings.lyricsAudioBassFilterGain;

        const audioGainNode = lyricsSettings.lyricsAudioContext.createGain();
        audioGainNode.gain.value = lyricsSettings.lyricsAudioOutputGain;
        lyricsSettings.lyricsAudioSource.connect(audioBassFilter);
        audioBassFilter.connect(lyricsSettings.lyricsAudioAnalyser);
        lyricsSettings.lyricsAudioAnalyser.connect(audioGainNode);
        audioGainNode.connect(lyricsSettings.lyricsAudioContext.destination);

        lyricsSettings.lyricsAudioFrequencyData = new Uint8Array(lyricsSettings.lyricsAudioAnalyser.frequencyBinCount);
    }
};
