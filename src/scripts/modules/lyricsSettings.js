const lyricsDefaultBgColor = '#000000';
const lyricsDefaultKeyColor = '#ffde59';
const lyricsDefaultNonActiveTextColor = '#ffffff';

const lyricsStorageKeys = {
    lyricsText: 'lyrics_textarea',
    lyricsHeader: 'lyrics_header',
    lyricsFooter: 'lyrics_footer',
    lyricsOffset: 'lyrics_offset',
    bgColor: 'lyricsBgColor',
    keyColor: 'lyricsKeyColor',
    nonActiveTextColor: 'lyricsNonActiveTextColor',
};

export const lyricsSettings = {
    // DOM Selectors
    elementSelectorInputAudio: '.element_input_audio',
    elementSelectorInputOffset: '.element_input_offset',
    elementSelectorInputBackground: '.element_input_background',
    elementSelectorInputSpectrum: '.element_input_spectrum',
    elementSelectorTextareaLyrics: '.element_textarea_lyrics',
    elementSelectorTextareaHeader: '.element_textarea_header',
    elementSelectorTextareaFooter: '.element_textarea_footer',
    elementSelectorButtonExport: '.element_button_export',
    elementSelectorButtonFullscreen: '.element_button_fullscreen',
    elementSelectorAudio: '.element_audio',
    elementSelectorContainerControl: '.element_container_controll',
    elementSelectorCanvas: '.element_canvas_preview',
    elementSelectorBgColor: '#element_input_bg_color',
    elementSelectorKeyColor: '#element_input_key_color',
    elementSelectorNonActiveTextColor: '#element_input_non_active_text_color',

    // State & Data
    lyricsDataParsed: [],
    lyricsStateIsPlaying: false,
    lyricsStateIsRecording: false,
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
    lyricsHeaderFirstRender: true,
    lyricsBackgroundCurrentOpacity: 0.9,
    lyricsFadeSpeed: 0.01,

    // Storage Config
    lyricsStorageKeys,
    lyricsDefaultLyrics: '[00:00.00] Intro\n[00:05.00] Lirik Baris Pertama',
    lyricsDefaultOffset: '0',
    lyricsPersistenceKeys: {
        audio: 'persistent_audio_file',
        background: 'persistent_bg_file',
        bgType: 'persistent_bg_type',
    },
    lyricsDatabaseName: 'LyricsAppDB',
    lyricsDatabaseVersion: 1,
    lyricsDatabaseStoreName: 'AssetsStore',
    lyricsDatabaseReadWriteMode: 'readwrite',

    // Color Config
    lyricsDefaultBgColor,
    lyricsDefaultKeyColor,
    lyricsDefaultNonActiveTextColor,
    lyricsBgColor: localStorage.getItem(lyricsStorageKeys.bgColor) || lyricsDefaultBgColor,
    lyricsKeyColor: localStorage.getItem(lyricsStorageKeys.keyColor) || lyricsDefaultKeyColor,
    lyricsNonActiveTextColor: localStorage.getItem(lyricsStorageKeys.nonActiveTextColor) || lyricsDefaultNonActiveTextColor,
    lyricsColorSettingKeys: {
        bgColor: 'lyricsBgColor',
        keyColor: 'lyricsKeyColor',
        nonActiveTextColor: 'lyricsNonActiveTextColor',
    },

    // Media Config
    lyricsMediaTypes: {
        image: 'image',
        video: 'video',
    },
    lyricsVideoElementTag: 'video',
    lyricsImageMimePrefix: 'image/',
    lyricsBlobUrlPrefix: 'blob:',

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
    lyricsRecordingMimeTypeWithCodecs: 'video/webm;codecs=vp9,opus',
    lyricsRecordingFileExtension: 'webm',
    lyricsRecordingButtonText: {
        idle: 'RECORD',
        active: 'RECORDING...',
    },
    lyricsRecordingMissingAudioMessage: 'Silakan masukkan file audio terlebih dahulu.',
    lyricsRecordingChunkIntervalMs: 1000,
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
