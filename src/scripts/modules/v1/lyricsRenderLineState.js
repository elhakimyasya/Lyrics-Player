import { lyricsSettings } from './lyricsSettings';

const findActiveLineIndex = (adjustedRenderTime) => {
    let activeLineIndex = -1;
    const totalLines = lyricsSettings.lyricsDataParsed.length;

    for (let index = 0; index < totalLines; index++) {
        if (lyricsSettings.lyricsDataParsed[index].timeMs <= adjustedRenderTime) {
            activeLineIndex = index;
        } else {
            break;
        }
    }

    if (activeLineIndex < 0 && totalLines > 0) {
        return 0;
    }

    return activeLineIndex;
};

const getLineTexts = (activeLineIndex, totalLines) => {
    const textActiveRaw = activeLineIndex >= 0 ? lyricsSettings.lyricsDataParsed[activeLineIndex]?.text || '' : '';
    const textNextRaw = activeLineIndex + 1 < totalLines ? lyricsSettings.lyricsDataParsed[activeLineIndex + 1].text || '' : '';
    const textPreviousRaw = activeLineIndex > 0 ? lyricsSettings.lyricsDataParsed[activeLineIndex - 1].text : '';

    const isCurrentInstrumental = textActiveRaw.includes(lyricsSettings.lyricsInstrumentalSymbol);
    const isNextInstrumental = textNextRaw.includes(lyricsSettings.lyricsInstrumentalSymbol);
    const isPreviousInstrumental = textPreviousRaw.includes(lyricsSettings.lyricsInstrumentalSymbol);

    return {
        textActiveRaw,
        textNextRaw,
        textPreviousRaw,
        textActive: isCurrentInstrumental ? '' : textActiveRaw,
        textNext: isNextInstrumental ? '' : textNextRaw,
        textPrevious: isPreviousInstrumental ? '' : textPreviousRaw,
        isCurrentInstrumental,
        isNextInstrumental,
        isPreviousInstrumental,
    };
};

export const lyricsGetRenderLineState = (adjustedRenderTime, audioElement) => {
    const totalLines = lyricsSettings.lyricsDataParsed.length;
    const activeLineIndex = findActiveLineIndex(adjustedRenderTime);
    const currentLineStart = totalLines > 0 ? lyricsSettings.lyricsDataParsed[activeLineIndex].timeMs : 0;
    const currentLineEnd = activeLineIndex + 1 < totalLines ? lyricsSettings.lyricsDataParsed[activeLineIndex + 1].timeMs : audioElement.duration * lyricsSettings.lyricsMillisecondsPerSecond;
    const timeUntilNextLine = currentLineEnd - adjustedRenderTime;
    const lineTexts = getLineTexts(activeLineIndex, totalLines);
    const isEnding = activeLineIndex >= totalLines - 2 && lineTexts.textActiveRaw.trim() === '' && lineTexts.textNextRaw.trim() === '';

    return {
        ...lineTexts,
        activeLineIndex,
        totalLines,
        currentLineStart,
        currentLineEnd,
        timeUntilNextLine,
        isEnding,
    };
};
