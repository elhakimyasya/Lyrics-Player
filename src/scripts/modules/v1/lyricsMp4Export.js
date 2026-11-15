import { lyricsSettings } from './lyricsSettings';
import { lyricsMediaGetAudioState } from './lyricsMedia';
import { lyricsLoopsRenderPreviewFrame, lyricsLoopsStopPreviewLoop } from './lyricsLoops';
import { Mp4Muxer } from './lyricsMp4Muxer';
import { lyricsRenderingCoreRender } from './lyricsRenderingCore';

const { video: VIDEO_EXPORT, audio: AUDIO_EXPORT, muxer: MUXER_EXPORT, timing: EXPORT_TIMING, blobChunkSize, filePicker, wakeLockType } = lyricsSettings.mp4Export;
const SPECTRUM = lyricsSettings.spectrum;
const EXPORT_SELECTORS = lyricsSettings.selectors.mp4Export;
const MESSAGES = lyricsSettings.messages;
const EXPORT_UI = MESSAGES.mp4Export;

const EXPORT_CANCELLED = new Error(EXPORT_UI.exportCancelled);
const exportControl = { isCancelRequested: false, wakeLock: null, cancelWorker: null };
const yieldChannel = new MessageChannel();
let exportInProgress = false;

const exportUi = {
    overlay: () => document.querySelector(EXPORT_SELECTORS.overlay),
    title: () => document.querySelector(EXPORT_SELECTORS.title),
    status: () => document.querySelector(EXPORT_SELECTORS.status),
    progressBar: () => document.querySelector(EXPORT_SELECTORS.progressBar),
    cancelButton: () => document.querySelector(EXPORT_SELECTORS.cancelButton),
};

const waitMilliseconds = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const yieldToBrowser = () => new Promise((resolve) => {
    yieldChannel.port1.onmessage = () => resolve();
    yieldChannel.port2.postMessage(0);
});

const updateExportUi = (statusText, progressRatio) => {
    exportUi.status().style.whiteSpace = 'pre-line';
    exportUi.status().textContent = statusText;
    if (progressRatio !== undefined) {
        exportUi.progressBar().style.width = `${(progressRatio * 100).toFixed(1)}%`;
    }
};

const throwIfExportCancelled = () => {
    if (exportControl.isCancelRequested) throw EXPORT_CANCELLED;
};

const setExportButtonState = (buttonElement, isExporting) => {
    buttonElement.disabled = isExporting;
    buttonElement.classList.toggle('border-emerald', !isExporting);
    buttonElement.classList.toggle('bg-emerald', !isExporting);
    buttonElement.classList.toggle('border-red', isExporting);
    buttonElement.classList.toggle('bg-red', isExporting);
    buttonElement.textContent = isExporting ? EXPORT_UI.buttonActive : EXPORT_UI.buttonIdle;
};

const getTextareaLines = (selector) => {
    const element = document.querySelector(selector);
    return element?.value.trim() ? element.value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
};

const loadVideoElement = (videoUrl) => new Promise((resolve, reject) => {
    const videoElement = document.createElement('video');
    videoElement.muted = true;
    videoElement.playsInline = true;
    videoElement.preload = 'auto';
    videoElement.onloadeddata = () => resolve(videoElement);
    videoElement.onerror = () => reject(new Error(EXPORT_UI.videoLoadError));
    videoElement.src = videoUrl;
    videoElement.load();
});

const seekVideoToTime = (videoElement, targetSeconds) => new Promise((resolve, reject) => {
    if (Math.abs(videoElement.currentTime - targetSeconds) < EXPORT_TIMING.seekToleranceSeconds) {
        resolve();
        return;
    }

    let isResolved = false;
    const finish = (error) => {
        if (isResolved) return;
        isResolved = true;
        clearTimeout(timeoutId);
        videoElement.removeEventListener('seeked', handleSeeked);
        videoElement.removeEventListener('error', handleError);
        if (error) reject(error);
        else resolve();
    };
    const handleSeeked = () => finish();
    const handleError = () => finish(new Error(EXPORT_UI.videoSeekError));
    const timeoutId = setTimeout(() => finish(new Error(EXPORT_UI.videoSeekTimeout)), EXPORT_TIMING.seekTimeoutMs);
    videoElement.addEventListener('seeked', handleSeeked, { once: true });
    videoElement.addEventListener('error', handleError, { once: true });
    videoElement.currentTime = targetSeconds;
});

const decodeAudioFile = async (audioFile) => {
    const decodingContext = new OfflineAudioContext(AUDIO_EXPORT.numberOfChannels, AUDIO_EXPORT.decodeLength, AUDIO_EXPORT.sampleRate);
    return decodingContext.decodeAudioData(await audioFile.arrayBuffer());
};

