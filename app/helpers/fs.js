import path from 'node:path'
import {fileURLToPath} from 'node:url'

export function getReportsDirPath() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'reports')
}

export function getReportDirPath(folder) {
  return path.join(getReportsDirPath(), folder)
}

export function getReportFilePath(folder, name) {
  return path.join(getReportDirPath(folder), `${name}.json`)
}
