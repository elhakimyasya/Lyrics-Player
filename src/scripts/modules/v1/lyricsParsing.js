import { lyricsSettings } from './lyricsCore';

export const lyricsParsingParse = (text) => {
    const lyricOutput = [];
    const lyricTimestamp = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const rawLine of text.split(/\r?\n/)) {
        const lyricLine = rawLine.trim();
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
            for (const timestamp of lyricTime) {
                lyricOutput.push({
                    timeMs: timestamp,
                    text: lyricContent,
                });
            }
        }
    }

    lyricOutput.sort((a, b) => a.timeMs - b.timeMs);

    return lyricOutput;
};

export const lyricsParsingNormalize = (lyricsRawText) => {
    if (!lyricsRawText) return '';

    let lyricsProcessed = lyricsRawText.normalize('NFC');

    // Hapus control characters kecuali line break
    lyricsProcessed = lyricsProcessed.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    // Hapus zero-width & formatting characters
    lyricsProcessed = lyricsProcessed.replace(/[\u200B-\u200D\uFEFF\u2060-\u206F]/g, '');

    const lyricsConfusableMap = {
        '\u0435': 'e',
        '\u0415': 'E',
        '\u043e': 'o',
        '\u041e': 'O',
        '\u04cf': 'l',
        '\u0406': 'I',
        '\u0131': 'i',
        '\u0455': 's',
    };

    lyricsProcessed = lyricsProcessed.replace(/./g, (character) => lyricsConfusableMap[character] || character);

    return lyricsProcessed
        .split(/\r?\n/)
        .map((line) => line.replace(/ +/g, ' ').trim())
        .join('\n');
};