const spectrumWorkerSource = () => {
    self.onmessage = (event) => {
        const {
            monoSamples,
            sampleRate,
            framesPerSecond,
            fftSize,
            smoothingFactor,
            bassFilterFrequency,
            bassFilterGainDecibels,
            minimumDecibels,
            maximumDecibels,
            progressFrameInterval,
        } = event.data;
        const binCount = fftSize / 2;
        const totalFrames = Math.ceil((monoSamples.length / sampleRate) * framesPerSecond);
        const outputFrames = new Uint8Array(totalFrames * binCount);
        const windowCoefficients = new Float32Array(fftSize);
        const cosineTable = new Float32Array(binCount);
        const sineTable = new Float32Array(binCount);
        const bitReversalTable = new Uint16Array(fftSize);
        const bitCount = Math.log2(fftSize);

        for (let index = 0; index < fftSize; index++) {
            windowCoefficients[index] = 0.42 - 0.5 * Math.cos((2 * Math.PI * index) / fftSize) + 0.08 * Math.cos((4 * Math.PI * index) / fftSize);
        }
        for (let index = 0; index < binCount; index++) {
            cosineTable[index] = Math.cos((2 * Math.PI * index) / fftSize);
            sineTable[index] = -Math.sin((2 * Math.PI * index) / fftSize);
        }
        for (let index = 0; index < fftSize; index++) {
            let reversed = 0;
            let remaining = index;
            for (let bit = 0; bit < bitCount; bit++) {
                reversed = (reversed << 1) | (remaining & 1);
                remaining >>= 1;
            }
            bitReversalTable[index] = reversed;
        }

        const gainAmplitude = Math.pow(10, bassFilterGainDecibels / 40);
        const angularFrequency = (2 * Math.PI * bassFilterFrequency) / sampleRate;
        const cosineOmega = Math.cos(angularFrequency);
        const alpha = (Math.sin(angularFrequency) / 2) * Math.SQRT2;
        const sqrtTerm = 2 * Math.sqrt(gainAmplitude) * alpha;
        const a0 = gainAmplitude + 1 + (gainAmplitude - 1) * cosineOmega + sqrtTerm;
        const b0 = (gainAmplitude * (gainAmplitude + 1 - (gainAmplitude - 1) * cosineOmega + sqrtTerm)) / a0;
        const b1 = (2 * gainAmplitude * (gainAmplitude - 1 - (gainAmplitude + 1) * cosineOmega)) / a0;
        const b2 = (gainAmplitude * (gainAmplitude + 1 - (gainAmplitude - 1) * cosineOmega - sqrtTerm)) / a0;
        const a1 = (-2 * (gainAmplitude - 1 + (gainAmplitude + 1) * cosineOmega)) / a0;
        const a2 = (gainAmplitude + 1 + (gainAmplitude - 1) * cosineOmega - sqrtTerm) / a0;
        let filterState1 = 0;
        let filterState2 = 0;
        for (let index = 0; index < monoSamples.length; index++) {
            const input = monoSamples[index];
            const output = b0 * input + filterState1;
            filterState1 = b1 * input - a1 * output + filterState2;
            filterState2 = b2 * input - a2 * output;
            monoSamples[index] = output;
        }

        const realParts = new Float32Array(fftSize);
        const imaginaryParts = new Float32Array(fftSize);
        const smoothedMagnitudes = new Float32Array(binCount);
        const decibelRange = maximumDecibels - minimumDecibels;

        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            const windowEnd = Math.round((frameIndex * sampleRate) / framesPerSecond);
            const windowStart = windowEnd - fftSize;
            for (let index = 0; index < fftSize; index++) {
                const sampleIndex = windowStart + index;
                const sample = sampleIndex >= 0 && sampleIndex < monoSamples.length ? monoSamples[sampleIndex] : 0;
                realParts[bitReversalTable[index]] = sample * windowCoefficients[index];
                imaginaryParts[bitReversalTable[index]] = 0;
            }

            for (let blockSize = 2; blockSize <= fftSize; blockSize <<= 1) {
                const halfBlock = blockSize >> 1;
                const tableStep = fftSize / blockSize;
                for (let blockStart = 0; blockStart < fftSize; blockStart += blockSize) {
                    for (let offset = 0, tableIndex = 0; offset < halfBlock; offset++, tableIndex += tableStep) {
                        const upperIndex = blockStart + offset;
                        const lowerIndex = upperIndex + halfBlock;
                        const twiddleReal = cosineTable[tableIndex];
                        const twiddleImaginary = sineTable[tableIndex];
                        const productReal = realParts[lowerIndex] * twiddleReal - imaginaryParts[lowerIndex] * twiddleImaginary;
                        const productImaginary = realParts[lowerIndex] * twiddleImaginary + imaginaryParts[lowerIndex] * twiddleReal;
                        realParts[lowerIndex] = realParts[upperIndex] - productReal;
                        imaginaryParts[lowerIndex] = imaginaryParts[upperIndex] - productImaginary;
                        realParts[upperIndex] += productReal;
                        imaginaryParts[upperIndex] += productImaginary;
                    }
                }
            }

            const outputOffset = frameIndex * binCount;
            for (let binIndex = 0; binIndex < binCount; binIndex++) {
                const magnitude = Math.sqrt(realParts[binIndex] ** 2 + imaginaryParts[binIndex] ** 2) / fftSize;
                smoothedMagnitudes[binIndex] = smoothingFactor * smoothedMagnitudes[binIndex] + (1 - smoothingFactor) * magnitude;
                const decibels = 20 * Math.log10(smoothedMagnitudes[binIndex] + 1e-12);
                const byteValue = Math.floor((255 * (decibels - minimumDecibels)) / decibelRange);
                outputFrames[outputOffset + binIndex] = Math.max(0, Math.min(255, byteValue));
            }

            if (frameIndex % progressFrameInterval === 0) self.postMessage({ progressRatio: frameIndex / totalFrames });
        }

        self.postMessage({ isDone: true, outputFrames, totalFrames }, [outputFrames.buffer]);
    };
};

