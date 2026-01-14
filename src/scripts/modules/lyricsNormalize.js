export const lyricsNormalize = (lyricsRawText) => {
    if (!lyricsRawText) return '';

    let lyricsProcessed = lyricsRawText.normalize('NFC');

    // Hapus control characters kecuali line break
    lyricsProcessed = lyricsProcessed.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, '');
    // Hapus zero-width & formatting characters
    lyricsProcessed = lyricsProcessed.replace(/[\u200B-\u200D\uFEFF\u2060-\u206F]/g, '');

    const lyricsConfusableMap = {
        "е": "e", "Е": "E", "о": "o", "О": "O", "ӏ": "l", "І": "I", "ı": "i", "ѕ": "s",
        "ᴀ": "A", "ʙ": "B", "ᴄ": "C", "ᴇ": "E", "ɢ": "G", "ʜ": "H", "ɪ": "I", "ᴊ": "J",
        "ᴋ": "K", "ʟ": "L", "ᴍ": "M", "ɴ": "N", "ᴏ": "O", "ᴘ": "P", "ʀ": "R", "ᴛ": "T",
        "ᴜ": "U", "ᴡ": "W", "ʏ": "Y", "ᴢ": "Z", "∕": "/", "꞉": ":"
    };

    lyricsProcessed = lyricsProcessed.replace(/./g, char => lyricsConfusableMap[char] || char);

    return lyricsProcessed.split(/\r?\n/)
        .map(line => line.replace(/ +/g, ' ').trim())
        .join('\n');
};