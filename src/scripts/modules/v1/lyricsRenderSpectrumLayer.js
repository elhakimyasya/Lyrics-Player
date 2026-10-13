import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderSpectrum } from './lyricsRenderSpectrum';

export const lyricsRenderSpectrumLayer = (drawContext) => {
    if (!lyricsSettings.lyricsStateRenderSpectrum) {
        return;
    }

    drawContext.save();

    lyricsRenderSpectrum(drawContext);

    drawContext.restore();
};
