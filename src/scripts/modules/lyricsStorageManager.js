const databaseName = "LyricsAppDB";
const storeName = "AssetsStore";

const openDatabase = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1);
        request.onupgradeneeded = () => {
            request.result.createObjectStore(storeName);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const lyricsStorageFileSave = async (key, blob) => {
    const db = await openDatabase();
    const transaction = db.transaction(storeName, "readwrite");
    transaction.objectStore(storeName).put(blob, key);
};

export const lyricsStorageFileLoad = async (key) => {
    const db = await openDatabase();
    return new Promise((resolve) => {
        const request = db.transaction(storeName).objectStore(storeName).get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
    });
};