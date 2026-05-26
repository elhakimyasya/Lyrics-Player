import { lyricsSettings } from './lyricsSettings';
import { lyricsEnsureAudioContextActive } from './lyricsAudioContext';
import { lyricsGetAudioState } from './lyricsGetAudioState';
import { lyricsRender } from './lyricsRender';
import { lyricsCreateRecordingCanvas } from './lyricsRecordingCanvas';
import { lyricsDownloadRecording } from './lyricsRecordingDownload';
import { lyricsCreateMediaRecorder } from './lyricsRecordingMediaRecorder';
import { lyricsCreateRecordingStream } from './lyricsRecordingStream';
import { lyricsSetRecordingButtonState } from './lyricsRecordingButton';
import { lyricsStartPreviewLoop, lyricsStopPreviewLoop } from './lyricsPreviewLoop';

export const lyricsStartRecording = async ({ audioElement, buttonElement }) => {
    if (!audioElement.src) {
        alert('Silakan masukkan file audio terlebih dahulu.');

        return;
    }

    lyricsSetRecordingButtonState(buttonElement, true);

    lyricsSettings.lyricsStateIsRecording = true;

    try {
        await lyricsGetAudioState(audioElement);
        await lyricsEnsureAudioContextActive();

        const exportCanvas = lyricsCreateRecordingCanvas();
        const exportContext = exportCanvas.getContext('2d', {
            alpha: true,
        });
        const recordingStream = lyricsCreateRecordingStream(exportCanvas, audioElement);
        const mediaRecorder = lyricsCreateMediaRecorder(recordingStream.stream);
        const recordingChunks = [];

        let recordingFrameId = null;

        const finishRecording = () => {
            if (recordingFrameId) {
                cancelAnimationFrame(recordingFrameId);
                recordingFrameId = null;
            }

            lyricsDownloadRecording(recordingChunks);

            recordingStream.cleanup();
            lyricsSettings.lyricsStateIsRecording = false;

            lyricsSetRecordingButtonState(buttonElement, false);
            lyricsRender(audioElement.currentTime * 1000, lyricsSettings.lyricsCanvasContext);

            if (audioElement.paused || audioElement.ended) {
                lyricsStopPreviewLoop();
            } else {
                lyricsStartPreviewLoop();
            }
        };

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size) {
                recordingChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = finishRecording;

        const renderExportFrame = () => {
            if (!lyricsSettings.lyricsStateIsRecording) {
                return;
            }

            lyricsRender(audioElement.currentTime * 1000, exportContext);

            if (audioElement.ended || audioElement.currentTime >= audioElement.duration - 0.05) {
                mediaRecorder.stop();
                audioElement.pause();

                return;
            }

            recordingFrameId = requestAnimationFrame(renderExportFrame);
        };

        mediaRecorder.start(1000);
        audioElement.currentTime = 0;

        await audioElement.play();

        renderExportFrame();
    } catch (error) {
        console.error('Export Error:', error);
        lyricsSettings.lyricsStateIsRecording = false;

        lyricsSetRecordingButtonState(buttonElement, false);

        if (audioElement.paused || audioElement.ended) {
            lyricsStopPreviewLoop();
        } else {
            lyricsStartPreviewLoop();
        }
    }
};
