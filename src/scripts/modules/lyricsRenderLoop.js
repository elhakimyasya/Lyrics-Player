import { lyricsSettings } from "./lyricsSettings";
import { lyricsRender } from "./lyricsRender";

export const lyricsRenderLoop = () => {
    const audioPlayerElement = document.querySelector(lyricsSettings.elementSelectorAudio);

    lyricsRender(audioPlayerElement.currentTime * 1000, lyricsSettings.lyricsCanvasContext);

    lyricsSettings.lyricsAnimationRequestID = requestAnimationFrame(lyricsRenderLoop);
};