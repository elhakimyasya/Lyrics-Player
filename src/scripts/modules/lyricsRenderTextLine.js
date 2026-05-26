import { lyricsSettings } from './lyricsSettings';

const getLyricFont = (text) => {
    const fontStyle = /^\(.*\)$/.test(text) ? 'italic ' : '';
    
    return `${fontStyle}82px "${lyricsSettings.lyricsFontFace}", sans-serif`;
};

export const lyricsRenderTextLine = (drawContext, { text, x, y, color, alpha = 1 }) => {
    if (!text) {
        return;
    }

    drawContext.save();
    drawContext.font = getLyricFont(text);
    drawContext.fillStyle = color;
    drawContext.globalAlpha = alpha;
    drawContext.fillText(text, x, y);
    drawContext.restore();
};
