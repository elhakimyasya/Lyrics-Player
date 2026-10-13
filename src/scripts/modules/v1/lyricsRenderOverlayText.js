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
    const overlayAlpha = Math.max(0, Math.min(1, lyricsSettings.lyricsBackgroundCurrentOpacity / lyricsSettings.lyricsOverlayOpacityReference));

    renderOverlayLines(drawContext, getTextareaLines(lyricsSettings.elementSelectorTextareaHeader), adjustedRenderTime, {
        font: `${lyricsSettings.lyricsOverlayHeaderFontSize}px "${lyricsSettings.lyricsFontFace}", sans-serif`,
        x: lyricsSettings.lyricsPreviewWidth / 2,
        y: lyricsSettings.lyricsOverlayHeaderY,
        baseline: 'top',
        baseAlpha: overlayAlpha,
    });

    renderOverlayLines(drawContext, getTextareaLines(lyricsSettings.elementSelectorTextareaFooter), adjustedRenderTime, {
        font: `${lyricsSettings.lyricsOverlayFooterFontSize}px "${lyricsSettings.lyricsFontFace}", sans-serif`,
        x: lyricsSettings.lyricsPreviewWidth / 2,
        y: lyricsSettings.lyricsPreviewHeight - lyricsSettings.lyricsOverlayFooterBottomOffset,
        baseline: 'bottom',
        baseAlpha: overlayAlpha,
    });
};
