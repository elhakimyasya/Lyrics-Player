import { lyricsSettings } from "./modules/lyricsSettings";
import { lyricsDom, lyricsGetCanvasContext } from "./modules/lyricsDom";
import { lyricsInitializeApplication } from "./modules/lyricsAppInit";
import { lyricsBindEvents } from "./modules/lyricsEventBindings";

lyricsSettings.lyricsCanvasContext = lyricsGetCanvasContext(lyricsDom.canvasPreview);

lyricsBindEvents(lyricsDom);
lyricsInitializeApplication(lyricsDom);
