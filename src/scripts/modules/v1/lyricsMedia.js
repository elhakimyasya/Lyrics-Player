import { lyricsSettings } from './lyricsCore';
import { lyricsRenderingEffectsRenderAnalyzer } from './lyricsRenderingEffects';
import { lyricsStorageSave } from './lyricsStorage';
import { lyricsStorageLoad } from './lyricsStorage';
import { lyricsStorageFileLoad, lyricsStorageFileSave } from './lyricsStorage';
import { lyricsLoopsRenderPreviewFrame } from './lyricsLoops';

const mediaRevokeCurrentBackgroundObjectUrl = () => {
    const sourceUrl = lyricsSettings.lyricsResourceBackground?.element?.src;
    if (sourceUrl?.startsWith(lyricsSettings.lyricsBlobUrlPrefix)) {
        URL.revokeObjectURL(sourceUrl);
    }
};

export const lyricsMediaCreateBackgroundResource = (backgroundUrl, backgroundType, onReady) => {
    if (backgroundType === lyricsSettings.lyricsMediaTypes.image) {
        const imageElement = new Image();
        imageElement.onload = () => {
            lyricsSettings.lyricsResourceBackground = {
                type: lyricsSettings.lyricsMediaTypes.image,
                element: imageElement,
            };

            onReady?.();
        };

        imageElement.src = backgroundUrl;

        return;
    }

    const videoElement = document.createElement(lyricsSettings.lyricsVideoElementTag);
    videoElement.src = backgroundUrl;
    videoElement.muted = true;
    videoElement.loop = true;
    videoElement.playsInline = true;
    videoElement.onloadeddata = () => {
        videoElement.play().catch(() => {
            //
        });

        lyricsSettings.lyricsResourceBackground = {
            type: lyricsSettings.lyricsMediaTypes.video,
            element: videoElement,
        };

        onReady?.();
    };

    videoElement.load();
};

export const lyricsMediaRestoreIntroAsset = async (inputElement) => {
    const savedIntroBlob = await lyricsStorageFileLoad(lyricsSettings.lyricsPersistenceKeys.intro);
    if (!savedIntroBlob || !(savedIntroBlob instanceof Blob) || !savedIntroBlob.type) {
        return;
    }

    try {
        const introFile = new File([savedIntroBlob], savedIntroBlob.name || 'intro', { type: savedIntroBlob.type });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(introFile);
        inputElement.files = dataTransfer.files;
    } catch (errorEvent) {
        console.warn('Failed to restore intro file:', errorEvent);
    }
};

export const lyricsMediaRestoreAudioAsset = async (audioElement) => {
    const savedAudioBlob = await lyricsStorageFileLoad(lyricsSettings.lyricsPersistenceKeys.audio);
    if (!savedAudioBlob) {
        return;
    }

    audioElement.src = URL.createObjectURL(savedAudioBlob);
    audioElement.load();

    lyricsRenderingEffectsRenderAnalyzer(audioElement);
};

export const lyricsMediaRestoreBackgroundAsset = async (audioElement) => {
    const savedBackgroundBlob = await lyricsStorageFileLoad(lyricsSettings.lyricsPersistenceKeys.background);
    const savedBackgroundType = lyricsStorageLoad(lyricsSettings.lyricsPersistenceKeys.bgType, '');
    if (!savedBackgroundBlob || !savedBackgroundType) {
        return;
    }

    lyricsMediaCreateBackgroundResource(URL.createObjectURL(savedBackgroundBlob), savedBackgroundType, () => {
        lyricsLoopsRenderPreviewFrame(audioElement);
    });
};

export const lyricsMediaRemoveAudioAsset = async (audioElement) => {
    await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.audio, null);
    audioElement.src = '';
    audioElement.load();
    const inputElement = document.querySelector(lyricsSettings.elementSelectorInputAudio);
    if (inputElement) inputElement.value = '';
};

export const lyricsMediaRemoveBackgroundAsset = async (audioElement) => {
    mediaRevokeCurrentBackgroundObjectUrl();
    await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.background, null);
    lyricsStorageSave(lyricsSettings.lyricsPersistenceKeys.bgType, '');
    lyricsSettings.lyricsResourceBackground = null;
    const inputElement = document.querySelector(lyricsSettings.elementSelectorInputBackground);
    if (inputElement) inputElement.value = '';
    lyricsLoopsRenderPreviewFrame(audioElement);
};

export const lyricsMediaRemoveIntroAsset = async () => {
    await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.intro, null);
    const inputElement = document.querySelector(lyricsSettings.elementSelectorInputIntro);
    if (inputElement) inputElement.value = '';
};

export const lyricsMediaHandleAudioFileChange = async (inputEvent, audioElement) => {
    const audioFile = inputEvent.target.files?.[0];
    if (!audioFile) {
        return;
    }

    await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.audio, audioFile);

    audioElement.src = URL.createObjectURL(audioFile);
    audioElement.load();

    lyricsRenderingEffectsRenderAnalyzer(audioElement);

    lyricsSettings.lyricsExportFileName = audioFile.name.replace(/\.[^/.]+$/, '');
};

export const lyricsMediaHandleIntroFileChange = async (inputEvent) => {
    const introFile = inputEvent.target.files?.[0];
    if (!introFile || !introFile.type.startsWith('audio/') && !introFile.type.startsWith('video/')) {
        return;
    }

    try {
        await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.intro, introFile);
    } catch (errorEvent) {
        console.warn('Failed to save intro file:', errorEvent);
    }
};

export const lyricsMediaHandleBackgroundFileChange = async (inputEvent, audioElement) => {
    const backgroundFile = inputEvent.target.files?.[0];
    if (!backgroundFile) {
        return;
    }

    mediaRevokeCurrentBackgroundObjectUrl();

    const backgroundType = backgroundFile.type.startsWith(lyricsSettings.lyricsImageMimePrefix) ? lyricsSettings.lyricsMediaTypes.image : lyricsSettings.lyricsMediaTypes.video;

    await lyricsStorageFileSave(lyricsSettings.lyricsPersistenceKeys.background, backgroundFile);

    lyricsStorageSave(lyricsSettings.lyricsPersistenceKeys.bgType, backgroundType);

    lyricsMediaCreateBackgroundResource(URL.createObjectURL(backgroundFile), backgroundType, () => {
        lyricsLoopsRenderPreviewFrame(audioElement);
    });
};

export const lyricsMediaEnsureAudioContextActive = async () => {
    if (!lyricsSettings.lyricsAudioContext || lyricsSettings.lyricsAudioContext.state !== 'suspended') {
        return;
    }

    try {
        await lyricsSettings.lyricsAudioContext.resume();
    } catch (errorEvent) {
        console.error('Failed to resume AudioContext:', errorEvent);
    }
};

export const lyricsMediaGetAudioState = (audioElement) => {
    return new Promise((resolve, reject) => {
        if (audioElement.readyState >= lyricsSettings.lyricsAudioReadyStateCanPlay) return resolve();

        const handleCanPlay = () => {
            cleanupListeners();

            resolve();
        };

        const handleError = () => {
            cleanupListeners();

            reject(new Error('Audio resource failed to load.'));
        };

        const cleanupListeners = () => {
            audioElement.removeEventListener('canplay', handleCanPlay);
            audioElement.removeEventListener('errorEvent', handleError);
        };

        audioElement.addEventListener('canplay', handleCanPlay);
        audioElement.addEventListener('errorEvent', handleError);
    });
};
