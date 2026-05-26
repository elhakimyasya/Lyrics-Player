import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderAnalyzer } from './lyricsRenderAnalyzer';
import { lyricsStorageSave } from './lyricsStorageSave';
import { lyricsStorageLoad } from './lyricsStorageLoad';
import { lyricsStorageFileLoad, lyricsStorageFileSave } from './lyricsStorageManager';
import { lyricsRenderPreviewFrame } from './lyricsCanvasRender';

const revokeCurrentBackgroundUrl = () => {
    const sourceUrl = lyricsSettings.lyricsResourceBackground?.element?.src;
    if (sourceUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(sourceUrl);
    }
};

export const lyricsCreateBackgroundResource = (backgroundUrl, backgroundType, onReady) => {
    if (backgroundType === 'image') {
        const imageElement = new Image();
        imageElement.onload = () => {
            lyricsSettings.lyricsResourceBackground = {
                type: 'image',
                element: imageElement,
            };

            onReady?.();
        };

        imageElement.src = backgroundUrl;

        return;
    }

    const videoElement = document.createElement('video');
    videoElement.src = backgroundUrl;
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.playsInline = true;
    videoElement.onloadeddata = () => {
        videoElement.play().catch(() => {
            //
        });

        lyricsSettings.lyricsResourceBackground = {
            type: 'video',
            element: videoElement,
        };

        onReady?.();
    };

    videoElement.load();
};

export const lyricsRestoreAudioAsset = async (audioElement) => {
    const savedAudioBlob = await lyricsStorageFileLoad(lyricsSettings.lyricsPersistenceKeys.audio);
    if (!savedAudioBlob) {
        return;
    }

    audioElement.src = URL.createObjectURL(savedAudioBlob);
    audioElement.load();

    lyricsRenderAnalyzer(audioElement);
};

export const lyricsRestoreBackgroundAsset = async (audioElement) => {
    const savedBackgroundBlob = await lyricsStorageFileLoad(lyricsSettings.lyricsPersistenceKeys.background);
    const savedBackgroundType = lyricsStorageLoad(lyricsSettings.lyricsPersistenceKeys.bgType, '');
    if (!savedBackgroundBlob || !savedBackgroundType) {
        return;
    }

    lyricsCreateBackgroundResource(URL.createObjectURL(savedBackgroundBlob), savedBackgroundType, () => {
        lyricsRenderPreviewFrame(audioElement);
    });
};

export const lyricsHandleAudioFileChange = async (event, audioElement) => {
    const audioFile = event.target.files?.[0];
    if (!audioFile) {
        return;
    }

    await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.audio, audioFile);

    audioElement.src = URL.createObjectURL(audioFile);
    audioElement.load();

    lyricsRenderAnalyzer(audioElement);

    lyricsSettings.lyricsExportFileName = audioFile.name.replace(/\.[^/.]+$/, '');
};

export const lyricsHandleBackgroundFileChange = async (event, audioElement) => {
    const backgroundFile = event.target.files?.[0];
    if (!backgroundFile) {
        return;
    }

    revokeCurrentBackgroundUrl();

    const backgroundType = backgroundFile.type.startsWith('image/') ? 'image' : 'video';

    await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.background, backgroundFile);

    lyricsStorageSave(lyricsSettings.lyricsPersistenceKeys.bgType, backgroundType);

    lyricsCreateBackgroundResource(URL.createObjectURL(backgroundFile), backgroundType, () => {
        lyricsRenderPreviewFrame(audioElement);
    });
};
