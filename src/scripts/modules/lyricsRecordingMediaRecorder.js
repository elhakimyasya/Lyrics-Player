export const lyricsCreateMediaRecorder = (stream) => {
    const recorderOptions = {
        mimeType: 'video/webm;codecs=vp9,opus',
    };
    
    const supportedOptions = MediaRecorder.isTypeSupported(recorderOptions.mimeType) ? recorderOptions : {};

    return new MediaRecorder(stream, supportedOptions);
};
