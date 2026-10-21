const lyricsDefaultBackgroundColor = '#000000';
const lyricsDefaultKeyColor = '#ffde59';
const lyricsDefaultNonActiveTextColor = '#ffffff';

const lyricsStorageKeys = {
    lyricsText: 'lyrics_textarea',
    lyricsHeader: 'lyrics_header',
    lyricsFooter: 'lyrics_footer',
    headerTemplates: 'lyrics_header_templates',
    footerTemplates: 'lyrics_footer_templates',
    lyricsOffset: 'lyrics_offset',
    colorBackground: 'lyricsBgColor',
    colorKey: 'lyricsKeyColor',
    colorText: 'lyricsNonActiveTextColor',
};

export const lyricsSettings = {
    // DOM Selectors
    elementSelectorInputAudio: '.element_input_audio',
    elementSelectorInputOffset: '.element_input_offset',
    elementSelectorInputBackground: '.element_input_background',
    elementSelectorInputSpectrum: '.element_input_spectrum',
    elementSelectorInputIntro: '.element_input_intro',
    elementSelectorButtonRemoveAudio: '.element_button_remove_audio',
    elementSelectorButtonRemoveBackground: '.element_button_remove_background',
    elementSelectorButtonRemoveIntro: '.element_button_remove_intro',
    elementSelectorTextareaLyrics: '.element_textarea_lyrics',
    elementSelectorTextareaHeader: '.element_textarea_header',
    elementSelectorTextareaFooter: '.element_textarea_footer',
    elementSelectorButtonExport: '.element_button_export',
    elementSelectorButtonFullscreen: '.element_button_fullscreen',
    elementSelectorAudio: '.element_audio',
    elementSelectorContainerControl: '.element_container_controll',
    elementSelectorCanvas: '.element_canvas_preview',
    elementSelectorColorBackground: '.element_input_bg_color',
    elementSelectorColorKey: '.element_input_key_color',
    elementSelectorColorText: '.element_input_text_color',

    lyricsDataParsed: [],
    lyricsStateIsPlaying: false,
    lyricsStateIsRecording: false,
    lyricsStateIsRecordingIntro: false,
    lyricsRecordingIntroType: null,
    lyricsRecordingMainTransitionPending: false,
    lyricsRecordingMediaRecorder: null,
    lyricsStateRenderSpectrum: true,
    lyricsResourceBackground: null,
    lyricsAnimationRequestID: null,

    // Audio Context & Spectrum
    lyricsAudioContext: null,
    lyricsAudioAnalyser: null,
    lyricsAudioSource: null,
    lyricsAudioFrequencyData: null,

    // Canvas Config
    lyricsCanvasContext: null,
    lyricsCanvasContextType: '2d',
    lyricsCanvasContextOptions: {
        alpha: true,
    },
    lyricsPreviewWidth: 1920,
    lyricsPreviewHeight: 1080,
    lyricsFramesPerSecond: 60,
    lyricsMillisecondsPerSecond: 1000,
    lyricsSecondsPerMinute: 60,
    lyricsNumberRadix: 10,
    lyricsHexColorRadix: 16,
    lyricsTimestampMillisecondPadding: '00',
    lyricsTimestampMillisecondDigits: 3,

    // Visual Config
    lyricsFontFace: 'Nexa Black',
    lyricsInstrumentalSymbol: '♪',
    lyricsExportFileName: 'lyrics-export',
    lyricsBackgroundCurrentOpacity: 0,
    lyricsOverlayCurrentOpacity: 0,
    lyricsFadeSpeed: 0.01,

    // Storage Config
    lyricsStorageKeys,
    lyricsDefaultLyrics: '',
    lyricsDefaultOffset: '0',
    lyricsPersistenceKeys: {
        audio: 'persistent_audio_file',
        background: 'persistent_bg_file',
        intro: 'persistent_intro_file',
        bgType: 'persistent_bg_type',
    },
    lyricsDatabaseName: 'LyricsAppDB',
    lyricsDatabaseVersion: 1,
    lyricsDatabaseStoreName: 'AssetsStore',
    lyricsDatabaseReadWriteMode: 'readwrite',

    // Color Config
    lyricsDefaultBackgroundColor,
    lyricsDefaultKeyColor,
    lyricsDefaultNonActiveTextColor,
    lyricsBgColor: localStorage.getItem(lyricsStorageKeys.colorBackground) || lyricsDefaultBackgroundColor,
    lyricsKeyColor: localStorage.getItem(lyricsStorageKeys.colorKey) || lyricsDefaultKeyColor,
    lyricsNonActiveTextColor: localStorage.getItem(lyricsStorageKeys.colorText) || lyricsDefaultNonActiveTextColor,
    lyricsColorSettingKeys: {
        colorBackground: 'lyricsBgColor',
        colorKey: 'lyricsKeyColor',
        colorText: 'lyricsNonActiveTextColor',
    },

    // Media Config
    lyricsMediaTypes: {
        image: 'image',
        video: 'video',
    },
    lyricsVideoElementTag: 'video',
    lyricsImageMimePrefix: 'image/',
    lyricsBlobUrlPrefix: 'fileBlob:',

    // Audio Config
    lyricsAudioReadyStateCanPlay: 2,
    lyricsAudioAnalyserFftSize: 1024,
    lyricsAudioAnalyserSmoothing: 0.1,
    lyricsAudioBassFilterType: 'lowshelf',
    lyricsAudioBassFilterFrequency: 150,
    lyricsAudioBassFilterGain: 6,
    lyricsAudioOutputGain: 1.0,

    // Recording Config
    lyricsRecordingMimeType: 'video/webm',
    lyricsRecordingMimeTypesWithCodecs: [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
    ],
    lyricsRecordingFileExtension: 'webm',
    lyricsRecordingVideoBitsPerSecond: 12000000,
    lyricsRecordingAudioBitsPerSecond: 192000,
    lyricsRecordingButtonText: {
        idle: 'RECORD',
        active: 'RECORDING',
    },
    lyricsRecordingMissingAudioMessage: 'Please insert the audio file first.',
    lyricsRecordingChunkIntervalMs: 1000,
    lyricsRecordingManualCaptureFrameRate: 0,
    lyricsRecordingObjectUrlRevokeDelayMs: 60000,
    lyricsRecordingStopOffsetSeconds: 0.05,

    // Background Render Config
    lyricsBackgroundMaxOpacity: 1,
    lyricsBackgroundRevealThreshold: 0.3,
    lyricsBackgroundRevealOverlayOpacity: 0.1,
    lyricsBackgroundNextLinePreloadMs: 1000,

    // Overlay Render Config
    lyricsOverlayMaxOpacity: 0.5,
    lyricsOverlayOpacityReference: 0.95,
    lyricsOverlayLineDurationSeconds: 6,
    lyricsOverlayFadeDurationSeconds: 1,
    lyricsOverlayHeaderFontSize: 48,
    lyricsOverlayFooterFontSize: 32,
    lyricsOverlayHeaderY: 120,
    lyricsOverlayFooterBottomOffset: 120,

    // Lyrics Render Config
    lyricsLineFontSize: 82,
    lyricsLineSpacing: 120,
    lyricsLineBaseYRatio: 0.55,
    lyricsInactiveLineOpacity: 0.5,
    lyricsPreviousLineFadeOutMs: 200,
    lyricsNextLineFadeInMs: 1000,

    // Spectrum Render Config
    lyricsSpectrumBarsCount: 80,
    lyricsSpectrumBarGap: 3,
    lyricsSpectrumMaxHeightRatio: 0.12,
    lyricsSpectrumThreshold: 5,
    lyricsSpectrumGradientStartAlpha: 0.1,
    lyricsSpectrumGradientEndAlpha: 0.9,
    lyricsSpectrumInteractiveBoost: 0.3,
    lyricsSpectrumEdgeScale: 0.98,
};

export const lyricsCoreGetCanvasContext = () => {
    const elementCanvas = document.querySelector(lyricsSettings.elementSelectorCanvas);
    return elementCanvas.getContext(lyricsSettings.lyricsCanvasContextType, lyricsSettings.lyricsCanvasContextOptions);
};
