import { lyricsSettings } from './lyricsSettings';

export const lyricsCreateMediaRecorder = (stream) => {
    const recorderOptions = {
        mimeType: lyricsSettings.lyricsRecordingMimeTypeWithCodecs,
    };

    const supportedOptions = MediaRecorder.isTypeSupported(recorderOptions.mimeType) ? recorderOptions : {};

    return new MediaRecorder(stream, supportedOptions);
};
