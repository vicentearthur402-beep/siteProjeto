
import { Database } from "bun:sqlite";

const db = new Database("database.sqlite");

// ==========================================
// USUÁRIOS
// ==========================================

db.run(`
    CREATE TABLE IF NOT EXISTS user (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL
    );
`);

// ==========================================
// LIGAS
// ==========================================

db.run(`
    CREATE TABLE IF NOT EXISTS ligas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT NOT NULL,
        data_criacao DATE NOT NULL,
        usuario_id INTEGER NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES user(id),
        UNIQUE (nome, usuario_id)
    );
`);

// Compatibilidade com bancos antigos
const colunasLigas = db.query(
  "PRAGMA table_info(ligas)"
).all() as { name: string }[];

if (!colunasLigas.some(coluna => coluna.name === "usuario_id")) {
  db.run(`
        ALTER TABLE ligas
        ADD COLUMN usuario_id INTEGER REFERENCES user(id)
    `);
}

// ==========================================
// TIMES
// ==========================================

db.run(`
    CREATE TABLE IF NOT EXISTS times (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        usuario_id INTEGER NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES user(id),
        UNIQUE (nome, usuario_id)
    );
`);

// ==========================================
// TREINADORES
// ==========================================

db.run(`
    CREATE TABLE IF NOT EXISTS treinadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        usuario_id INTEGER NOT NULL,
        FOREIGN KEY (usuario_id) REFERENCES user(id)
    );
`);

// ==========================================
// HISTÓRICO DE TREINADORES DOS TIMES
// ==========================================

db.run(`
    CREATE TABLE IF NOT EXISTS time_treinadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        time_id INTEGER NOT NULL,
        treinador_id INTEGER NOT NULL,
        inicio DATE NOT NULL,
        fim DATE,

        FOREIGN KEY (time_id) REFERENCES times(id),
        FOREIGN KEY (treinador_id) REFERENCES treinadores(id),

        CHECK (fim IS NULL OR fim >= inicio)
    );
`);

// ==========================================
// PARTIDAS
// ==========================================

db.run(`
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
`);

// ==========================================
// TREINADORES POR PARTIDA
// ==========================================

db.run(`
    CREATE TABLE IF NOT EXISTS partida_treinadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        partida_id INTEGER NOT NULL,
        time_id INTEGER NOT NULL,
        treinador_id INTEGER,

        FOREIGN KEY (partida_id) REFERENCES partidas(id),
        FOREIGN KEY (time_id) REFERENCES times(id),
        FOREIGN KEY (treinador_id) REFERENCES treinadores(id),

        UNIQUE (partida_id, time_id)
    );
`);

// ==========================================
// JOGADORES
// ==========================================

db.run(`
    CREATE TABLE IF NOT EXISTS jogadores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        numero INTEGER,
        posicao TEXT NOT NULL,
        time_id INTEGER NOT NULL,
        FOREIGN KEY (time_id) REFERENCES times(id),
        UNIQUE (time_id, numero)
    );
`);

// ==========================================
// RELAÇÃO ENTRE LIGAS E TIMES
// ==========================================

db.run(`
    CREATE TABLE IF NOT EXISTS liga_times (
        liga_id INTEGER NOT NULL,
        time_id INTEGER NOT NULL,
        PRIMARY KEY (liga_id, time_id),
        FOREIGN KEY (liga_id) REFERENCES ligas(id),
        FOREIGN KEY (time_id) REFERENCES times(id)
    );
`);

db.run(`
  CREATE TABLE IF NOT EXISTS estatisticas_partida (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    partida_id INTEGER NOT NULL,
    jogador_id INTEGER NOT NULL,
    gols INTEGER NOT NULL DEFAULT 0,
    assistencias INTEGER NOT NULL DEFAULT 0,
    amarelos INTEGER NOT NULL DEFAULT 0,
    vermelhos INTEGER NOT NULL DEFAULT 0,

    FOREIGN KEY (partida_id) REFERENCES partidas(id),
    FOREIGN KEY (jogador_id) REFERENCES jogadores(id),

    UNIQUE (partida_id, jogador_id),

    CHECK (gols >= 0),
    CHECK (assistencias >= 0),
    CHECK (amarelos >= 0),
    CHECK (vermelhos >= 0)
);`)

// ==========================================
// MIGRAÇÃO DOS TIMES ANTIGOS
// ==========================================

const colunasTimes = db.query(
  "PRAGMA table_info(times)"
).all() as { name: string }[];

if (colunasTimes.some(coluna => coluna.name === "liga_id")) {

  // Verifica se existem times sem um usuário identificável
  const timesSemUsuario = db.query(`
        SELECT COUNT(*) AS total
        FROM times
        LEFT JOIN ligas
            ON ligas.id = times.liga_id
        WHERE ligas.usuario_id IS NULL
    `).get() as { total: number };

  if (timesSemUsuario.total > 0) {
    throw new Error(
      `Migração interrompida: existem ${timesSemUsuario.total} time(s) sem usuário associado. Verifique os usuários das ligas antigas antes de continuar.`
    );
  }

  db.run("PRAGMA foreign_keys = OFF");

  try {
    const migrar = db.transaction(() => {

      db.run("DROP TABLE IF EXISTS times_novo");

      // Cria a nova estrutura
      db.run(`
                CREATE TABLE times_novo (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    nome TEXT NOT NULL,
                    usuario_id INTEGER NOT NULL,
                    FOREIGN KEY (usuario_id) REFERENCES user(id),
                    UNIQUE (nome, usuario_id)
                );
            `);

      // Copia os times preservando os IDs
      db.run(`
                INSERT INTO times_novo (id, nome, usuario_id)
                SELECT
                    times.id,
                    times.nome,
                    ligas.usuario_id
                FROM times
                INNER JOIN ligas
                    ON ligas.id = times.liga_id;
            `);

      // Preserva os vínculos antigos
      db.run(`
                INSERT OR IGNORE INTO liga_times (liga_id, time_id)
                SELECT liga_id, id
                FROM times;
            `);

      // Substitui a tabela antiga
      db.run("DROP TABLE times");

      db.run(`
                ALTER TABLE times_novo
                RENAME TO times;
            `);
    });

    migrar();

  } finally {
    db.run("PRAGMA foreign_keys = ON");
  }
}

export { db };
export default db;
