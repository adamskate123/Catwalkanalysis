import { program } from '../programs'
import { getImportOptions } from './importers'
import { isKeyTable, isWeightTable, pickTables, readFile, type ParsedTable } from './parse'

export interface LoadedFile {
  name: string
  tables: ParsedTable[]
  isKey: boolean
}

export const isBackupFile = (f: File) => /\.gaitlab(\.json)?$|\.json$/i.test(f.name)

/** Reads spreadsheets and Prism files into tables; returns human-readable messages for anything notable. */
export async function readSpreadsheets(list: File[]): Promise<{ files: LoadedFile[]; messages: { text: string; level: 'info' | 'warning' }[] }> {
  const files: LoadedFile[] = []
  const messages: { text: string; level: 'info' | 'warning' }[] = []
  const opts = getImportOptions()
  for (const f of list) {
    try {
      const sheets = await readFile(f, opts)
      for (const s of sheets) for (const text of s.notes ?? []) messages.push({ level: 'info', text })
      const tables = pickTables(sheets, opts)
      if (!tables.length || !tables.some((t) => t.rows.length)) throw new Error(`${f.name}: no data rows found.`)
      const isKey = tables.every(isKeyTable)
      if (tables.every(isWeightTable))
        messages.push({
          level: 'info',
          text: `${f.name}: body weights. Loaded with ${program().test} data, each animal's weight is matched by ID (and age window) and can be used as a covariate; loaded on its own, body weight is analysed like any parameter.`,
        })
      else if (isKey)
        messages.push({
          level: 'info',
          text: `${f.name}: no ${program().test} parameters found, so it will be used as an animal key. Its columns (e.g. genotype, sex, age) are joined to the data through a matching ID column such as the animal or trial name.`,
        })
      files.push({ name: f.name, tables, isKey })
    } catch (e) {
      messages.push({ level: 'warning', text: e instanceof Error ? e.message : `${f.name}: could not be read.` })
    }
  }
  return { files, messages }
}
