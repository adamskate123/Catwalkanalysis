// mdb-reader needs browserify-aes (and create-hash, see mdbHash.ts) only to open password-protected
// databases. PAS never writes those, and the real modules pull Node streams into the
// browser build, so the app bundles these stand-ins (see vite.config.ts).

const unsupported = () => {
  throw new Error('Password-protected Access databases are not supported. Remove the password in Access, or export the data to Excel.')
}

export const createDecipheriv = unsupported
export default { createDecipheriv: unsupported }
