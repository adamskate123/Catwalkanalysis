// See mdbCrypto.ts: create-hash is only used for password-protected databases.
export default function createHash(): never {
  throw new Error('Password-protected Access databases are not supported. Remove the password in Access, or export the data to Excel.')
}