const analyzeSpectrum = async (audioBuffer, reportProgress) => {
    const leftChannel = audioBuffer.getChannelData(0);
    const rightChannel = audioBuffer.numberOfChannels > 1 ? audioBuffer.getChannelData(1) : leftChannel;
    const monoSamples = new Float32Array(audioBuffer.length);
    for (let index = 0; index < audioBuffer.length; index++) {
        monoSamples[index] = (leftChannel[index] + rightChannel[index]) * 0.5;
    }

    const workerUrl = URL.createObjectURL(new Blob([`(${spectrumWorkerSource.toString()})()`], { type: 'text/javascript' }));
    const worker = new Worker(workerUrl);
    let rejectCancellation;
    exportControl.cancelWorker = () => {
        worker.terminate();
        rejectCancellation(EXPORT_CANCELLED);
    };

    try {
        return await new Promise((resolve, reject) => {
            rejectCancellation = reject;
            worker.onmessage = (event) => {
                if (event.data.isDone) resolve(event.data);
                else reportProgress(event.data.progressRatio);
            };
            worker.onerror = (errorEvent) => reject(new Error(errorEvent.message || EXPORT_UI.analysisError));
            worker.postMessage({
                monoSamples,
                sampleRate: AUDIO_EXPORT.sampleRate,
                framesPerSecond: VIDEO_EXPORT.framesPerSecond,
                fftSize: SPECTRUM.fftSize,
                smoothingFactor: SPECTRUM.smoothingFactor,
                bassFilterFrequency: SPECTRUM.bassFilterFrequency,
                bassFilterGainDecibels: SPECTRUM.bassFilterGainDecibels,
                minimumDecibels: SPECTRUM.minimumDecibels,
                maximumDecibels: SPECTRUM.maximumDecibels,
                progressFrameInterval: EXPORT_TIMING.spectrumProgressFrameInterval,
            }, [monoSamples.buffer]);
        });
    } finally {
        exportControl.cancelWorker = null;
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
    }
};

const findAudioEncoderConfig = async () => {
    for (const candidate of AUDIO_EXPORT.encoderCandidates) {
        const config = {
            codec: candidate.encoderCodec,
            sampleRate: AUDIO_EXPORT.sampleRate,
            numberOfChannels: AUDIO_EXPORT.numberOfChannels,
            bitrate: AUDIO_EXPORT.bitsPerSecond,
        };
        try {
            const support = await AudioEncoder.isConfigSupported(config);
            if (support.supported) return { encoderConfig: support.config, muxerCodec: candidate.muxerCodec };
        } catch (error) {
            console.warn(EXPORT_UI.audioEncoderUnavailable.replace('{codec}', candidate.encoderCodec), error);
        }
    }
    throw new Error(EXPORT_UI.noAudioEncoder);
};

const copySamplesInto = (destination, destinationOffset, source, sourceStart, sampleCount) => {
    if (!source || sampleCount <= 0) return;
    const clampedStart = Math.max(0, sourceStart);
    const clampedEnd = Math.min(source.length, sourceStart + sampleCount);
    if (clampedEnd > clampedStart) {
        destination.set(source.subarray(clampedStart, clampedEnd), destinationOffset + (clampedStart - sourceStart));
    }
};

