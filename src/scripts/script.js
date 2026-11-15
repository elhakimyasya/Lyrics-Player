import { lyricsSettings } from "./modules/v1/lyricsSettings";
import { lyricsAppInit } from "./modules/v1/lyricsApp";
import { lyricsEventsBind } from "./modules/v1/lyricsEvents";
import { lyricsTemplatesBind } from "./modules/v1/lyricsTemplates";

const elementCanvas = document.querySelector(lyricsSettings.selectors.elementCanvas.preview);
lyricsSettings.canvas.context = elementCanvas.getContext("2d", { alpha: true });

lyricsEventsBind();
lyricsTemplatesBind();
lyricsAppInit();