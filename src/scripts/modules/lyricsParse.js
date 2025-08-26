export const lyricsParse = (text) => {
    const lyricOutput = [];
    const lyricTimestamp = /\[(\d{1,2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

    for (const raw of text.split(/\r?\n/)) {
        const lyricLine = raw.trim();
        if (!lyricLine) continue;

        lyricTimestamp.lastIndex = 0;
        let lyricMinute;
        let lyricLastIndex = 0;
        const lyricTime = [];

        while ((lyricMinute = lyricTimestamp.exec(lyricLine)) !== null) {
            const timeMinute = parseInt(lyricMinute[1], 10);
            const timeSecond = parseInt(lyricMinute[2], 10);
            const timeMilisecond = lyricMinute[3] ? parseInt((lyricMinute[3] + '00').slice(0, 3), 10) : 0;
            lyricTime.push(((timeMinute * 60) + timeSecond) * 1000 + timeMilisecond);
            lyricLastIndex = lyricTimestamp.lastIndex;
        }

        const lyricContentRaw = lyricLine.slice(lyricLastIndex).trim();
        const lyricContent = lyricContentRaw.length
            ? lyricContentRaw.charAt(0).toUpperCase() + lyricContentRaw.slice(1)
            : lyricContentRaw;

        if (lyricTime.length) {
            for (const t of lyricTime) {
                lyricOutput.push({
                    timeMs: t,
                    text: lyricContent
                });
            }
        }
    }

    lyricOutput.sort((a, b) => a.timeMs - b.timeMs);

    return lyricOutput;
}
