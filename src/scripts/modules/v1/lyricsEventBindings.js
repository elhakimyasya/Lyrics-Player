import { lyricsBindColorInputEvents } from './lyricsEventColorInputs';
import { lyricsBindControlEvents } from './lyricsEventControls';
import { lyricsBindMediaInputEvents } from './lyricsEventMediaInputs';
import { lyricsBindPlayerEvents } from './lyricsEventPlayer';
import { lyricsBindTextInputEvents } from './lyricsEventTextInputs';

export const lyricsBindEvents = (dom) => {
    lyricsBindColorInputEvents(dom);
    lyricsBindTextInputEvents(dom);
    lyricsBindMediaInputEvents(dom);
    lyricsBindControlEvents(dom);
    lyricsBindPlayerEvents(dom);
};
