import { lyricsSettings } from './lyricsSettings';

export const lyricsDownloadRecording = (recordingChunks) => {
    const finalBlob = new Blob(recordingChunks, {
        type: lyricsSettings.lyricsRecordingMimeType,
    });

    const downloadUrl = URL.createObjectURL(finalBlob);
    const hiddenLink = document.createElement('a');

    hiddenLink.href = downloadUrl;
    hiddenLink.download = `${lyricsSettings.lyricsExportFileName}.${lyricsSettings.lyricsRecordingFileExtension}`;
    hiddenLink.click();

    setTimeout(() => URL.revokeObjectURL(downloadUrl), lyricsSettings.lyricsRecordingObjectUrlRevokeDelayMs);
};
