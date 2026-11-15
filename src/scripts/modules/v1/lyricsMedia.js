import { lyricsSettings } from './lyricsSettings';
import { lyricsRenderingEffectsRenderAnalyzer } from './lyricsRenderingEffects';
import { lyricsStorageSave } from './lyricsStorage';
import { lyricsStorageLoad } from './lyricsStorage';
import { lyricsStorageFileLoad, lyricsStorageFileSave } from './lyricsStorage';
import { lyricsLoopsRenderPreviewFrame } from './lyricsLoops';

const mediaRevokeCurrentBackgroundObjectUrl = () => {
    const sourceUrl = lyricsSettings.state.backgroundResource?.element?.src;
    if (sourceUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(sourceUrl);
    }
};

export const lyricsMediaUpdateRemoveButtonVisibility = () => {
    const audioElement = document.querySelector(lyricsSettings.selectors.elementAudio);
    const buttonRemoveAudio = document.querySelector(lyricsSettings.selectors.elementButton.removeAudio);
    const buttonRemoveBackground = document.querySelector(lyricsSettings.selectors.elementButton.removeBackground);
    const buttonRemoveIntro = document.querySelector(lyricsSettings.selectors.elementButton.removeIntro);
    const inputIntro = document.querySelector(lyricsSettings.selectors.elementInput.intro);

    buttonRemoveAudio?.classList.toggle('hidden', !audioElement.src);
    buttonRemoveBackground?.classList.toggle('hidden', !lyricsSettings.state.backgroundResource);
    buttonRemoveIntro?.classList.toggle('hidden', !(inputIntro?.files?.length > 0));
};

