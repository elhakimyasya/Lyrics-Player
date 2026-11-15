const canvasDefaults = { width: 1920, height: 1080, framesPerSecond: 60 };
const spectrumDefaults = {
    fftSize: 1024,
    smoothingFactor: 0.1,
    bassFilterFrequency: 150,
    bassFilterGainDecibels: 6,
    barCount: 100,
    barGap: 3,
    peak: {
        enabled: true,
        thickness: 2,
        opacityPercent: 30,
        holdTimeMilliseconds: 30,
        fallingMode: 'steady',
        fallSpeedDecibelsPerSecond: 60,
    },
};
const defaultExportFileName = 'lyrics-export';

const storageKeys = {
    lyricsText: 'lyrics_textarea',
    lyricsHeader: 'lyrics_header',
    lyricsFooter: 'lyrics_footer',
    headerTemplates: 'lyrics_header_templates',
    footerTemplates: 'lyrics_footer_templates',
    lyricsOffset: 'lyrics_offset',
    colorBackground: 'lyricsBgColor',
    colorKey: 'lyricsKeyColor',
    colorText: 'lyricsNonActiveTextColor',
    displayVersion: 'lyrics_display_version',
    lineBaseYRatio: 'lyrics_line_base_y_ratio',
    spectrumEnabled: 'lyrics_spectrum_enabled',
    spectrumBarCount: 'lyrics_spectrum_bar_count',
    spectrumBarGap: 'lyrics_spectrum_bar_gap',
    spectrumPeakEnabled: 'lyrics_spectrum_peak_enabled',
    spectrumPeakThickness: 'lyrics_spectrum_peak_thickness',
    spectrumPeakOpacity: 'lyrics_spectrum_peak_opacity',
    spectrumPeakHoldTime: 'lyrics_spectrum_peak_hold_time',
    spectrumPeakFallingMode: 'lyrics_spectrum_peak_falling_mode',
    spectrumPeakFallSpeed: 'lyrics_spectrum_peak_fall_speed',
};

const readStoredNumberSetting = (storageKey, fallback, minimum, maximum, integer = false) => {
    const storedValue = localStorage.getItem(storageKey);
    if (storedValue === null) return fallback;

    const parsedValue = Number(storedValue);
    if (!Number.isFinite(parsedValue)) return fallback;

    const boundedValue = Math.min(maximum, Math.max(minimum, parsedValue));
    return integer ? Math.round(boundedValue) : boundedValue;
};

const storedSpectrumEnabled = localStorage.getItem(storageKeys.spectrumEnabled);
const storedSpectrumPeakEnabled = localStorage.getItem(storageKeys.spectrumPeakEnabled);
const storedSpectrumPeakFallingMode = localStorage.getItem(storageKeys.spectrumPeakFallingMode);
const spectrumPeakFallingModes = ['steady', 'gravity', 'fade-out'];

