export const lyricsStorageLoad = (storageKey, storageFallback = '') => {
    return localStorage.getItem(storageKey) ?? storageFallback;
};