const encodeAudioTrack = async (exportInputs, reportProgress) => {
    const { encoderConfig, muxerCodec } = await findAudioEncoderConfig();
    const introSampleCount = Math.round(exportInputs.introDurationSeconds * AUDIO_EXPORT.sampleRate);
    const totalSampleCount = introSampleCount + exportInputs.mainLeftChannel.length;
    const encodedChunks = [];
    let encoderError = null;
    let isFirstChunk = true;
    const audioEncoder = new AudioEncoder({
        output: (chunk, metadata) => {
            encodedChunks.push({ chunk, metadata: isFirstChunk ? metadata : undefined });
            isFirstChunk = false;
        },
        error: (error) => {
            encoderError = error;
        },
    });
    audioEncoder.configure(encoderConfig);

    try {
        for (let startSample = 0; startSample < totalSampleCount; startSample += AUDIO_EXPORT.framesPerChunk) {
            throwIfExportCancelled();
            if (encoderError) throw encoderError;
            const framesInChunk = Math.min(AUDIO_EXPORT.framesPerChunk, totalSampleCount - startSample);
            const planarSamples = new Float32Array(framesInChunk * AUDIO_EXPORT.numberOfChannels);
            const rightChannelOffset = framesInChunk * (AUDIO_EXPORT.numberOfChannels - 1);
            const introFrames = Math.max(0, Math.min(framesInChunk, introSampleCount - startSample));
            if (introFrames > 0) {
                copySamplesInto(planarSamples, 0, exportInputs.introLeftChannel, startSample, introFrames);
                copySamplesInto(planarSamples, rightChannelOffset, exportInputs.introRightChannel || exportInputs.introLeftChannel, startSample, introFrames);
            }
            const mainFrames = framesInChunk - introFrames;
            if (mainFrames > 0) {
                const mainStartSample = Math.max(0, startSample - introSampleCount);
                copySamplesInto(planarSamples, introFrames, exportInputs.mainLeftChannel, mainStartSample, mainFrames);
                copySamplesInto(planarSamples, rightChannelOffset + introFrames, exportInputs.mainRightChannel || exportInputs.mainLeftChannel, mainStartSample, mainFrames);
            }

            const audioData = new AudioData({
                format: AUDIO_EXPORT.format,
                sampleRate: AUDIO_EXPORT.sampleRate,
                numberOfFrames: framesInChunk,
                numberOfChannels: AUDIO_EXPORT.numberOfChannels,
                timestamp: Math.round((startSample * 1e6) / AUDIO_EXPORT.sampleRate),
                data: planarSamples,
            });
            try {
                audioEncoder.encode(audioData);
            } finally {
                audioData.close();
            }

            while (audioEncoder.encodeQueueSize > AUDIO_EXPORT.maximumPendingChunks) {
                throwIfExportCancelled();
                if (encoderError) throw encoderError;
                await waitMilliseconds(EXPORT_TIMING.backpressurePollMs);
            }
            if ((startSample / AUDIO_EXPORT.framesPerChunk) % EXPORT_TIMING.audioProgressChunkInterval === 0) {
                reportProgress(startSample / totalSampleCount);
                await yieldToBrowser();
            }
        }
        await audioEncoder.flush();
    } finally {
        if (audioEncoder.state !== 'closed') audioEncoder.close();
    }
    if (encoderError) throw encoderError;
    return { chunks: encodedChunks, muxerCodec };
};

const findVideoEncoderCandidates = async () => {
    const candidates = [];
    for (const mode of VIDEO_EXPORT.encoderModes) {
        for (const codecString of VIDEO_EXPORT.h264CodecStrings) {
            const config = {
                codec: codecString,
                width: VIDEO_EXPORT.width,
                height: VIDEO_EXPORT.height,
                bitrate: VIDEO_EXPORT.bitsPerSecond,
                framerate: VIDEO_EXPORT.framesPerSecond,
                hardwareAcceleration: mode.hardwareAcceleration,
                latencyMode: VIDEO_EXPORT.latencyMode,
                bitrateMode: VIDEO_EXPORT.bitrateMode,
                avc: { format: VIDEO_EXPORT.codecFormat },
            };
            try {
                const support = await VideoEncoder.isConfigSupported(config);
                if (support.supported) candidates.push({ config: support.config, label: `H.264 ${mode.label} (${codecString})` });
            } catch (error) {
                console.warn(EXPORT_UI.videoEncoderUnavailable.replace('{label}', `${mode.label} (${codecString})`), error);
            }
        }
    }
    if (!candidates.length) throw new Error(EXPORT_UI.noVideoEncoder);
    return candidates;
};

const createBlobStreamTarget = () => {
    let assembledBlob = new Blob([]);
    let writtenEndPosition = 0;
    const target = new Mp4Muxer.StreamTarget({
        chunked: true,
        chunkSize: blobChunkSize,
        onData: (data, position) => {
            const dataBytes = new Uint8Array(data);
            const dataBlob = new Blob([dataBytes]);
            if (position >= writtenEndPosition) {
                if (position > writtenEndPosition) assembledBlob = new Blob([assembledBlob, new Uint8Array(position - writtenEndPosition)]);
                assembledBlob = new Blob([assembledBlob, dataBlob]);
                writtenEndPosition = position + dataBytes.length;
            } else {
                const afterStart = Math.min(writtenEndPosition, position + dataBytes.length);
                assembledBlob = new Blob([assembledBlob.slice(0, position), dataBlob, assembledBlob.slice(afterStart)]);
                writtenEndPosition = Math.max(writtenEndPosition, position + dataBytes.length);
            }
        },
    });
    return { target, getBlob: () => new Blob([assembledBlob], { type: MUXER_EXPORT.mimeType }) };
};

const downloadBlob = (blob, fileName) => {
    const objectUrl = URL.createObjectURL(blob);
    const linkElement = document.createElement('a');
    linkElement.href = objectUrl;
    linkElement.download = fileName;
    linkElement.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), lyricsSettings.recording.objectUrlRevokeDelayMilliseconds);
};

const drawMediaCover = (context, videoElement) => {
    const videoWidth = videoElement.videoWidth;
    const videoHeight = videoElement.videoHeight;
    if (!videoWidth || !videoHeight) return;
    const scale = Math.max(VIDEO_EXPORT.width / videoWidth, VIDEO_EXPORT.height / videoHeight);
    const width = videoWidth * scale;
    const height = videoHeight * scale;
    context.drawImage(videoElement, (VIDEO_EXPORT.width - width) / 2, (VIDEO_EXPORT.height - height) / 2, width, height);
};

