import { lyricsSettings } from './lyricsSettings';

const getTargetOpacity = (lineState) => {
    if (!lineState.isEnding && !lineState.isCurrentInstrumental) {
        return lyricsSettings.lyricsBackgroundMaxOpacity;
    }

    if (!lineState.isNextInstrumental && lineState.textNextRaw.trim() !== '' && lineState.timeUntilNextLine < lyricsSettings.lyricsBackgroundNextLinePreloadMs) {
        return lyricsSettings.lyricsBackgroundMaxOpacity;
    }

    return 0;
};

export const lyricsUpdateBackgroundOpacity = (lineState) => {
    const targetOpacity = getTargetOpacity(lineState);

    if (lyricsSettings.lyricsBackgroundCurrentOpacity > targetOpacity) {
        lyricsSettings.lyricsBackgroundCurrentOpacity = Math.max(targetOpacity, lyricsSettings.lyricsBackgroundCurrentOpacity - lyricsSettings.lyricsFadeSpeed);

        return;
    }

    if (lyricsSettings.lyricsBackgroundCurrentOpacity < targetOpacity) {
        lyricsSettings.lyricsBackgroundCurrentOpacity = Math.min(targetOpacity, lyricsSettings.lyricsBackgroundCurrentOpacity + lyricsSettings.lyricsFadeSpeed);
    }
};
