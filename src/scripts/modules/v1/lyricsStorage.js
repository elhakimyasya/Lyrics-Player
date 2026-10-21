import { lyricsSettings } from './lyricsCore';

export const lyricsStorageLoad = (storageKey, storageFallback = '') => {
    return localStorage.getItem(storageKey) ?? storageFallback;
};

const storageOpenDatabase = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(lyricsSettings.lyricsDatabaseName, lyricsSettings.lyricsDatabaseVersion);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(lyricsSettings.lyricsDatabaseStoreName);
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.errorEvent);
    });
};

export const lyricsStorageFileSave = async (key, fileBlob) => {
    const database = await storageOpenDatabase();
    const transaction = database.transaction(lyricsSettings.lyricsDatabaseStoreName, lyricsSettings.lyricsDatabaseReadWriteMode);

    transaction.objectStore(lyricsSettings.lyricsDatabaseStoreName).put(fileBlob, key);
};

export const lyricsStorageFileLoad = async (key) => {
    const database = await storageOpenDatabase();
    
    return new Promise((resolve) => {
        const request = database.transaction(lyricsSettings.lyricsDatabaseStoreName).objectStore(lyricsSettings.lyricsDatabaseStoreName).get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
};

export const lyricsStorageSave = (storageKey, storageValue) => {
    localStorage.setItem(storageKey, storageValue);
};
