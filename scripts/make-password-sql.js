// Generates ONE statement that gives every user who still has a placeholder hash a real bcrypt hash.
// It does not depend on names or emails, so renaming or adding seed users never breaks it.
// Usage: node scripts/make-password-sql.js > sql/local_passwords.sql
// The output file is git-ignored. Demo password for every user: Password@123
const bcrypt = require("bcryptjs");
const hash = bcrypt.hashSync("Password@123", 10);
console.log(`UPDATE users SET password_hash='${hash}' WHERE password_hash LIKE '$2b$10$PLACEHOLDER%';`);