const createBlobFromAudioElement = async (audioElement) => {
    const audioFile = document.querySelector(lyricsSettings.selectors.elementInput.audio)?.files?.[0];
    if (audioFile) return audioFile;
    const sourceUrl = audioElement.currentSrc || audioElement.src;
    if (!sourceUrl) throw new Error(MESSAGES.missingAudio);
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(EXPORT_UI.audioFileLoadFailed.replace('{status}', response.status));
    return response.blob();
};

const collectExportInputs = async (audioElement) => {
    const mainAudioBlob = await createBlobFromAudioElement(audioElement);
    const decodedMainBuffer = await decodeAudioFile(mainAudioBlob);
    const mainLeftChannel = decodedMainBuffer.getChannelData(0);
    const mainRightChannel = decodedMainBuffer.numberOfChannels > 1 ? decodedMainBuffer.getChannelData(1) : null;
    const exportInputs = {
        mainLeftChannel,
        mainRightChannel,
        introLeftChannel: null,
        introRightChannel: null,
        introDurationSeconds: 0,
        introUrl: null,
        isIntroVideo: false,
        backgroundUrl: null,
        isBackgroundVideo: false,
        staticBackground: lyricsSettings.state.backgroundResource,
        offsetSeconds: parseFloat(document.querySelector(lyricsSettings.selectors.elementInput.offset)?.value) || 0,
        headerLines: getTextareaLines(lyricsSettings.selectors.elementTextarea.header),
        footerLines: getTextareaLines(lyricsSettings.selectors.elementTextarea.footer),
        isSpectrumEnabled: lyricsSettings.state.renderSpectrum,
        frequencyFrames: null,
        spectrumFrameCount: 0,
        audioChunks: [],
        muxerAudioCodec: AUDIO_EXPORT.defaultMuxerCodec,
    };

    if (exportInputs.isSpectrumEnabled) {
        updateExportUi(`${EXPORT_UI.analyzingSpectrum}\n…`, 0);
        const spectrum = await analyzeSpectrum(decodedMainBuffer, (progressRatio) => {
            updateExportUi(`${EXPORT_UI.analyzingSpectrum}\n${Math.round(progressRatio * 100)}%`, progressRatio * EXPORT_TIMING.analysisProgressWeight);
        });
        exportInputs.frequencyFrames = spectrum.outputFrames;
        exportInputs.spectrumFrameCount = spectrum.totalFrames;
    }

    try {
        const introFile = document.querySelector(lyricsSettings.selectors.elementInput.intro)?.files?.[0];
        if (introFile) {
            exportInputs.isIntroVideo = introFile.type.startsWith('video/');
            if (exportInputs.isIntroVideo) exportInputs.introUrl = URL.createObjectURL(introFile);
            try {
                const decodedIntroBuffer = await decodeAudioFile(introFile);
                exportInputs.introLeftChannel = decodedIntroBuffer.getChannelData(0);
                exportInputs.introRightChannel = decodedIntroBuffer.numberOfChannels > 1 ? decodedIntroBuffer.getChannelData(1) : null;
                exportInputs.introDurationSeconds = decodedIntroBuffer.duration;
            } catch (error) {
                console.warn(EXPORT_UI.introAudioUnavailable, error);
            }
            if (exportInputs.isIntroVideo) {
                const probeVideo = await loadVideoElement(exportInputs.introUrl);
                exportInputs.introDurationSeconds = probeVideo.duration || exportInputs.introDurationSeconds;
                probeVideo.removeAttribute('src');
                probeVideo.load();
            }
        }

        if (lyricsSettings.state.backgroundResource?.type === lyricsSettings.media.types.video) {
            exportInputs.isBackgroundVideo = true;
            exportInputs.backgroundUrl = lyricsSettings.state.backgroundResource.element.currentSrc || lyricsSettings.state.backgroundResource.element.src;
            exportInputs.staticBackground = null;
        }
        return { ...exportInputs, mainDurationMilliseconds: decodedMainBuffer.duration * 1000 };
    } catch (error) {
        if (exportInputs.introUrl) URL.revokeObjectURL(exportInputs.introUrl);
        throw error;
    }
};

