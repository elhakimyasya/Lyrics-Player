import { lyricsSettings } from './lyricsSettings';

const addTrackList = (targetStream, tracks) => {
    tracks.forEach((track) => targetStream.addTrack(track));
};

const createRecordingAudioStream = (audioElement) => {
    if (audioElement.captureStream) {
        return {
            stream: audioElement.captureStream(),
            cleanup: () => {},
        };
    }

    const audioContext = lyricsSettings.lyricsAudioContext || new (window.AudioContext || window.webkitAudioContext)();
    const source = lyricsSettings.lyricsAudioSource || audioContext.createMediaElementSource(audioElement);
    const destination = audioContext.createMediaStreamDestination();
    
    source.connect(destination);

    return {
        stream: destination.stream,
        cleanup: () => {
            try {
                source.disconnect(destination);
            } catch (error) {
                console.error('Failed to disconnect recording audio stream:', error);
            }
        },
    };
};

export const lyricsCreateRecordingStream = (canvasElement, audioElement) => {
    const videoStream = canvasElement.captureStream(lyricsSettings.lyricsFramesPerSecond);
    const audioStream = createRecordingAudioStream(audioElement);
    const combinedStream = new MediaStream();

    addTrackList(combinedStream, videoStream.getVideoTracks());
    addTrackList(combinedStream, audioStream.stream.getAudioTracks());

    return {
        stream: combinedStream,
        cleanup: () => {
            combinedStream.getTracks().forEach((track) => track.stop());
            audioStream.cleanup();
        },
    };
};
