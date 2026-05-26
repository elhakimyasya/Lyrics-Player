import { lyricsSettings } from './lyricsSettings';

export const lyricsParse = (text) => {
    const lyricOutput = [];
    const lyricTimestamp = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const raw of text.split(/\r?\n/)) {
        const lyricLine = raw.trim();
        if (!lyricLine) {
            continue;
        }

        lyricTimestamp.lastIndex = 0;

        let lyricMinute;
        let lyricLastIndex = 0;

        const lyricTime = [];

        while ((lyricMinute = lyricTimestamp.exec(lyricLine)) !== null) {
            const timeMinute = parseInt(lyricMinute[1], lyricsSettings.lyricsNumberRadix);
            const timeSecond = parseInt(lyricMinute[2], lyricsSettings.lyricsNumberRadix);
            const timeMilisecond = lyricMinute[3] ? parseInt((lyricMinute[3] + lyricsSettings.lyricsTimestampMillisecondPadding).slice(0, lyricsSettings.lyricsTimestampMillisecondDigits), lyricsSettings.lyricsNumberRadix) : 0;

            lyricTime.push((timeMinute * lyricsSettings.lyricsSecondsPerMinute + timeSecond) * lyricsSettings.lyricsMillisecondsPerSecond + timeMilisecond);
            lyricLastIndex = lyricTimestamp.lastIndex;
        }

        const lyricContentRaw = lyricLine.slice(lyricLastIndex).trim();
        const lyricContent = lyricContentRaw.length ? lyricContentRaw.charAt(0).toUpperCase() + lyricContentRaw.slice(1) : lyricContentRaw;

        if (lyricTime.length) {
            for (const t of lyricTime) {
                lyricOutput.push({
                    timeMs: t,
                    text: lyricContent,
                });
            }
        }
    }

    lyricOutput.sort((a, b) => a.timeMs - b.timeMs);

    return lyricOutput;
};