export const lyricsSettings = {
    // DOM hooks shared by preview, recording, and export.
    selectors: {
        elementInput: {
            audio: '.element_input_audio',
            offset: '.element_input_offset',
            background: '.element_input_background',
            spectrum: '.element_input_spectrum',
            intro: '.element_input_intro',
            backgroundColor: '.element_input_bg_color',
            keyColor: '.element_input_key_color',
            textColor: '.element_input_text_color',
            spectrumBarCount: '.element_input_spectrum_bar_count',
            spectrumBarGap: '.element_input_spectrum_bar_gap',
            spectrumPeakEnabled: '.element_input_spectrum_peak_enabled',
            spectrumPeakThickness: '.element_input_spectrum_peak_thickness',
            spectrumPeakOpacity: '.element_input_spectrum_peak_opacity',
            spectrumPeakHoldTime: '.element_input_spectrum_peak_hold_time',
            spectrumPeakFallingMode: '.element_input_spectrum_peak_falling_mode',
            spectrumPeakFallSpeed: '.element_input_spectrum_peak_fall_speed',
        },
        elementRadio: { displayVersion: '.element_input_display_version' },
        elementButton: {
            removeAudio: '.element_button_remove_audio',
            removeBackground: '.element_button_remove_background',
            removeIntro: '.element_button_remove_intro',
            export: '.element_button_export',
            exportMp4: '.element_button_export_mp4',
            fullscreen: '.element_button_fullscreen',
        },
        elementTextarea: {
            lyrics: '.element_textarea_lyrics',
            header: '.element_textarea_header',
            footer: '.element_textarea_footer',
        },
        elementAudio: '.element_audio',
        elementContainer: { control: '.element_container_controll' },
        elementCanvas: { preview: '.element_canvas_preview' },
        elementDialog: { template: '.element_dialog_template' },
        mp4Export: {
            overlay: '.elememnt_dialog_export',
            title: '.export_title',
            status: '.export_status',
            progressBar: '.export_bar',
            cancelButton: '.export_cancel',
        },
    },

    // Mutable application state.
    state: {
        parsedLyrics: [],
        isPlaying: false,
        isRecording: false,
        isMp4Exporting: false,
        isRecordingIntro: false,
        recordingIntroType: null,
        recordingMainTransitionPending: false,
        recordingMediaRecorder: null,
        renderSpectrum: storedSpectrumEnabled === null ? true : storedSpectrumEnabled === 'true',
        backgroundResource: null,
        animationRequestId: null,
        backgroundOpacity: 0,
        overlayOpacity: 0,
    },

    // Shared export filename used by recording and file-picker persistence.
    export: { fileName: defaultExportFileName },

    // Preview and recording canvas dimensions.
    canvas: {
        context: null,
        width: canvasDefaults.width,
        height: canvasDefaults.height,
        framesPerSecond: canvasDefaults.framesPerSecond,
    },

    // Audio analysis and output.
    audio: {
        context: null,
        analyser: null,
        source: null,
        frequencyData: null,
        analyserOptions: {
            fftSize: spectrumDefaults.fftSize,
            smoothingFactor: spectrumDefaults.smoothingFactor,
        },
        bassFilter: {
            type: 'lowshelf',
            frequency: spectrumDefaults.bassFilterFrequency,
            gainDecibels: spectrumDefaults.bassFilterGainDecibels,
        },
    },

    // Persisted data and IndexedDB.
    storage: {
        keys: storageKeys,
        defaults: { lyrics: '', offset: '0' },
        persistenceKeys: {
            audio: 'persistent_audio_file',
            background: 'persistent_bg_file',
            intro: 'persistent_intro_file',
            backgroundType: 'persistent_bg_type',
            audioFileName: 'persistent_audio_name',
        },
        database: { name: 'LyricsAppDB', version: 1, storeName: 'AssetsStore' },
    },

    // Theme colors; current values are initialized from local storage.
    colors: {
        default: { background: '#000000', key: '#ffde59', text: '#ffffff' },
        background: localStorage.getItem(storageKeys.colorBackground) || '#000000',
        key: localStorage.getItem(storageKeys.colorKey) || '#ffde59',
        text: localStorage.getItem(storageKeys.colorText) || '#ffffff',
    },

    // Media types used by background and intro assets.
    media: { types: { image: 'image', video: 'video' } },

    // Recording output and capture quality.
    recording: {
        mimeType: 'video/webm',
        mimeTypesWithCodecs: ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'],
        fileExtension: 'webm',
        videoBitsPerSecond: 12000000,
        audioBitsPerSecond: 192000,
        buttonText: { idle: 'RECORD', active: 'RECORDING' },
        chunkIntervalMilliseconds: 1000,
        manualCaptureFrameRate: 0,
        objectUrlRevokeDelayMilliseconds: 60000,
        stopOffsetSeconds: 0.05,
    },

    // Shared rendering dimensions, typography, and fade behavior.
    rendering: {
        lyrics: {
            lyricFontSize: 82,
            lineSpacing: 120,
            defaultBaseYRatio: parseFloat(localStorage.getItem(storageKeys.lineBaseYRatio)) || 0.57,
            inactiveLineOpacity: 0.5,
            previousLineFadeOutMilliseconds: 200,
            nextLineFadeInMilliseconds: 1000,
            tripleShiftDurationMilliseconds: 500,
            tripleFadeDurationMilliseconds: 450,
            instrumentalSymbol: '♪',
            fontFamily: '"Nexa Black", "Montserrat", "Arial Black", sans-serif',
            maximumTextWidth: 1800,
            lineHeightMultiplier: 1.15,
        },
        overlay: {
            header: { fontSize: 48, topY: 120 },
            footer: { fontSize: 32, bottomOffset: 120 },
        },
        fade: {
            speedPerFrame: 0.01,
            backgroundMaximumOpacity: 1,
            backgroundRevealThreshold: 0.3,
            backgroundRevealOverlayOpacity: 0.1,
            backgroundPreloadMilliseconds: 1000,
            overlayMaximumOpacity: 0.5,
            overlayOpacityReference: 0.95,
            overlayLineDurationSeconds: 6,
            overlayFadeDurationSeconds: 1,
        },
    },

    // Lyrics layout mode.
    display: {
        version: localStorage.getItem(storageKeys.displayVersion) || 'dual',
        versions: ['dual', 'triple'],
    },

    // Spectrum visualization and offline analysis.
    spectrum: {
        ...spectrumDefaults,
        binCount: spectrumDefaults.fftSize / 2,
        minimumDecibels: -100,
        maximumDecibels: -30,
        barCount: readStoredNumberSetting(storageKeys.spectrumBarCount, spectrumDefaults.barCount, 1, 256, true),
        barGap: readStoredNumberSetting(storageKeys.spectrumBarGap, spectrumDefaults.barGap, 0, 100),
        peak: {
            ...spectrumDefaults.peak,
            enabled: storedSpectrumPeakEnabled === null ? spectrumDefaults.peak.enabled : storedSpectrumPeakEnabled === 'true',
            thickness: readStoredNumberSetting(storageKeys.spectrumPeakThickness, spectrumDefaults.peak.thickness, 1, 24, true),
            opacityPercent: readStoredNumberSetting(storageKeys.spectrumPeakOpacity, spectrumDefaults.peak.opacityPercent, 0, 100, true),
            holdTimeMilliseconds: readStoredNumberSetting(storageKeys.spectrumPeakHoldTime, spectrumDefaults.peak.holdTimeMilliseconds, 0, 10_000, true),
            fallingMode: spectrumPeakFallingModes.includes(storedSpectrumPeakFallingMode) ? storedSpectrumPeakFallingMode : spectrumDefaults.peak.fallingMode,
            fallSpeedDecibelsPerSecond: readStoredNumberSetting(storageKeys.spectrumPeakFallSpeed, spectrumDefaults.peak.fallSpeedDecibelsPerSecond, 1, 100),
        },
        maximumHeightRatio: 0.12,
        silenceThreshold: 5,
        gradientStartAlpha: 0.1,
        gradientEndAlpha: 0.9,
        mouseBoostStrength: 0.3,
        edgeScale: 0.98,
    },

    // Preview quality levels.
    preview: {
        defaultLevelIndex: 1,
        defaultWidthLevels: [1920, 1280, 960, 640],
        slowFrameCostMilliseconds: 10,
        slowFramesBeforeDowngrade: 45,
    },

    // User-facing messages are kept together.
    messages: {
        missingAudio: 'Please insert the audio file first.',
        media: {
            audioLoadFailed: 'Audio resource failed to load.',
            restoreIntroFailed: 'Failed to restore intro file:',
            saveIntroFailed: 'Failed to save intro file:',
            resumeAudioContextFailed: 'Failed to resume AudioContext:',
        },
        recording: {
            disconnectAudioStreamFailed: 'Failed to disconnect recording audio stream:',
            exportFailed: 'Export Error:',
            videoConstraintsFailed: 'Failed to apply recording video constraints:',
        },
        templates: {
            emptyState: 'No templates yet. Create your first template below.',
            deleteConfirmation: 'Hapus template "{name}"?',
            useAction: 'Use',
            editAction: 'Edit',
            deleteAction: 'Delete',
        },
        mp4Export: {
            buttonIdle: 'EXPORT',
            buttonActive: 'EXPORTING',
            title: 'Export MP4',
            unsupportedBrowser: 'This browser does not support WebCodecs MP4 export.',
            stopRecording: 'Stop the recording before exporting MP4.',
            analysisError: 'Spectrum analysis failed.',
            workerAnalysisError: 'Spectrum analysis worker failed.',
            workerAnalysisFailed: 'Spectrum analysis failed:',
            noAudioEncoder: 'This browser does not support an AAC or Opus audio encoder.',
            audioEncoderUnavailable: 'Audio encoder {codec} is unavailable:',
            noVideoEncoder: 'This browser does not support H.264 WebCodecs. Use a recent version of Chrome or Edge.',
            videoEncoderUnavailable: 'Video encoder {label} is unavailable:',
            noEncoderFallback: 'All H.264 encoders failed.',
            noCanvasContext: 'Could not create an offscreen canvas context.',
            videoLoadError: 'Failed to load video media.',
            videoSeekError: 'Failed to seek video media.',
            videoSeekTimeout: 'Timed out while seeking video media.',
            incompleteOutput: 'Incomplete output removed.',
            incompleteOutputAbortFailed: 'Failed to abort incomplete MP4 output:',
            incompleteOutputRemoveFailed: 'Failed to remove incomplete MP4 output:',
            encoderFailed: 'Encoder "{encoder}" failed:',
            audioFileLoadFailed: 'Failed to load audio file ({status}).',
            introAudioUnavailable: 'Intro audio could not be decoded; exporting the intro without audio.',
            exportCancelled: 'Export cancelled.',
            exportError: 'Export error',
            exportFailed: 'MP4 export failed:',
            opusWarning: '\nThis browser lacks AAC encoding; use Chrome or Edge for broad compatibility.',
            close: 'Close',
            cancel: 'Cancel',
            cancelling: 'Cancelling…',
            preparing: 'Preparing\n…',
            preparingMedia: 'Preparing audio & media\n…',
            analyzingSpectrum: 'Analyzing audio spectrum',
            encodingAudio: 'Encoding audio\n…',
            finalizing: 'Finalizing MP4\n…',
            saved: 'MP4 saved in the selected folder.',
            downloaded: 'MP4 downloaded.',
            noFolderFallback: 'Folder selection is unavailable; the MP4 will be downloaded instead.',
            wakeLockRequestFailed: 'Could not prevent the screen from sleeping during export:',
            wakeLockReleaseFailed: 'Could not release the export screen wake lock:',
            encoderFallback: 'Encoder {encoder} failed,\ntrying {next}…',
        },
    },

    // MP4 encoding and muxing settings.
    mp4Export: {
        video: {
            width: canvasDefaults.width,
            height: canvasDefaults.height,
            framesPerSecond: canvasDefaults.framesPerSecond,
            canvasAlpha: false,
            bitsPerSecond: 10_000_000,
            keyFrameIntervalInFrames: 120,
            maximumPendingFrames: 6,
            h264CodecStrings: ['avc1.64002A', 'avc1.4D402A'],
            encoderModes: [
                { hardwareAcceleration: 'prefer-hardware', label: 'GPU' },
                { hardwareAcceleration: 'prefer-software', label: 'CPU' },
            ],
            codec: 'avc',
            codecFormat: 'avc',
            latencyMode: 'realtime',
            bitrateMode: 'variable',
            fileExtension: 'mp4',
            outputFileSuffix: `${canvasDefaults.width}x${canvasDefaults.height}_${canvasDefaults.framesPerSecond}fps`,
        },
        audio: {
            sampleRate: 48_000,
            numberOfChannels: 2,
            decodeLength: 1,
            bitsPerSecond: 192_000,
            framesPerChunk: 4_800,
            maximumPendingChunks: 12,
            format: 'f32-planar',
            defaultMuxerCodec: 'aac',
            encoderCandidates: [
                { encoderCodec: 'mp4a.40.2', muxerCodec: 'aac' },
                { encoderCodec: 'opus', muxerCodec: 'opus' },
            ],
        },
        muxer: {
            fastStart: false,
            firstTimestampBehavior: 'offset',
            mimeType: 'video/mp4',
        },
        timing: {
            seekTimeoutMs: 5_000,
            seekToleranceSeconds: 0.0005,
            seekIntervalSeconds: 1 / 30,
            yieldFrameInterval: 4,
            statusFrameInterval: 20,
            backpressurePollMs: 2,
            fallbackDelayMs: 600,
            spectrumProgressFrameInterval: 600,
            audioProgressChunkInterval: 50,
            minimumElapsedSeconds: 0.001,
            analysisProgressWeight: 0.15,
            audioProgressWeight: 0.05,
            backgroundVideoDurationFallbackSeconds: 1,
            audioInterleaveLookaheadSeconds: 1.5,
        },
        blobChunkSize: 1 << 22,
        filePicker: { id: defaultExportFileName, mode: 'readwrite' },
        wakeLockType: 'screen',
    },
};
