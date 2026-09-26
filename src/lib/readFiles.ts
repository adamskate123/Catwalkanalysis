import { matchColumn } from './catalog'
import { pickTables, readFile, type ParsedTable } from './parse'

export interface LoadedFile {
  name: string
  tables: ParsedTable[]
  isKey: boolean
}

export const isBackupFile = (f: File) => /\.gaitlab(\.json)?$|\.json$/i.test(f.name)

/** Reads spreadsheets into tables; returns human-readable messages for anything notable. */
export async function readSpreadsheets(list: File[]): Promise<{ files: LoadedFile[]; messages: { text: string; level: 'info' | 'warning' }[] }> {
  const files: LoadedFile[] = []
  const messages: { text: string; level: 'info' | 'warning' }[] = []
  for (const f of list) {
    try {
      const tables = pickTables(await readFile(f))
      if (!tables.length || !tables.some((t) => t.rows.length)) throw new Error(`${f.name}: no data rows found.`)
      const recognised = tables.reduce((s, t) => s + t.headers.filter((h) => matchColumn(h)).length, 0)
      const isKey = recognised < 3
      if (isKey)
        messages.push({
          level: 'info',
          text: `${f.name}: no CatWalk parameters found, so it will be used as an animal key. Its columns (e.g. genotype, sex, age) are joined to the gait data through a matching ID column such as the trial name.`,
        })
      files.push({ name: f.name, tables, isKey })
    } catch (e) {
      messages.push({ level: 'warning', text: e instanceof Error ? e.message : `${f.name}: could not be read.` })
    }
  }
  return { files, messages }
}