export const lyricsMediaCreateBackgroundResource = (backgroundUrl, backgroundType, onReady) => {
    if (backgroundType === lyricsSettings.media.types.image) {
        const imageElement = new Image();
        imageElement.onload = () => {
            lyricsSettings.state.backgroundResource = {
                type: lyricsSettings.media.types.image,
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

        lyricsSettings.state.backgroundResource = {
            type: lyricsSettings.media.types.video,
            element: videoElement,
        };

        onReady?.();
    };

    videoElement.load();
};

export const lyricsMediaRestoreIntroAsset = async (inputElement) => {
    const savedIntroBlob = await lyricsStorageFileLoad(lyricsSettings.storage.persistenceKeys.intro);
    if (!savedIntroBlob || !(savedIntroBlob instanceof Blob) || !savedIntroBlob.type) {
        return;
    }

    try {
        const introFile = new File([savedIntroBlob], savedIntroBlob.name || 'intro', { type: savedIntroBlob.type });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(introFile);
        inputElement.files = dataTransfer.files;
    } catch (errorEvent) {
        console.warn(lyricsSettings.messages.media.restoreIntroFailed, errorEvent);
    }
};

export const lyricsMediaRestoreAudioAsset = async (audioElement) => {
    const savedAudioBlob = await lyricsStorageFileLoad(lyricsSettings.storage.persistenceKeys.audio);
    if (!savedAudioBlob) {
        return;
    }

    audioElement.src = URL.createObjectURL(savedAudioBlob);
    audioElement.load();

    lyricsRenderingEffectsRenderAnalyzer(audioElement);
};

export const lyricsMediaRestoreBackgroundAsset = async (audioElement) => {
    const savedBackgroundBlob = await lyricsStorageFileLoad(lyricsSettings.storage.persistenceKeys.background);
    const savedBackgroundType = lyricsStorageLoad(lyricsSettings.storage.persistenceKeys.backgroundType, '');
    if (!savedBackgroundBlob || !savedBackgroundType) {
        return;
    }

    lyricsMediaCreateBackgroundResource(URL.createObjectURL(savedBackgroundBlob), savedBackgroundType, () => {
        lyricsLoopsRenderPreviewFrame(audioElement);
    });
};

export const lyricsMediaRemoveAudioAsset = async (audioElement) => {
    await lyricsStorageFileSave(lyricsSettings.storage.persistenceKeys.audio, null);
    audioElement.src = '';
    audioElement.load();
    const inputElement = document.querySelector(lyricsSettings.selectors.elementInput.audio);
    if (inputElement) inputElement.value = '';
    lyricsMediaUpdateRemoveButtonVisibility();
};

export const lyricsMediaRemoveBackgroundAsset = async (audioElement) => {
    mediaRevokeCurrentBackgroundObjectUrl();
    await lyricsStorageFileSave(lyricsSettings.storage.persistenceKeys.background, null);
    lyricsStorageSave(lyricsSettings.storage.persistenceKeys.backgroundType, '');
    lyricsSettings.state.backgroundResource = null;
    const inputElement = document.querySelector(lyricsSettings.selectors.elementInput.background);
    if (inputElement) inputElement.value = '';
    lyricsLoopsRenderPreviewFrame(audioElement);
    lyricsMediaUpdateRemoveButtonVisibility();
};

export const lyricsMediaRemoveIntroAsset = async () => {
    await lyricsStorageFileSave(lyricsSettings.storage.persistenceKeys.intro, null);
    const inputElement = document.querySelector(lyricsSettings.selectors.elementInput.intro);
    if (inputElement) inputElement.value = '';
    lyricsMediaUpdateRemoveButtonVisibility();
};

export const lyricsMediaHandleAudioFileChange = async (inputEvent, audioElement) => {
    const audioFile = inputEvent.target.files?.[0];
    if (!audioFile) {
        return;
    }

    await lyricsStorageFileSave(lyricsSettings.storage.persistenceKeys.audio, audioFile);

    audioElement.src = URL.createObjectURL(audioFile);
    audioElement.load();

    lyricsRenderingEffectsRenderAnalyzer(audioElement);

    lyricsSettings.export.fileName = audioFile.name.replace(/\.[^/.]+$/, '');
    lyricsMediaUpdateRemoveButtonVisibility();
};

export const lyricsMediaHandleIntroFileChange = async (inputEvent) => {
    const introFile = inputEvent.target.files?.[0];
    if (!introFile || !introFile.type.startsWith('audio/') && !introFile.type.startsWith('video/')) {
        return;
    }

    try {
        await lyricsStorageFileSave(lyricsSettings.storage.persistenceKeys.intro, introFile);
        lyricsMediaUpdateRemoveButtonVisibility();
    } catch (errorEvent) {
        console.warn(lyricsSettings.messages.media.saveIntroFailed, errorEvent);
    }
};

export const lyricsMediaHandleBackgroundFileChange = async (inputEvent, audioElement) => {
    const backgroundFile = inputEvent.target.files?.[0];
    if (!backgroundFile) {
        return;
    }

    mediaRevokeCurrentBackgroundObjectUrl();

    const backgroundType = backgroundFile.type.startsWith('image/') ? lyricsSettings.media.types.image : lyricsSettings.media.types.video;

    await lyricsStorageFileSave(lyricsSettings.storage.persistenceKeys.background, backgroundFile);

    lyricsStorageSave(lyricsSettings.storage.persistenceKeys.backgroundType, backgroundType);

    lyricsMediaCreateBackgroundResource(URL.createObjectURL(backgroundFile), backgroundType, () => {
        lyricsLoopsRenderPreviewFrame(audioElement);
        lyricsMediaUpdateRemoveButtonVisibility();
    });
};

export const lyricsMediaEnsureAudioContextActive = async () => {
    if (!lyricsSettings.audio.context || lyricsSettings.audio.context.state !== 'suspended') {
        return;
    }

    try {
        await lyricsSettings.audio.context.resume();
    } catch (errorEvent) {
        console.error(lyricsSettings.messages.media.resumeAudioContextFailed, errorEvent);
    }
};

export const lyricsMediaGetAudioState = (audioElement) => {
    return new Promise((resolve, reject) => {
        if (audioElement.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return resolve();
        if (audioElement.error) return reject(new Error(lyricsSettings.messages.media.audioLoadFailed));

        const handleCanPlay = () => {
            cleanupListeners();

            resolve();
        };

        const handleError = () => {
            cleanupListeners();

            reject(new Error(lyricsSettings.messages.media.audioLoadFailed));
        };

        const cleanupListeners = () => {
            audioElement.removeEventListener('canplay', handleCanPlay);
            audioElement.removeEventListener('error', handleError);
        };

        audioElement.addEventListener('canplay', handleCanPlay);
        audioElement.addEventListener('error', handleError);
    });
};
