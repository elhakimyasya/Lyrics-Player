import { settings } from "../script";

export const lyricsRenderSpectrum = (drawContext) => {
    if (!settings.lyricsSpectrumAnalyser || !settings.lyricsSpectrumFrequencyData) {
        return;
    };
    
    drawContext.globalAlpha = 1.0; // pastikan alpha normal

    settings.lyricsSpectrumAnalyser.getByteFrequencyData(settings.lyricsSpectrumFrequencyData);

    const barsNumber = 80; // jumlah bar uniform
    const binSize = Math.floor(settings.lyricsSpectrumFrequencyData.length / barsNumber);

    const barGap = 4;
    const barWidth = (settings.lyricsPreviewWidth / 2) / barsNumber;

    const spectrumHeight = settings.lyricsPreviewHeight * 0.1;
    const baseY = settings.lyricsPreviewHeight;

    // barThresold untuk abaikan suara kecil
    const barThresold = 5; // 0–255 (semakin tinggi → makin banyak suara kecil diabaikan)

    for (let i = 0; i < barsNumber; i++) {
        // rata-rata FFT dalam 1 bin
        let sum = 0;
        for (let j = 0; j < binSize; j++) {
            sum += settings.lyricsSpectrumFrequencyData[i * binSize + j];
        }
        let avg = sum / binSize;

        // --- abaikan suara kecil ---
        if (avg < barThresold) avg = 0;

        // skala miring: 100% di kiri → 2% di kanan
        const scale = 1 - (i / (barsNumber - 1)) * (1 - 0.02);
        const barHeight = (avg / 255) * spectrumHeight * scale;

        const xLeft = i * barWidth;
        const y = baseY - barHeight;

        drawContext.fillStyle = `rgba(255, 222, 89, 0.5)`;
        drawContext.shadowBlur = 8;
        drawContext.fillRect(xLeft, y, barWidth - barGap, barHeight);

        // mirror kanan
        const xRight = settings.lyricsPreviewWidth / 2 + (barsNumber - i - 1) * barWidth;
        drawContext.fillRect(xRight, y, barWidth - barGap, barHeight);
    }

    drawContext.shadowBlur = 0;
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