import { lyricsSettings } from './lyricsSettings';

const openDatabase = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(lyricsSettings.lyricsDatabaseName, lyricsSettings.lyricsDatabaseVersion);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(lyricsSettings.lyricsDatabaseStoreName);
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const lyricsStorageFileSave = async (key, blob) => {
    const db = await openDatabase();
    const transaction = db.transaction(lyricsSettings.lyricsDatabaseStoreName, lyricsSettings.lyricsDatabaseReadWriteMode);

    transaction.objectStore(lyricsSettings.lyricsDatabaseStoreName).put(blob, key);
};

export const lyricsStorageFileLoad = async (key) => {
    const db = await openDatabase();
    
    return new Promise((resolve) => {
        const request = db.transaction(lyricsSettings.lyricsDatabaseStoreName).objectStore(lyricsSettings.lyricsDatabaseStoreName).get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
};
