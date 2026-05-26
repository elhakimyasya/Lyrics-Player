import { lyricsSettings } from './lyricsSettings';

const hexToRgb = (hex) => ({
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
});

const drawResourceCover = (ctx, resource, canvasWidth, canvasHeight) => {
    const element = resource.element;
    const resourceWidth = resource.type === 'video' ? element.videoWidth : element.width;
    const resourceHeight = resource.type === 'video' ? element.videoHeight : element.height;
    if (!resourceWidth || !resourceHeight) {
        return;
    }

    const resourceRatio = resourceWidth / resourceHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    let drawWidth;
    let drawHeight;
    let offsetX;
    let offsetY;

    if (resourceRatio > canvasRatio) {
        drawHeight = canvasHeight;
        drawWidth = canvasHeight * resourceRatio;
        offsetX = (canvasWidth - drawWidth) / 2;
        offsetY = 0;
    } else {
        drawWidth = canvasWidth;
        drawHeight = canvasWidth / resourceRatio;
        offsetX = 0;
        offsetY = (canvasHeight - drawHeight) / 2;
    }

    ctx.drawImage(element, offsetX, offsetY, drawWidth, drawHeight);
};

export const lyricsRenderBackground = (drawContext) => {
    const canvasWidth = lyricsSettings.lyricsPreviewWidth;
    const canvasHeight = lyricsSettings.lyricsPreviewHeight;
    const bgColor = lyricsSettings.lyricsBgColor;
    const { r, g, b } = hexToRgb(bgColor);

    drawContext.save();

    if (!lyricsSettings.lyricsResourceBackground) {
        drawContext.fillStyle = bgColor;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
        drawContext.restore();

        return;
    }

    drawResourceCover(drawContext, lyricsSettings.lyricsResourceBackground, canvasWidth, canvasHeight);
    drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, ${lyricsSettings.lyricsBackgroundCurrentOpacity})`;
    drawContext.fillRect(0, 0, canvasWidth, canvasHeight);

    if (lyricsSettings.lyricsBackgroundCurrentOpacity < 0.3) {
        drawContext.fillStyle = `rgba(${r}, ${g}, ${b}, 0.1)`;
        drawContext.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    drawContext.restore();
};