const renderVideoFile = async (exportInputs, videoCandidate, directoryHandle) => {
    const { width, height, framesPerSecond } = VIDEO_EXPORT;
    const outputFileName = `${lyricsSettings.export.fileName}_${VIDEO_EXPORT.outputFileSuffix}.${VIDEO_EXPORT.fileExtension}`;
    const encoderDescription = `${videoCandidate.label} + ${exportInputs.muxerAudioCodec.toUpperCase()}`;
    const opusWarning = exportInputs.muxerAudioCodec === 'opus' ? EXPORT_UI.opusWarning : '';
    let fileWriter = null;
    let blobOutput = null;
    let muxerTarget;
    if (directoryHandle) {
        const fileHandle = await directoryHandle.getFileHandle(outputFileName, { create: true });
        fileWriter = await fileHandle.createWritable();
        muxerTarget = new Mp4Muxer.FileSystemWritableFileStreamTarget(fileWriter);
    } else {
        blobOutput = createBlobStreamTarget();
        muxerTarget = blobOutput.target;
    }

    const muxer = new Mp4Muxer.Muxer({
        target: muxerTarget,
        fastStart: MUXER_EXPORT.fastStart,
        firstTimestampBehavior: MUXER_EXPORT.firstTimestampBehavior,
        video: { codec: VIDEO_EXPORT.codec, width, height, frameRate: framesPerSecond },
        audio: { codec: exportInputs.muxerAudioCodec, numberOfChannels: AUDIO_EXPORT.numberOfChannels, sampleRate: AUDIO_EXPORT.sampleRate },
    });
    let encoderError = null;
    let videoEncoder = null;
    const previousBackground = lyricsSettings.state.backgroundResource;
    const previousBackgroundOpacity = lyricsSettings.state.backgroundOpacity;
    const previousOverlayOpacity = lyricsSettings.state.overlayOpacity;
    const previousIntroState = lyricsSettings.state.isRecordingIntro;
    const previousIntroType = lyricsSettings.state.recordingIntroType;
    const previousTransitionState = lyricsSettings.state.recordingMainTransitionPending;
    const mainDurationMilliseconds = exportInputs.mainDurationMilliseconds;
    const introSampleCount = Math.round(exportInputs.introDurationSeconds * AUDIO_EXPORT.sampleRate);
    const totalSampleCount = introSampleCount + exportInputs.mainLeftChannel.length;
    const totalFrames = Math.ceil((totalSampleCount / AUDIO_EXPORT.sampleRate) * framesPerSecond);
    let backgroundVideoElement = null;
    let introVideoElement = null;
    let lastBackgroundSeekSeconds = -1;
    let lastIntroSeekSeconds = -1;
    let hasRenderedMainFrame = false;
    let nextAudioChunkIndex = 0;
    let isFinished = false;
    const silentFrequencyData = new Uint8Array(SPECTRUM.binCount);
    const muxAudioChunksUpTo = (timestampMicroseconds) => {
        while (nextAudioChunkIndex < exportInputs.audioChunks.length && exportInputs.audioChunks[nextAudioChunkIndex].chunk.timestamp <= timestampMicroseconds) {
            const audioChunk = exportInputs.audioChunks[nextAudioChunkIndex];
            muxer.addAudioChunk(audioChunk.chunk, audioChunk.metadata);
            nextAudioChunkIndex++;
        }
    };

    try {
        videoEncoder = new VideoEncoder({
            output: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
            error: (error) => { encoderError = error; },
        });
        videoEncoder.configure(videoCandidate.config);
        const canvas = new OffscreenCanvas(width, height);
        const context = canvas.getContext('2d', { alpha: VIDEO_EXPORT.canvasAlpha });
        if (!context) throw new Error(EXPORT_UI.noCanvasContext);
        if (exportInputs.isBackgroundVideo) backgroundVideoElement = await loadVideoElement(exportInputs.backgroundUrl);
        if (exportInputs.isIntroVideo) introVideoElement = await loadVideoElement(exportInputs.introUrl);
        await document.fonts?.ready;
        lyricsSettings.state.backgroundResource = backgroundVideoElement
            ? { type: lyricsSettings.media.types.video, element: backgroundVideoElement }
            : exportInputs.staticBackground;
        lyricsSettings.state.backgroundOpacity = 0;
        lyricsSettings.state.overlayOpacity = 0;
        lyricsSettings.state.recordingMainTransitionPending = false;
        const renderStartTimestamp = performance.now();

        for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
            throwIfExportCancelled();
            if (encoderError) throw encoderError;
            const timelineSeconds = frameIndex / framesPerSecond;
            if (timelineSeconds < exportInputs.introDurationSeconds) {
                if (introVideoElement) {
                    const introSeekSeconds = Math.min(timelineSeconds, Math.max(0, introVideoElement.duration - 0.01));
                    if (lastIntroSeekSeconds < 0 || Math.abs(introSeekSeconds - lastIntroSeekSeconds) >= EXPORT_TIMING.seekIntervalSeconds) {
                        await seekVideoToTime(introVideoElement, introSeekSeconds);
                        lastIntroSeekSeconds = introSeekSeconds;
                    }
                    context.fillStyle = lyricsSettings.colors.default.background;
                    context.fillRect(0, 0, width, height);
                    drawMediaCover(context, introVideoElement);
                } else {
                    lyricsSettings.state.isRecordingIntro = true;
                    lyricsSettings.state.recordingIntroType = 'audio';
                    lyricsRenderingCoreRender(0, context, { isOfflineExport: true });
                }
            } else {
                lyricsSettings.state.isRecordingIntro = false;
                lyricsSettings.state.recordingIntroType = null;
                const mainSeconds = timelineSeconds - exportInputs.introDurationSeconds;
                const isFirstMainFrame = !hasRenderedMainFrame;
                if (isFirstMainFrame) {
                    lyricsSettings.state.backgroundOpacity = lyricsSettings.rendering.fade.backgroundMaximumOpacity;
                    hasRenderedMainFrame = true;
                }
                if (backgroundVideoElement) {
                    const videoDuration = backgroundVideoElement.duration || EXPORT_TIMING.backgroundVideoDurationFallbackSeconds;
                    const backgroundSeekSeconds = mainSeconds % videoDuration;
                    const hasLooped = backgroundSeekSeconds < lastBackgroundSeekSeconds;
                    if (lastBackgroundSeekSeconds < 0 || hasLooped || backgroundSeekSeconds - lastBackgroundSeekSeconds >= EXPORT_TIMING.seekIntervalSeconds) {
                        await seekVideoToTime(backgroundVideoElement, Math.min(backgroundSeekSeconds, videoDuration - 0.01));
                        lastBackgroundSeekSeconds = backgroundSeekSeconds;
                    }
                }
                const spectrumFrameIndex = Math.max(0, Math.min(exportInputs.spectrumFrameCount - 1, Math.floor(mainSeconds * framesPerSecond)));
                const frequencyData = exportInputs.isSpectrumEnabled
                    ? exportInputs.frequencyFrames.subarray(spectrumFrameIndex * SPECTRUM.binCount, (spectrumFrameIndex + 1) * SPECTRUM.binCount)
                    : silentFrequencyData;
                lyricsRenderingCoreRender(mainSeconds * 1000, context, {
                    frequencyData,
                    isOfflineExport: true,
                    snapBackgroundFade: isFirstMainFrame && exportInputs.introDurationSeconds > 0,
                });
            }

            const videoFrame = new VideoFrame(canvas, {
                timestamp: Math.round((frameIndex * 1e6) / framesPerSecond),
                duration: Math.round(1e6 / framesPerSecond),
            });
            try {
                videoEncoder.encode(videoFrame, { keyFrame: frameIndex % VIDEO_EXPORT.keyFrameIntervalInFrames === 0 });
            } finally {
                videoFrame.close();
            }

            muxAudioChunksUpTo((timelineSeconds + EXPORT_TIMING.audioInterleaveLookaheadSeconds) * 1_000_000);
            while (videoEncoder.encodeQueueSize > VIDEO_EXPORT.maximumPendingFrames) {
                throwIfExportCancelled();
                if (encoderError) throw encoderError;
                await waitMilliseconds(EXPORT_TIMING.backpressurePollMs);
            }
            if (frameIndex % EXPORT_TIMING.yieldFrameInterval === 0) await yieldToBrowser();
            if (frameIndex % EXPORT_TIMING.statusFrameInterval === 0) {
                const elapsedSeconds = Math.max(EXPORT_TIMING.minimumElapsedSeconds, (performance.now() - renderStartTimestamp) / 1000);
                const renderFramesPerSecond = (frameIndex + 1) / elapsedSeconds;
                const remainingSeconds = (totalFrames - frameIndex) / renderFramesPerSecond;
                const elapsed = `${Math.floor(elapsedSeconds / 60)}m ${Math.floor(elapsedSeconds % 60)}s`;
                const remaining = `${Math.floor(remainingSeconds / 60)}m ${Math.floor(remainingSeconds % 60)}s`;

                updateExportUi(`${encoderDescription}${opusWarning}\n⏱ ${elapsed} · ⏲ ${remaining} · ᯓ ${renderFramesPerSecond.toFixed(1)} fps · ⛶ ${frameIndex}/${totalFrames}`, frameIndex / totalFrames);
            }
        }

        muxAudioChunksUpTo(Infinity);
        updateExportUi(EXPORT_UI.finalizing, 1);
        await videoEncoder.flush();
        if (encoderError) throw encoderError;
        muxer.finalize();
        if (fileWriter) {
            await fileWriter.close();
            fileWriter = null;
        } else {
            downloadBlob(blobOutput.getBlob(), outputFileName);
        }
        isFinished = true;
    } finally {
        if (videoEncoder && videoEncoder.state !== 'closed') videoEncoder.close();
        lyricsSettings.state.backgroundResource = previousBackground;
        lyricsSettings.state.backgroundOpacity = previousBackgroundOpacity;
        lyricsSettings.state.overlayOpacity = previousOverlayOpacity;
        lyricsSettings.state.isRecordingIntro = previousIntroState;
        lyricsSettings.state.recordingIntroType = previousIntroType;
        lyricsSettings.state.recordingMainTransitionPending = previousTransitionState;
        if (fileWriter) {
            try {
                await fileWriter.abort();
            } catch (error) {
                console.warn(EXPORT_UI.incompleteOutputAbortFailed, error);
            }
        }
        for (const videoElement of [backgroundVideoElement, introVideoElement]) {
            if (videoElement) {
                videoElement.removeAttribute('src');
                videoElement.load();
            }
        }
        if (!isFinished && directoryHandle) {
            try {
                await directoryHandle.removeEntry(`${lyricsSettings.export.fileName}_${VIDEO_EXPORT.outputFileSuffix}.${VIDEO_EXPORT.fileExtension}`);
            } catch (error) {
                console.warn(EXPORT_UI.incompleteOutputRemoveFailed, error);
            }
        }
    }
};

