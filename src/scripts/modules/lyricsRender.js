import { settings } from "../script";
import { lyricsRenderSpectrum } from "./lyricsRenderSpectrum";

export const lyricsRender = (nowMs, drawContext) => {
    const elementTextareaHeader = document.querySelector(settings.elementTextareaHeader);
    const elementTextareaFooter = document.querySelector(settings.elementTextareaFooter);
    const elementAudio = document.querySelector(settings.elementAudio);

    const renderOffset = (parseFloat(document.querySelector(settings.elementInputOffset).value) || 0) * 1000;
    const renderTime = nowMs + renderOffset;

    drawContext.clearRect(0, 0, settings.lyricsPreviewWidth, settings.lyricsPreviewHeight);
    if (settings.lyricsBackground) {
        try {
            drawContext.drawImage(settings.lyricsBackground.el, 0, 0, settings.lyricsPreviewWidth, settings.lyricsPreviewHeight);
        } catch (error) {
            console.log('Error drawing background:', error);
        }

        drawContext.fillStyle = 'rgba(0, 0, 0, 0.12)';
        drawContext.fillRect(0, 0, settings.lyricsPreviewWidth, settings.lyricsPreviewHeight);
    }

    if (!settings.lyricsParsed.length) {
        drawContext.fillStyle = '#000';
        drawContext.font = `76px "${settings.lyricsFont}", Inter, sans-serif`;
        drawContext.textAlign = 'center';
        drawContext.textBaseline = 'middle';
        drawContext.fillText('—', settings.lyricsPreviewWidth / 2, settings.lyricsPreviewHeight / 2);

        return;
    }

    // cari index active
    let renderIndexActiveLine = -1;
    for (let index = 0; index < settings.lyricsParsed.length; index++) {
        if (settings.lyricsParsed[index].timeMs <= renderTime) {
            renderIndexActiveLine = index;
        } else {
            break
        }
    }

    if (renderIndexActiveLine < 0) {
        renderIndexActiveLine = 0
    };

    const renderCurrentStart = settings.lyricsParsed[renderIndexActiveLine].timeMs;
    const renderCurrentEnd = settings.lyricsParsed[renderIndexActiveLine + 1] ? settings.lyricsParsed[renderIndexActiveLine + 1].timeMs : elementAudio.duration * 1000;
    const renderActiveProgress = Math.max(0, Math.min(1, (renderTime - renderCurrentStart) / (renderCurrentEnd - renderCurrentStart)))

    const renderLineSpacing = 120;
    const renderBaseActiveY = settings.lyricsPreviewHeight * 0.55;
    const renderBasePrevY = renderBaseActiveY - renderLineSpacing;
    const renderBaseNextY = renderBaseActiveY + renderLineSpacing;
    const renderScrollOffset = renderActiveProgress * renderLineSpacing;

    const renderPrevY = renderBasePrevY - renderScrollOffset;
    const renderActiveY = renderBaseActiveY - renderScrollOffset;
    const renderNextY = renderBaseNextY - renderScrollOffset;

    drawContext.textAlign = 'center';
    drawContext.textBaseline = 'middle';

    const renderActiveText = settings.lyricsParsed[renderIndexActiveLine] ? settings.lyricsParsed[renderIndexActiveLine].text : '';
    const renderPrevText = settings.lyricsParsed[renderIndexActiveLine - 1] ? settings.lyricsParsed[renderIndexActiveLine - 1].text : '';
    const renderNextText = settings.lyricsParsed[renderIndexActiveLine + 1] ? settings.lyricsParsed[renderIndexActiveLine + 1].text : '';

    // prev line
    let renderPrevAlpha = 1;
    if (renderPrevText) {
        if (renderActiveText.includes(settings.lyricsInstrumentalText)) {
            const renderFadeSpeed = 0.1;
            renderPrevAlpha = Math.max(0, Math.min(1, 1 - renderActiveProgress / renderFadeSpeed));
        } else {
            renderPrevAlpha = 1 - renderActiveProgress;
        }

        const isItalicPrev = /^\(.*\)$/.test(renderPrevText);
        drawContext.font = `${isItalicPrev ? "italic " : ""}82px "${settings.lyricsFont}", Inter, sans-serif`;
        drawContext.fillStyle = '#fff';
        drawContext.globalAlpha = renderPrevAlpha;
        drawContext.fillText(
            renderPrevText,
            settings.lyricsPreviewWidth / 2,
            renderPrevY
        );
    }

    // active line
    const isItalicActive = /^\(.*\)$/.test(renderActiveText);
    drawContext.font = `${isItalicActive ? "italic " : ""}82px "${settings.lyricsFont}", Inter, sans-serif`;
    drawContext.fillStyle = '#ffde59';
    drawContext.globalAlpha = 1.0;
    drawContext.fillText(
        renderActiveText,
        settings.lyricsPreviewWidth / 2,
        renderActiveY
    );

    // next line
    let renderNextAlpha = renderActiveProgress;
    if (renderActiveText.includes(settings.lyricsInstrumentalText)) {
        const renderRemaining = renderCurrentEnd - renderTime;
        const renderFadeDuration = Math.min(500, renderCurrentEnd - renderCurrentStart);
        renderNextAlpha = renderRemaining < renderFadeDuration ? 1 - (renderRemaining / renderFadeDuration) : 0;
    }
    if (renderNextText) {
        const isItalicNext = /^\(.*\)$/.test(renderNextText);
        drawContext.font = `${isItalicNext ? "italic " : ""}82px "${settings.lyricsFont}", Inter, sans-serif`;
        drawContext.fillStyle = '#fff';
        drawContext.globalAlpha = renderNextAlpha;
        drawContext.fillText(
            renderNextText,
            settings.lyricsPreviewWidth / 2,
            renderNextY
        );
    }

    // header text
    if (elementTextareaHeader && elementTextareaHeader.value.trim()) {
        const headerLines = elementTextareaHeader.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        lyricsRenderHeaderFooter(drawContext, headerLines, renderTime, {
            font: `48px "${settings.lyricsFont}", Inter, sans-serif`,
            x: settings.lyricsPreviewWidth / 2,
            y: 120, // margin atas
            baseline: 'top'
        }, 'lyricsHeaderFirstRender');
    }

    // footer text (multi-line bergantian)
    if (elementTextareaFooter && elementTextareaFooter.value.trim()) {
        const footerLines = elementTextareaFooter.value.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        lyricsRenderHeaderFooter(drawContext, footerLines, renderTime, {
            font: `32px "${settings.lyricsFont}", Inter, sans-serif`,
            x: settings.lyricsPreviewWidth / 2,
            y: settings.lyricsPreviewHeight - 120, // margin bawah
            baseline: 'bottom'
        }, 'lyricsHeaderFirstRender');
    }

    if (settings.lyricsRenderSpectrum) {
        drawContext.globalAlpha = 1.0; // pastikan alpha 100%

        lyricsRenderSpectrum(drawContext);
    }

    window.lyricsHeaderFirstRender = true;

    drawContext.globalAlpha = 1.0;
}

