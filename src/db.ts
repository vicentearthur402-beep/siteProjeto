import { Database } from "bun:sqlite";

const db = new Database("database.sqlite")

const query = db.query(`
    CREATE TABLE IF NOT EXISTS user (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        email   TEXT NOT NULL UNIQUE,
        username        TEXT NOT NULL UNIQUE,
        password_hash   TEXT NOT NULL
    );
`);


const query2 = db.query(
  `
  
  CREATE TABLE IF NOT EXISTS ligas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT NOT NULL,
    data_criacao date NOT NULL
);
`,
);

const query3 = db.query(
  `
  CREATE TABLE IF NOT EXISTS times (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE,
  liga_id INTEGER NOT NULL,
  FOREIGN KEY (liga_id) REFERENCES ligas(id)
);
`,
);

query.run();
query2.run();
query3.run();

export { db }
export default db