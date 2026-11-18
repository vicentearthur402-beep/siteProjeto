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
    data_criacao date NOT NULL,
    usuario_id INTEGER NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES user(id),
    UNIQUE (nome, usuario_id)
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

const query4 = db.query(
  `
CREATE TABLE IF NOT EXISTS partidas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    liga_id INTEGER NOT NULL,

    mandante_id INTEGER NOT NULL,
    visitante_id INTEGER NOT NULL,

    turno INTEGER NOT NULL,
    rodada INTEGER NOT NULL,

    gols_mandante INTEGER,
    gols_visitante INTEGER,

    FOREIGN KEY (liga_id) REFERENCES ligas(id),
    FOREIGN KEY (mandante_id) REFERENCES times(id),
    FOREIGN KEY (visitante_id) REFERENCES times(id),

    CHECK (mandante_id <> visitante_id),
    CHECK (turno IN (1, 2)),

    UNIQUE (liga_id, turno, rodada, mandante_id, visitante_id)
);
`
)

const colunas = db.query("PRAGMA table_info(ligas)").all() as { name: string }[];


query.run();
query2.run();
query3.run();
query4.run();

if(!colunas.some(coluna => coluna.name === "usuario_id")) {
  db.run(`
    ALTER TABLE ligas
    ADD COLUMN usuario_id INTEGER REFERENCES user(id)`)
}

export { db }
export default db