export const lyricsGetAudio = (audio) => {
    return new Promise((res, rej) => {
        if (audio.readyState >= 2) {
            return res()
        };

        function onloaded() {
            cleanup(); res();
        }

        function onerr() {
            cleanup();
            rej(new Error('Cannot load audio'));
        }

        function cleanup() {
            audio.removeEventListener('canplay', onloaded);
            audio.removeEventListener('error', onerr);
        }

        audio.addEventListener('canplay', onloaded);
        audio.addEventListener('error', onerr);
    });
};

export const lyricsRenderHeaderFooter = (drawContext, lines, nowMs, opts, firstRenderFlagName) => {
    if (!lines || !lines.length) return;

    drawContext.font = opts.font;
    drawContext.textAlign = 'center';
    drawContext.textBaseline = opts.baseline;

    // hanya 1 line → tampil statis putih
    if (lines.length === 1) {
        drawContext.fillStyle = '#fff';
        drawContext.globalAlpha = 1;
        drawContext.fillText(lines[0], opts.x, opts.y);
        drawContext.globalAlpha = 1;
        return;
    }

    const nowSec = nowMs / 1000;
    const lineDuration = opts.lineDuration || 6; // detik per line
    const totalLines = lines.length;

    // index line aktif
    const idx = Math.floor(nowSec / lineDuration) % totalLines;

    // progress dari 0 → 1 untuk line ini
    const progress = (nowSec % lineDuration) / lineDuration;

    // fade in/out
    const fadeZone = 0.2; // 20% awal/akhir
    let alpha = 0.5; // default full

    if (!window[firstRenderFlagName]) {
        if (progress < fadeZone) {
            alpha = progress / fadeZone; // fade in
        } else if (progress > 1 - fadeZone) {
            alpha = (1 - progress) / fadeZone; // fade out
        }
    }

    // warna: genap = kuning, ganjil = putih
    const color = (idx % 2 === 0) ? '#ffde59' : '#fff';

    drawContext.fillStyle = color;
    drawContext.globalAlpha = alpha;
    drawContext.fillText(lines[idx], opts.x, opts.y);
    drawContext.globalAlpha = 0.5; // reset ke normal

    if (window[firstRenderFlagName]) {
        window[firstRenderFlagName] = false;
    }
};

export const lyricsRenderLoop = () => {
    const elementAudio = document.querySelector(settings.elementAudio);

    lyricsRender(elementAudio.currentTime * 1000, settings.lyricsContext);

    settings.lyricsRequestAnimationFrameID = requestAnimationFrame(lyricsRenderLoop);
}