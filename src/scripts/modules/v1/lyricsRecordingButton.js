import { lyricsSettings } from './lyricsSettings';

export const lyricsSetRecordingButtonState = (buttonElement, isRecording) => {
    buttonElement.disabled = isRecording;
    buttonElement.textContent = isRecording ? lyricsSettings.lyricsRecordingButtonText.active : lyricsSettings.lyricsRecordingButtonText.idle;
};
