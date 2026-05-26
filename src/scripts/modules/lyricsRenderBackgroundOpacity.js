import { lyricsSettings } from './lyricsSettings';

const getTargetOpacity = (lineState) => {
    if (!lineState.isEnding && !lineState.isCurrentInstrumental) {
        return 1;
    }

    if (!lineState.isNextInstrumental && lineState.textNextRaw.trim() !== '' && lineState.timeUntilNextLine < 1000) {
        return 1;
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
