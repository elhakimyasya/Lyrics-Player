import { lyricsSettings } from "./modules/v1/lyricsSettings";
import { lyricsDom, lyricsGetCanvasContext } from "./modules/v1/lyricsDom";
import { lyricsInitializeApplication } from "./modules/v1/lyricsAppInit";
import { lyricsBindEvents } from "./modules/v1/lyricsEventBindings";

lyricsSettings.lyricsCanvasContext = lyricsGetCanvasContext(lyricsDom.canvasPreview);

lyricsBindEvents(lyricsDom);
lyricsInitializeApplication(lyricsDom);
