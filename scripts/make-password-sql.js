// Generates UPDATE statements that give the seed users real bcrypt hashes.
// Usage: node scripts/make-password-sql.js > sql/local_passwords.sql
// The output file is git-ignored. Demo password for every user: Password@123
const bcrypt = require("bcryptjs");
for (const name of ["admin", "jaanhavi", "kushi", "ravi"]) {
  const hash = bcrypt.hashSync("Password@123", 10);
  console.log(`UPDATE users SET password_hash='${hash}' WHERE email='${name}@tracevault.io';`);
}
