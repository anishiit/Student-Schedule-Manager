const DB_NAME = 'StudentScheduleDB';
const DB_VERSION = 1;
const STORE_NAME = 'scheduleData';

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject("Error opening database");

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      db.createObjectStore(STORE_NAME, { keyPath: 'id' });
    };
  });
}

export async function saveData(data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put({ id: 'scheduleData', ...data });

    request.onerror = () => reject("Error saving data");
    request.onsuccess = () => resolve();
  });
}

export async function loadData() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get('scheduleData');

    request.onerror = () => reject("Error loading data");
    request.onsuccess = () => resolve(request.result);
  });
}
