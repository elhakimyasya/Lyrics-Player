import { settings } from "../script";

export const lyricsRenderSpectrum = (drawContext) => {
    if (!settings.lyricsSpectrumAnalyser || !settings.lyricsSpectrumFrequencyData) return;
    
    settings.lyricsSpectrumAnalyser.getByteFrequencyData(settings.lyricsSpectrumFrequencyData);

    const barsNumber = 80;
    const binSize = Math.floor(settings.lyricsSpectrumFrequencyData.length / barsNumber);

    const barGap = 3;
    const barWidth = (settings.lyricsPreviewWidth / 2) / barsNumber;

    const spectrumHeight = settings.lyricsPreviewHeight * 0.12;
    const baseY = settings.lyricsPreviewHeight;
    const barThresold = 5;

    // bikin gradient 1x aja, bukan per-bar
    const gradient = drawContext.createLinearGradient(0, baseY, 0, baseY - spectrumHeight);
    gradient.addColorStop(0, "rgba(255,222,89,0.1)");
    gradient.addColorStop(1, "rgba(255,222,89,0.9)");
    drawContext.fillStyle = gradient;

    for (let i = 0; i < barsNumber; i++) {
        // pakai max biar gak berat
        let max = 0;
        for (let j = 0; j < binSize; j++) {
            const v = settings.lyricsSpectrumFrequencyData[i * binSize + j];
            if (v > max) max = v;
        }
        let avg = max;

        if (avg < barThresold) avg = 0;

        const scale = 1 - (i / (barsNumber - 1)) * 0.98;
        const barHeight = (avg / 255) * spectrumHeight * scale;

        const xLeft = i * barWidth;
        const y = baseY - barHeight;

        drawContext.fillRect(xLeft, y, barWidth - barGap, barHeight);

        const xRight = settings.lyricsPreviewWidth / 2 + (barsNumber - i - 1) * barWidth;
        drawContext.fillRect(xRight, y, barWidth - barGap, barHeight);
    }
}

export const lyricsRenderAnalyzer = (audioEl) => {
    if (!settings.lyricsSpectrumAudioContext) {
        settings.lyricsSpectrumAudioContext = new AudioContext();
        settings.lyricsSpectrumAnalyser = settings.lyricsSpectrumAudioContext.createAnalyser();
        settings.lyricsSpectrumAnalyser.fftSize = 1024; // lebih detail
        settings.lyricsSpectrumAnalyser.smoothingTimeConstant = 0.1; // lebih responsif
        settings.lyricsSpectrumSource = settings.lyricsSpectrumAudioContext.createMediaElementSource(audioEl);

        // Tambahkan bass filte
        const bassFilter = settings.lyricsSpectrumAudioContext.createBiquadFilter();
        bassFilter.type = 'lowshelf';
        bassFilter.frequency.value = 150; // bass di bawah 150Hz
        bassFilter.gain.value = 6; // boost 6dB


        // tambahin gain biar lebih sensitif
        const gainNode = settings.lyricsSpectrumAudioContext.createGain();
        gainNode.gain.value = 1.0; // 2x lebih keras

        // koneksi: source → bass → analyzer → gain → destination
        settings.lyricsSpectrumSource.connect(bassFilter);
        bassFilter.connect(settings.lyricsSpectrumAnalyser);
        settings.lyricsSpectrumAnalyser.connect(gainNode);
        gainNode.connect(settings.lyricsSpectrumAudioContext.destination);

        settings.lyricsSpectrumFrequencyData = new Uint8Array(settings.lyricsSpectrumAnalyser.frequencyBinCount);
    }
}