import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderPreviewFrameWhenIdle } from './lyricsCanvasRender';
import { lyricsStartRecording } from './lyricsRecorder';

const toggleFullscreen = (canvasElement) => {
    if (!document.fullscreenElement) {
        canvasElement.requestFullscreen().catch(console.error);
        
        return;
    }

    document.exitFullscreen();
};

export const lyricsBindControlEvents = (dom) => {
    dom.buttonFullscreen.addEventListener('click', () => {
        toggleFullscreen(dom.canvasPreview);
    });

    dom.buttonExport.addEventListener('click', () => {
        lyricsStartRecording({
            audioElement: dom.audioPlayer,
            buttonElement: dom.buttonExport,
        });
    });

    dom.inputSpectrum.addEventListener('change', (event) => {
        lyricsSettings.lyricsStateRenderSpectrum = event.target.checked;

        lyricsRenderPreviewFrameWhenIdle(dom.audioPlayer);
    });
};
