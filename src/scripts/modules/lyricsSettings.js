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
    lyricsPreviewWidth: 1920,
    lyricsPreviewHeight: 1080,
    lyricsFramesPerSecond: 60,

    // Visual Config
    lyricsFontFace: 'Nexa Black',
    lyricsInstrumentalSymbol: '♪',
    lyricsExportFileName: 'lyrics-export',
    lyricsHeaderFirstRender: true,
    lyricsBackgroundCurrentOpacity: 0.9, // Nilai awal (default gelap/10%)
    lyricsFadeSpeed: 0.02, // Kecepatan fade (semakin kecil semakin lambat/halus)
    lyricsBgColor: localStorage.getItem('lyricsBgColor') || '#000000',
    lyricsKeyColor: localStorage.getItem('lyricsKeyColor') || '#ffde59',
    lyricsPersistenceKeys: {
        audio: 'persistent_audio_file',
        background: 'persistent_bg_file',
        bgType: 'persistent_bg_type'
    }
};