import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderHeaderFooter } from './lyricsRenderHeaderFooter';

const getTextareaLines = (selector) => {
    const element = document.querySelector(selector);
    if (!element?.value.trim()) {
        return [];
    }

    return element.value
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
};

const renderOverlayLines = (drawContext, lines, adjustedRenderTime, options) => {
    if (!lines.length) {
        return;
    }

    lyricsRenderHeaderFooter(drawContext, lines, adjustedRenderTime, options);
};

export const lyricsRenderOverlayText = (drawContext, adjustedRenderTime) => {
    const overlayAlpha = Math.max(0, Math.min(1, lyricsSettings.lyricsBackgroundCurrentOpacity / 0.95));

    renderOverlayLines(drawContext, getTextareaLines(lyricsSettings.elementSelectorTextareaHeader), adjustedRenderTime, {
        font: `48px "${lyricsSettings.lyricsFontFace}", sans-serif`,
        x: lyricsSettings.lyricsPreviewWidth / 2,
        y: 120,
        baseline: 'top',
        baseAlpha: overlayAlpha,
    });

    renderOverlayLines(drawContext, getTextareaLines(lyricsSettings.elementSelectorTextareaFooter), adjustedRenderTime, {
        font: `32px "${lyricsSettings.lyricsFontFace}", sans-serif`,
        x: lyricsSettings.lyricsPreviewWidth / 2,
        y: lyricsSettings.lyricsPreviewHeight - 120,
        baseline: 'bottom',
        baseAlpha: overlayAlpha,
    });
};
