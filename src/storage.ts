export type Answers = Record<string, string>
export type SpotRecord = { id: string; photo: Blob; answers: Answers; createdAt: string }
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('skincheck', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('records', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
export async function readRecord(): Promise<SpotRecord | undefined> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const request = db.transaction('records').objectStore('records').get('spot')
    request.onsuccess = () => { db.close(); resolve(request.result) }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}
export async function writeRecord(record?: SpotRecord): Promise<void> {
  const db = await database()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('records', 'readwrite')
    const store = transaction.objectStore('records')
    if (record) store.put(record); else store.delete('spot')
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
    transaction.onabort = () => { db.close(); reject(transaction.error) }
  })
}
