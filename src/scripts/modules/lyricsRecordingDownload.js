import { lyricsSettings } from './lyricsSettings';

export const lyricsDownloadRecording = (recordingChunks) => {
    const finalBlob = new Blob(recordingChunks, { type: 'video/webm' });
    const downloadUrl = URL.createObjectURL(finalBlob);
    const hiddenLink = document.createElement('a');
    
    hiddenLink.href = downloadUrl;
    hiddenLink.download = `${lyricsSettings.lyricsExportFileName}.webm`;
    hiddenLink.click();

    setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
};
