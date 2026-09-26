// IndexedDB persistence for saved experiments. Data stays in this browser on
// this device; backups (see experiment.ts) move it between devices.

import { summarise, type Experiment, type ExperimentSummary } from './experiment'

const DB = 'gaitlab'
const STORE = 'experiments'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('Saving is not available in this browser.'))
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('Could not open storage.'))
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode)
      const req = fn(t.objectStore(STORE))
      t.oncomplete = () => resolve(req.result)
      t.onerror = () => reject(t.error ?? req.error ?? new Error('Storage error.'))
      t.onabort = () => reject(t.error ?? new Error('Storage is full or unavailable.'))
    })
  } finally {
    db.close()
  }
}

export async function listExperiments(): Promise<ExperimentSummary[]> {
  const all = await tx<Experiment[]>('readonly', (s) => s.getAll() as IDBRequest<Experiment[]>)
  return all.map(summarise).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export function getExperiment(id: string): Promise<Experiment | undefined> {
  return tx<Experiment | undefined>('readonly', (s) => s.get(id) as IDBRequest<Experiment | undefined>)
}

export async function saveExperiment(e: Experiment): Promise<void> {
  await tx('readwrite', (s) => s.put(e))
}

export async function deleteExperiment(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

/** Asks the browser not to evict saved data under storage pressure (important on iOS). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
