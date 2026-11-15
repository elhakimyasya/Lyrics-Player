import { lyricsSettings } from './lyricsSettings';
import { lyricsMediaEnsureAudioContextActive } from './lyricsMedia';
import { lyricsMediaGetAudioState } from './lyricsMedia';
import { lyricsRenderingCoreRender } from './lyricsRenderingCore';
import { lyricsRenderingEffectsRenderBackgroundIntro } from './lyricsRenderingEffects';
import { lyricsLoopsStartPreviewLoop, lyricsLoopsStopPreviewLoop } from './lyricsLoops';

let recordingIntroStop = null;

const recordingPrepareIntro = (recordingStream) => {
    const inputElement = document.querySelector(lyricsSettings.selectors.elementInput.intro);
    const introFile = inputElement?.files?.[0];
    if (!introFile) return null;

    const introUrl = URL.createObjectURL(introFile);
    const introIsVideo = introFile.type.startsWith('video/');
    const introElement = document.createElement(introIsVideo ? 'video' : 'audio');
    introElement.src = introUrl;
    introElement.preload = 'auto';
    introElement.playsInline = true;
    recordingStream.addAudioElement(introElement);
    if (introIsVideo) {
        // Keep the media element audible to its Web Audio source, but do not attach it to speakers.
        introElement.muted = false;
        Object.assign(introElement.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', objectFit: 'contain', zIndex: '20', opacity: '1', transition: 'opacity 500ms ease' });
        document.body.appendChild(introElement);
    }

    return { introElement, introUrl, introIsVideo };
};

const recordingMirrorPreview = (sourceCanvas, lastPreviewTime = 0, force = false) => {
    const previewCanvas = lyricsSettings.canvas.context?.canvas;
    if (!previewCanvas || (!force && performance.now() - lastPreviewTime < 100)) {
        return lastPreviewTime;
    }

    lyricsSettings.canvas.context.drawImage(sourceCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
    return performance.now();
};

const recordingPlayIntro = async (recordingStream, exportCanvas, exportContext, intro) => {
    if (!intro) return true;

    const { introElement, introUrl, introIsVideo } = intro;
    lyricsSettings.state.isRecordingIntro = true;
    lyricsSettings.state.recordingIntroType = introIsVideo ? 'video' : 'audio';
    lyricsSettings.state.backgroundOpacity = 0;
    lyricsSettings.state.overlayOpacity = 0;
    let introFrameRequestID = null;
    const stopIntroFrameTimer = () => {
        if (introFrameRequestID) {
            clearTimeout(introFrameRequestID);
            introFrameRequestID = null;
        }
    };
    try {
        recordingIntroStop = () => {
            introElement.pause();
            stopIntroFrameTimer();
            introElement.dispatchEvent(new Event('ended'));
        };
        let introLastFrameTime = performance.now();
        let lastPreviewMirrorTime = 0;
        const renderIntroFrame = () => {
            introFrameRequestID = null;
            const now = performance.now();
            const elapsedMilliseconds = now - introLastFrameTime;
            introLastFrameTime = now;
            if (introElement.tagName === 'VIDEO' && introElement.readyState >= 2) {
                exportContext.drawImage(introElement, 0, 0, exportContext.canvas.width, exportContext.canvas.height);
                lastPreviewMirrorTime = recordingMirrorPreview(exportCanvas, lastPreviewMirrorTime);
                recordingStream.requestVideoFrame();
            } else if (introElement.tagName === 'AUDIO') {
                lyricsSettings.state.backgroundOpacity = 0;
                lyricsRenderingCoreRender(0, exportContext);
                lastPreviewMirrorTime = recordingMirrorPreview(exportCanvas, lastPreviewMirrorTime);
                recordingStream.requestVideoFrame();
            }
            if (!introElement.ended && lyricsSettings.state.isRecording) {
                introFrameRequestID = setTimeout(renderIntroFrame, 1000 / lyricsSettings.canvas.framesPerSecond);
            }
        };
        if (!introIsVideo) {
            lyricsRenderingEffectsRenderBackgroundIntro(exportContext);
            lastPreviewMirrorTime = recordingMirrorPreview(exportCanvas, lastPreviewMirrorTime, true);
            recordingStream.requestVideoFrame();
        }
        await introElement.play();
        renderIntroFrame();
        await new Promise((resolve) => introElement.addEventListener('ended', resolve, { once: true }));
        if (introElement.tagName === 'VIDEO') {
            introElement.style.opacity = '0';
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
        return true;
    } finally {
        stopIntroFrameTimer();
        lyricsSettings.state.isRecordingIntro = false;
        lyricsSettings.state.recordingIntroType = null;
        lyricsSettings.state.backgroundOpacity = 0;
        lyricsSettings.state.overlayOpacity = 0;
        introElement.pause();
        introElement.remove();
        URL.revokeObjectURL(introUrl);
        recordingIntroStop = null;
    }
};

const recordingCreateAudioMediaStream = (audioElement) => {
    const audioContext = lyricsSettings.audio.context || new (window.AudioContext || window.webkitAudioContext)();
    const destination = audioContext.createMediaStreamDestination();
    const sources = [];
    const connectElement = (element) => {
        const source = element === audioElement && lyricsSettings.audio.source ? lyricsSettings.audio.source : audioContext.createMediaElementSource(element);
        source.connect(destination);
        // The intro must be monitored while recording as well as captured.
        if (element !== audioElement && element.tagName === 'AUDIO') {
            source.connect(audioContext.destination);
        }
        sources.push(source);
    };
    connectElement(audioElement);

    return {
        stream: destination.stream,
        addAudioElement: connectElement,
        cleanup: () => sources.forEach((source) => {
            try {
                source.disconnect(destination);
            } catch (errorEvent) {
                console.error(lyricsSettings.messages.recording.disconnectAudioStreamFailed, errorEvent);
            }
        }),
    };
};

export const lyricsRecordingStart = async ({ audioElement, buttonElement }) => {
    if (!audioElement.src) {
        alert(lyricsSettings.messages.missingAudio);

        return;
    }

    lyricsRecordingSetButtonState(buttonElement, true);

    lyricsLoopsStopPreviewLoop();
    lyricsSettings.state.isRecording = true;

    try {
        audioElement.pause();
        audioElement.currentTime = 0;
        await lyricsMediaGetAudioState(audioElement);
        await lyricsMediaEnsureAudioContextActive();

        const exportCanvas = lyricsRecordingCreateCanvas();
        const exportContext = exportCanvas.getContext('2d', { alpha: true });
        const recordingStream = lyricsRecordingCreateStream(exportCanvas, audioElement);
        const intro = recordingPrepareIntro(recordingStream);
        const mediaRecorder = lyricsRecordingCreateMediaRecorder(recordingStream.stream);
        const recordingChunks = [];

        lyricsSettings.state.recordingMediaRecorder = mediaRecorder;

        let recordingFrameTimeoutId = null;
        let lastPreviewMirrorTime = 0;

        const recordingFinishRecording = () => {
            if (recordingFrameTimeoutId) {
                clearTimeout(recordingFrameTimeoutId);
                recordingFrameTimeoutId = null;
            }

            lyricsRecordingDownload(recordingChunks);

            recordingStream.cleanup();
            lyricsSettings.state.recordingMediaRecorder = null;
            lyricsSettings.state.isRecording = false;
            lyricsSettings.state.recordingMainTransitionPending = false;

            audioElement.pause();
            audioElement.currentTime = 0;
            lyricsRecordingSetButtonState(buttonElement, false);
            lyricsRenderingCoreRender(0, lyricsSettings.canvas.context);
            lyricsLoopsStopPreviewLoop();
        };

        mediaRecorder.ondataavailable = (inputEvent) => {
            if (inputEvent.data.size) {
                recordingChunks.push(inputEvent.data);
            }
        };

        mediaRecorder.onstop = recordingFinishRecording;

        const frameIntervalMilliseconds = 1000 / lyricsSettings.canvas.framesPerSecond;

        const recordingRenderExportFrame = () => {
            if (!lyricsSettings.state.isRecording) {
                return;
            }

            lyricsRenderingCoreRender(audioElement.currentTime * 1000, exportContext);
            lastPreviewMirrorTime = recordingMirrorPreview(exportCanvas, lastPreviewMirrorTime);
            recordingStream.requestVideoFrame();

            if (audioElement.ended || audioElement.currentTime >= audioElement.duration - lyricsSettings.recording.stopOffsetSeconds) {
                lyricsRecordingStop();
                audioElement.pause();

                return;
            }

            recordingFrameTimeoutId = setTimeout(recordingRenderExportFrame, frameIntervalMilliseconds);
        };

        mediaRecorder.start(lyricsSettings.recording.chunkIntervalMilliseconds);

        await recordingPlayIntro(recordingStream, exportCanvas, exportContext, intro);
        // Keep the intro's visual state for the first main frame; subsequent frames use normal timing effects.
        // Overlay should start at 0 and fade in naturally with background
        lyricsSettings.state.overlayOpacity = 0;
        lyricsRenderingCoreRender(0, exportContext);
        lyricsSettings.state.recordingMainTransitionPending = false;
        recordingMirrorPreview(exportCanvas, 0, true);
        recordingStream.requestVideoFrame();
        if (!lyricsSettings.state.isRecording) {
            audioElement.pause();
            audioElement.currentTime = 0;
            if (mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
            return;
        }

        audioElement.currentTime = 0;
        await audioElement.play();

        recordingRenderExportFrame();
    } catch (errorEvent) {
        console.error(lyricsSettings.messages.recording.exportFailed, errorEvent);
        lyricsSettings.state.recordingMediaRecorder = null;
        lyricsSettings.state.isRecording = false;
        lyricsSettings.state.recordingMainTransitionPending = false;

        lyricsRecordingSetButtonState(buttonElement, false);

        if (audioElement.paused || audioElement.ended) {
            lyricsLoopsStopPreviewLoop();
        } else {
            lyricsLoopsStartPreviewLoop();
        }
    }
};

export const lyricsRecordingSetButtonState = (buttonElement, isRecording) => {
    buttonElement.disabled = false;
    buttonElement.classList.toggle('border-key', !isRecording);
    buttonElement.classList.toggle('bg-key', !isRecording);
    buttonElement.classList.toggle('border-red', isRecording);
    buttonElement.classList.toggle('bg-red', isRecording);
    buttonElement.textContent = isRecording ? lyricsSettings.recording.buttonText.active : lyricsSettings.recording.buttonText.idle;
};

export const lyricsRecordingStop = () => {
    if (recordingIntroStop) {
        recordingIntroStop();
        recordingIntroStop = null;
        lyricsSettings.state.isRecording = false;
        return;
    }

    const mediaRecorder = lyricsSettings.state.recordingMediaRecorder;

    if (!mediaRecorder || mediaRecorder.state !== 'recording') {
        return;
    }

    mediaRecorder.requestData();
    mediaRecorder.stop();
};

export const lyricsRecordingCreateCanvas = () => {
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = lyricsSettings.canvas.width;
    exportCanvas.height = lyricsSettings.canvas.height;

    return exportCanvas;
};

export const lyricsRecordingDownload = (recordingChunks) => {
    const finalBlob = new Blob(recordingChunks, {
        type: lyricsSettings.recording.mimeType,
    });

    const downloadUrl = URL.createObjectURL(finalBlob);
    const hiddenLink = document.createElement('a');

    hiddenLink.href = downloadUrl;
    hiddenLink.download = `${lyricsSettings.export.fileName}.${lyricsSettings.recording.fileExtension}`;
    hiddenLink.click();

    setTimeout(() => URL.revokeObjectURL(downloadUrl), lyricsSettings.recording.objectUrlRevokeDelayMilliseconds);
};

export const lyricsRecordingCreateMediaRecorder = (stream) => {
    const supportedMimeType = lyricsSettings.recording.mimeTypesWithCodecs.find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
    const recorderOptions = {
        videoBitsPerSecond: lyricsSettings.recording.videoBitsPerSecond,
        audioBitsPerSecond: lyricsSettings.recording.audioBitsPerSecond,
    };

    if (supportedMimeType) {
        recorderOptions.mimeType = supportedMimeType;
    }

    return new MediaRecorder(stream, recorderOptions);
};

export const lyricsRecordingCreateStream = (canvasElement, audioElement) => {
    // Firefox does not reliably implement manual requestFrame() capture. Use its
    // automatic capture mode so canvas updates continue producing video frames.
    const isFirefox = /Firefox\//.test(navigator.userAgent);
    // Firefox is more reliable with the browser's automatic capture cadence.
    // Other browsers use manual capture so each rendered frame is captured once.
    const manualCaptureFrameRate = lyricsSettings.recording.manualCaptureFrameRate;
    const videoStream = isFirefox
        ? canvasElement.captureStream()
        : canvasElement.captureStream(manualCaptureFrameRate);
    const [videoTrack] = videoStream.getVideoTracks();
    const audioStream = recordingCreateAudioMediaStream(audioElement);
    const combinedStream = new MediaStream();

    if (videoTrack) {
        videoTrack.contentHint = 'motion';

        if (typeof videoTrack.applyConstraints === 'function') {
            videoTrack
                .applyConstraints({
                    frameRate: {
                        ideal: lyricsSettings.canvas.framesPerSecond,
                        max: lyricsSettings.canvas.framesPerSecond,
                    },
                })
                .catch((errorEvent) => {
                    console.warn(lyricsSettings.messages.recording.videoConstraintsFailed, errorEvent);
                });
        }
    }

    videoStream.getVideoTracks().forEach((mediaTrack) => combinedStream.addTrack(mediaTrack));
    audioStream.stream.getAudioTracks().forEach((mediaTrack) => combinedStream.addTrack(mediaTrack));

    return {
        stream: combinedStream,
        addAudioElement: audioStream.addAudioElement,
        requestVideoFrame: () => {
            // Automatic capture handles Firefox; requestFrame remains useful for
            // Chrome's manual mode without making it a cross-browser requirement.
            if (!isFirefox && videoTrack && typeof videoTrack.requestFrame === 'function') {
                videoTrack.requestFrame();
            }
        },
        cleanup: () => {
            combinedStream.getTracks().forEach((mediaTrack) => mediaTrack.stop());
            audioStream.cleanup();
        },
    };
};
