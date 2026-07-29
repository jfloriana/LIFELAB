const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
(async () => {
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(path.join(__dirname, 'data/clinica.db'));
  const db = new SQL.Database(buffer);
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log('Tables:', JSON.stringify(tables[0]?.values.map(r => r[0]) || []));
})();