const renderWithEncoderFallback = async (exportInputs, directoryHandle) => {
    const videoCandidates = await findVideoEncoderCandidates();
    let lastError = null;
    for (let index = 0; index < videoCandidates.length; index++) {
        const candidate = videoCandidates[index];
        try {
            await renderVideoFile(exportInputs, candidate, directoryHandle);
            return;
        } catch (error) {
            if (error === EXPORT_CANCELLED) throw error;
            lastError = error;
            console.warn(EXPORT_UI.encoderFailed.replace('{encoder}', candidate.label), error);
            if (index < videoCandidates.length - 1) {
                updateExportUi(`Encoder ${candidate.label} failed,\ntrying ${videoCandidates[index + 1].label}…`, 0);
                await waitMilliseconds(EXPORT_TIMING.fallbackDelayMs);
            }
        }
    }
    throw lastError || new Error(EXPORT_UI.noEncoderFallback);
};

const waitForOverlayDismissal = () => new Promise((resolve) => {
    const cancelButton = exportUi.cancelButton();
    cancelButton.textContent = EXPORT_UI.close;
    cancelButton.onclick = resolve;
});

const chooseOutputDirectory = async () => {
    if (!window.showDirectoryPicker) return null;
    try {
        return await window.showDirectoryPicker(filePicker);
    } catch (error) {
        if (error.name === 'AbortError') return false;
        console.warn(EXPORT_UI.noFolderFallback, error);
        return null;
    }
};

