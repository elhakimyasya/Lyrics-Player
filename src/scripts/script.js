import { lyricsSettings } from "./modules/v1/lyricsCore";
import { lyricsCoreGetCanvasContext } from "./modules/v1/lyricsCore";
import { lyricsAppInit } from "./modules/v1/lyricsApp";
import { lyricsEventsBind } from "./modules/v1/lyricsEvents";
import { lyricsTemplatesBind } from "./modules/v1/lyricsTemplates";

lyricsSettings.lyricsCanvasContext = lyricsCoreGetCanvasContext();

lyricsEventsBind();
lyricsTemplatesBind();
lyricsAppInit();