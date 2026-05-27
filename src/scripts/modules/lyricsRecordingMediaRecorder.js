import { lyricsSettings } from './lyricsSettings';

const getSupportedMimeType = () => lyricsSettings.lyricsRecordingMimeTypesWithCodecs.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));

export const lyricsCreateMediaRecorder = (stream) => {
    const supportedMimeType = getSupportedMimeType();
    const recorderOptions = {
        videoBitsPerSecond: lyricsSettings.lyricsRecordingVideoBitsPerSecond,
        audioBitsPerSecond: lyricsSettings.lyricsRecordingAudioBitsPerSecond,
    };

    if (supportedMimeType) {
        recorderOptions.mimeType = supportedMimeType;
    }

    return new MediaRecorder(stream, recorderOptions);
};