export const lyricsMp4ExportStart = async ({ audioElement, buttonElement }) => {
    if (exportInProgress) return;
    if (lyricsSettings.state.isRecording) {
        alert(EXPORT_UI.stopRecording);
        return;
    }
    if (!audioElement.src) {
        alert(MESSAGES.missingAudio);
        return;
    }
    if (!('VideoEncoder' in window) || !('AudioEncoder' in window) || !('VideoFrame' in window) || !('OffscreenCanvas' in window)) {
        alert(EXPORT_UI.unsupportedBrowser);
        return;
    }

    const directoryHandle = await chooseOutputDirectory();
    if (directoryHandle === false) return;
    exportInProgress = true;
    exportControl.isCancelRequested = false;
    lyricsSettings.state.isMp4Exporting = true;
    lyricsLoopsStopPreviewLoop();
    audioElement.pause();
    setExportButtonState(buttonElement, true);
    exportUi.title().textContent = EXPORT_UI.title;
    exportUi.overlay().classList.replace('hidden', 'flex');
    exportUi.cancelButton().textContent = EXPORT_UI.cancel;
    exportUi.cancelButton().onclick = () => {
        exportControl.isCancelRequested = true;
        exportControl.cancelWorker?.();
        exportUi.cancelButton().textContent = EXPORT_UI.cancelling;
    };
    updateExportUi(EXPORT_UI.preparing, 0);

    let exportInputs = null;
    try {
        try {
            exportControl.wakeLock = await navigator.wakeLock?.request(wakeLockType);
        } catch (error) {
            console.warn(EXPORT_UI.wakeLockRequestFailed, error);
        }
        await lyricsMediaGetAudioState(audioElement);
        updateExportUi(EXPORT_UI.preparingMedia, 0);
        exportInputs = await collectExportInputs(audioElement);
        throwIfExportCancelled();
        updateExportUi(EXPORT_UI.encodingAudio, 0);
        const audioTrack = await encodeAudioTrack(exportInputs, (progressRatio) => {
            exportUi.progressBar().style.width = `${progressRatio * EXPORT_TIMING.audioProgressWeight * 100}%`;
        });
        exportInputs.audioChunks = audioTrack.chunks;
        exportInputs.muxerAudioCodec = audioTrack.muxerCodec;
        await renderWithEncoderFallback(exportInputs, directoryHandle);
        updateExportUi(directoryHandle ? EXPORT_UI.saved : EXPORT_UI.downloaded, 1);
        await waitForOverlayDismissal();
    } catch (error) {
        exportUi.title().textContent = error === EXPORT_CANCELLED ? EXPORT_UI.exportCancelled : EXPORT_UI.exportError;
        updateExportUi(error === EXPORT_CANCELLED ? `${EXPORT_UI.exportCancelled}\n${EXPORT_UI.incompleteOutput}` : String(error?.message || error));
        if (error !== EXPORT_CANCELLED) console.error(EXPORT_UI.exportFailed, error);
        await waitForOverlayDismissal();
    } finally {
        if (exportInputs?.introUrl) URL.revokeObjectURL(exportInputs.introUrl);
        try {
            await exportControl.wakeLock?.release();
        } catch (error) {
            console.warn(EXPORT_UI.wakeLockReleaseFailed, error);
        }
        exportControl.wakeLock = null;
        exportControl.cancelWorker = null;
        exportUi.overlay().classList.replace('flex', 'hidden');
        exportUi.cancelButton().onclick = () => {
            exportControl.isCancelRequested = true;
        };
        lyricsSettings.state.isMp4Exporting = false;
        setExportButtonState(buttonElement, false);
        audioElement.currentTime = 0;
        lyricsLoopsRenderPreviewFrame(audioElement);
        exportInProgress = false;
    }
};
