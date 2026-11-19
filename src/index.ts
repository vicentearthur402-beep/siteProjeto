
import { db } from "./db.ts";

import login from "./index.html";
import home from "./home.html";
import ligas from "./ligas.html";
import liga from "./liga.html";
import times from "./times.html";
import partidas from "./partidas.html";
import jogos from "./jogos.html";
import jogadores from "./jogadores.html";

const logger: any = {};

const srv = Bun.serve({
    port: 3000,

    routes: {
        // ==========================================
        // PÁGINAS
        // ==========================================

        "/": login,
        "/home": home,
        "/ligas": ligas,
        "/liga": liga,
        "/times": times,
        "/partidas": partidas,
        "/jogos": jogos,
        "/jogadores": jogadores,

        // ==========================================
        // CADASTRO DE USUÁRIO
        // ==========================================

        "/register": {
            POST: async (req) => {
                try {
                    const body = await req.json();

                    const username = String(body.username ?? "").trim();
                    const email = String(body.email ?? "").trim();
                    const password = String(body.password ?? "");

                    if (!username || !email || !password) {
                        return Response.json(
                            { msg: "Preencha todos os campos." },
                            { status: 400 }
                        );
                    }

                    const hash = await Bun.password.hash(password);

                    const query = db.query(`
                        INSERT INTO user (username, email, password_hash)
                        VALUES (:username, :email, :password_hash)
                    `);

                    const resultado = query.run({
                        ":username": username,
                        ":email": email,
                        ":password_hash": hash
                    });

                    return Response.json({
                        msg: "Usuário cadastrado com sucesso!",
                        id: resultado.lastInsertRowid
                    }, { status: 201 });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { msg: "Não foi possível cadastrar. Verifique se o usuário ou e-mail já existem." },
                        { status: 409 }
                    );
                }
            }
        },

        // ==========================================
        // LOGIN
        // ==========================================

        "/login": {
            POST: async (req) => {
                try {
                    const body = await req.json();

                    const query = db.query(`
                        SELECT *
                        FROM user
                        WHERE username = :username
                        LIMIT 1
                    `);

                    const data: any = query.get({
                        ":username": body.username
                    });

                    if (!data) {
                        return Response.json(
                            { msg: "Usuário não encontrado." },
                            { status: 404 }
                        );
                    }

                    const ismatch = await Bun.password.verify(
                        body.password,
                        data.password_hash
                    );

                    if (!ismatch) {
                        return Response.json(
                            { msg: "Senha incorreta." },
                            { status: 401 }
                        );
                    }

                    const uuid = crypto.randomUUID();

                    delete data.password_hash;

                    logger[uuid] = data;

                    req.cookies.set("ses", uuid);

                    return Response.json({
                        msg: "Login realizado com sucesso!",
                        usuario: data
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { msg: "Erro ao realizar login." },
                        { status: 500 }
                    );
                }
            }
        },

        // ==========================================
        // USUÁRIO LOGADO
        // ==========================================

        "/login/user": (req) => {
            const ses = req.cookies.get("ses") as string;
            const data = logger[ses];

            if (!ses || !data) {
                return Response.json(
                    { msg: "Usuário não logado." },
                    { status: 401 }
                );
            }

            return Response.json(data);
        },

        // ==========================================
        // LIGAS
        // ==========================================

        "/api/ligas": {
            // LISTAR LIGAS
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const query = db.query(`
                    SELECT
                        ligas.*,
                        COUNT(liga_times.time_id) AS times
                    FROM ligas
                    LEFT JOIN liga_times
                        ON liga_times.liga_id = ligas.id
                    WHERE ligas.usuario_id = :usuario_id
                    GROUP BY ligas.id
                    ORDER BY ligas.id DESC
                `);

                const resultado = query.all({
                    ":usuario_id": usuario.id
                });

                return Response.json(resultado);
            },

            // CADASTRAR LIGA
            POST: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                try {
                    const body = await req.json();

                    const nome = String(body.nome ?? "").trim();
                    const descricao = String(body.descricao ?? "").trim();

                    if (!nome || !descricao) {
                        return Response.json(
                            { msg: "Preencha o nome e a descrição." },
                            { status: 400 }
                        );
                    }

                    const query = db.query(`
                        INSERT INTO ligas (
                            nome,
                            descricao,
                            data_criacao,
                            usuario_id
                        )
                        VALUES (
                            :nome,
                            :descricao,
                            :data_criacao,
                            :usuario_id
                        )
                    `);

                    const resultado = query.run({
                        ":nome": nome,
                        ":descricao": descricao,
                        ":data_criacao": new Date().toISOString().split("T")[0],
                        ":usuario_id": usuario.id
                    });

                    return Response.json({
                        msg: "Liga cadastrada com sucesso!",
                        id: resultado.lastInsertRowid
                    }, { status: 201 });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { msg: "Não foi possível cadastrar a liga." },
                        { status: 409 }
                    );
                }
            }
        },

        // ==========================================
        // CONSULTAR UMA LIGA
        // ==========================================

        "/api/ligas/:id": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const id = Number(req.params.id);

                if (!Number.isInteger(id) || id <= 0) {
                    return Response.json(
                        { msg: "ID inválido." },
                        { status: 400 }
                    );
                }

                const query = db.query(`
                    SELECT *
                    FROM ligas
                    WHERE id = :id
                    AND usuario_id = :usuario_id
                `);

                const liga = query.get({
                    ":id": id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { msg: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                return Response.json(liga);
            },

            // EDITAR LIGA
            PUT: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const id = Number(req.params.id);

                if (!Number.isInteger(id) || id <= 0) {
                    return Response.json(
                        { msg: "ID inválido." },
                        { status: 400 }
                    );
                }

                try {
                    const body = await req.json();

                    const nome = String(body.nome ?? "").trim();
                    const descricao = String(body.descricao ?? "").trim();

                    if (!nome || !descricao) {
                        return Response.json(
                            { msg: "Preencha todos os campos." },
                            { status: 400 }
                        );
                    }

                    const query = db.query(`
                        UPDATE ligas
                        SET nome = :nome,
                            descricao = :descricao
                        WHERE id = :id
                        AND usuario_id = :usuario_id
                    `);

                    const resultado = query.run({
                        ":nome": nome,
                        ":descricao": descricao,
                        ":id": id,
                        ":usuario_id": usuario.id
                    });

                    if (resultado.changes === 0) {
                        return Response.json(
                            { msg: "Liga não encontrada." },
                            { status: 404 }
                        );
                    }

                    return Response.json({
                        msg: "Liga atualizada com sucesso!"
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { msg: "Erro ao atualizar liga." },
                        { status: 500 }
                    );
                }
            },

            // EXCLUIR LIGA
            DELETE: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const id = Number(req.params.id);

                if (!Number.isInteger(id) || id <= 0) {
                    return Response.json(
                        { msg: "ID inválido." },
                        { status: 400 }
                    );
                }

                const verificarLiga = db.query(`
                    SELECT id
                    FROM ligas
                    WHERE id = :id
                    AND usuario_id = :usuario_id
                `);

                const liga = verificarLiga.get({
                    ":id": id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { msg: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                try {
                    const excluir = db.transaction(() => {
                        // Apaga as partidas da liga
                        db.query(`
                            DELETE FROM partidas
                            WHERE liga_id = :id
                        `).run({ ":id": id });

                        // Remove os vínculos entre liga e times
                        db.query(`
                            DELETE FROM liga_times
                            WHERE liga_id = :id
                        `).run({ ":id": id });

                        // Apaga somente a liga
                        db.query(`
                            DELETE FROM ligas
                            WHERE id = :id
                            AND usuario_id = :usuario_id
                        `).run({
                            ":id": id,
                            ":usuario_id": usuario.id
                        });
                    });

                    excluir();

                    return Response.json({
                        msg: "Liga excluída com sucesso!"
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { msg: "Erro ao excluir liga." },
                        { status: 500 }
                    );
                }
            }
        },


        // ==========================================
        // TIMES
        // ==========================================

        "/api/times": {
            // CADASTRAR OU RECUPERAR TIME
            POST: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                try {
                    const body = await req.json();
                    const nome = String(body.nome ?? "").trim();

                    if (!nome) {
                        return Response.json(
                            { erro: "Nome do time obrigatório." },
                            { status: 400 }
                        );
                    }

                    const timeExistente = db.query(`
                        SELECT id
                        FROM times
                        WHERE nome = :nome
                        AND usuario_id = :usuario_id
                    `).get({
                        ":nome": nome,
                        ":usuario_id": usuario.id
                    }) as { id: number } | null;

                    let timeId: number | bigint;

                    if (timeExistente) {
                        timeId = timeExistente.id;
                    } else {
                        const resultado = db.query(`
                            INSERT INTO times (nome, usuario_id)
                            VALUES (:nome, :usuario_id)
                        `).run({
                            ":nome": nome,
                            ":usuario_id": usuario.id
                        });

                        timeId = resultado.lastInsertRowid;
                    }

                    return Response.json({
                        msg: timeExistente
                            ? "Time já cadastrado!"
                            : "Time cadastrado com sucesso!",
                        id: timeId
                    }, {
                        status: timeExistente ? 200 : 201
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Não foi possível cadastrar o time." },
                        { status: 500 }
                    );
                }
            },

            // LISTAR TODOS OS TIMES DO USUÁRIO
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const query = db.query(`
                    SELECT id, nome
                    FROM times
                    WHERE usuario_id = :usuario_id
                    ORDER BY nome ASC
                `);

                return Response.json(query.all({
                    ":usuario_id": usuario.id
                }));
            }
        },

        // ==========================================
        // TREINADORES
        // ==========================================

        "/api/treinadores": {

            // LISTAR TREINADORES
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const treinadores = db.query(`
            SELECT id, nome
            FROM treinadores
            WHERE usuario_id = :usuario_id
            ORDER BY nome ASC
        `).all({
                    ":usuario_id": usuario.id
                });

                return Response.json(treinadores);
            },

            // CADASTRAR TREINADOR
            POST: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                try {
                    const body = await req.json();
                    const nome = String(body.nome ?? "").trim();

                    if (!nome) {
                        return Response.json(
                            { erro: "O nome do treinador é obrigatório." },
                            { status: 400 }
                        );
                    }

                    const resultado = db.query(`
                INSERT INTO treinadores (nome, usuario_id)
                VALUES (:nome, :usuario_id)
            `).run({
                        ":nome": nome,
                        ":usuario_id": usuario.id
                    });

                    return Response.json({
                        mensagem: "Treinador cadastrado com sucesso!",
                        id: resultado.lastInsertRowid
                    }, { status: 201 });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Não foi possível cadastrar o treinador." },
                        { status: 500 }
                    );
                }
            }
        },

        "/api/times/:id/treinador": {
            POST: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                try {
                    const timeId = Number(req.params.id);
                    const body = await req.json();
                    const treinadorId = Number(body.treinador_id);

                    if (!Number.isInteger(timeId) || !Number.isInteger(treinadorId)) {
                        return Response.json(
                            { erro: "IDs inválidos." },
                            { status: 400 }
                        );
                    }

                    const time = db.query(`
                SELECT id FROM times
                WHERE id = ? AND usuario_id = ?
            `).get(timeId, usuario.id);

                    const treinador = db.query(`
                SELECT id FROM treinadores
                WHERE id = ? AND usuario_id = ?
            `).get(treinadorId, usuario.id);

                    if (!time || !treinador) {
                        return Response.json(
                            { erro: "Time ou treinador não encontrado." },
                            { status: 404 }
                        );
                    }

                    const hoje = new Date().toISOString().slice(0, 10);

                    const vincular = db.transaction(() => {
                        db.query(`
                    UPDATE time_treinadores
                    SET fim = ?
                    WHERE time_id = ? AND fim IS NULL
                `).run(hoje, timeId);

                        db.query(`
                    INSERT INTO time_treinadores
                    (time_id, treinador_id, inicio)
                    VALUES (?, ?, ?)
                `).run(timeId, treinadorId, hoje);
                    });

                    vincular();

                    return Response.json({
                        mensagem: "Treinador vinculado ao time com sucesso!"
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Não foi possível vincular o treinador." },
                        { status: 500 }
                    );
                }
            }
        },


        // ==========================================
        // VINCULAR E LISTAR TIMES DE UMA LIGA
        // ==========================================

        "/api/ligas/:id/times": {
            // VINCULAR TIME À LIGA
            POST: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                try {
                    const liga_id = Number(req.params.id);
                    const body = await req.json();
                    const time_id = Number(body.time_id);

                    if (
                        !Number.isInteger(liga_id) || liga_id <= 0 ||
                        !Number.isInteger(time_id) || time_id <= 0
                    ) {
                        return Response.json(
                            { erro: "IDs inválidos." },
                            { status: 400 }
                        );
                    }

                    const liga = db.query(`
                        SELECT id
                        FROM ligas
                        WHERE id = :liga_id
                        AND usuario_id = :usuario_id
                    `).get({
                        ":liga_id": liga_id,
                        ":usuario_id": usuario.id
                    });

                    if (!liga) {
                        return Response.json(
                            { erro: "Liga não encontrada." },
                            { status: 404 }
                        );
                    }

                    const time = db.query(`
                        SELECT id
                        FROM times
                        WHERE id = :time_id
                        AND usuario_id = :usuario_id
                    `).get({
                        ":time_id": time_id,
                        ":usuario_id": usuario.id
                    });

                    if (!time) {
                        return Response.json(
                            { erro: "Time não encontrado." },
                            { status: 404 }
                        );
                    }

                    db.query(`
                        INSERT INTO liga_times (liga_id, time_id)
                        VALUES (:liga_id, :time_id)
                    `).run({
                        ":liga_id": liga_id,
                        ":time_id": time_id
                    });

                    return Response.json({
                        msg: "Time vinculado à liga com sucesso!"
                    }, { status: 201 });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Esse time já participa dessa liga ou não foi possível vinculá-lo." },
                        { status: 409 }
                    );
                }
            },

            // LISTAR TIMES DA LIGA
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido." },
                        { status: 400 }
                    );
                }

                const liga = db.query(`
                    SELECT id
                    FROM ligas
                    WHERE id = :id
                    AND usuario_id = :usuario_id
                `).get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                const query = db.query(`
                    SELECT times.id, times.nome
                    FROM times
                    INNER JOIN liga_times
                        ON liga_times.time_id = times.id
                    WHERE liga_times.liga_id = :liga_id
                    AND times.usuario_id = :usuario_id
                    ORDER BY times.nome ASC
                `);

                return Response.json(query.all({
                    ":liga_id": liga_id,
                    ":usuario_id": usuario.id
                }));
            }
        },

        // ==========================================
        // JOGADORES
        // ==========================================

        "/api/times/:id/jogadores": {
            // CADASTRAR JOGADOR
            POST: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const time_id = Number(req.params.id);

                if (!Number.isInteger(time_id) || time_id <= 0) {
                    return Response.json(
                        { erro: "ID do time inválido." },
                        { status: 400 }
                    );
                }

                try {
                    const body = await req.json();

                    const nome = String(body.nome ?? "").trim();
                    const posicao = String(body.posicao ?? "").trim();

                    const numero =
                        body.numero === "" ||
                            body.numero === null ||
                            body.numero === undefined
                            ? null
                            : Number(body.numero);

                    if (
                        !nome ||
                        !posicao ||
                        (numero !== null &&
                            (!Number.isInteger(numero) || numero < 1 || numero > 99))
                    ) {
                        return Response.json(
                            { erro: "Dados do jogador inválidos." },
                            { status: 400 }
                        );
                    }

                    const verificarTime = db.query(`
                        SELECT id
                        FROM times
                        WHERE id = :time_id
                        AND usuario_id = :usuario_id
                    `);

                    const time = verificarTime.get({
                        ":time_id": time_id,
                        ":usuario_id": usuario.id
                    });

                    if (!time) {
                        return Response.json(
                            { erro: "Time não encontrado." },
                            { status: 404 }
                        );
                    }

                    const cadastrar = db.query(`
                        INSERT INTO jogadores (
                            nome,
                            numero,
                            posicao,
                            time_id
                        )
                        VALUES (
                            :nome,
                            :numero,
                            :posicao,
                            :time_id
                        )
                    `);

                    const resultado = cadastrar.run({
                        ":nome": nome,
                        ":numero": numero,
                        ":posicao": posicao,
                        ":time_id": time_id
                    });

                    return Response.json({
                        mensagem: "Jogador cadastrado com sucesso!",
                        id: resultado.lastInsertRowid
                    }, { status: 201 });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Não foi possível cadastrar. Verifique se o número da camisa já está em uso." },
                        { status: 409 }
                    );
                }
            },

            // LISTAR JOGADORES DO TIME
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const time_id = Number(req.params.id);

                if (!Number.isInteger(time_id) || time_id <= 0) {
                    return Response.json(
                        { erro: "ID do time inválido." },
                        { status: 400 }
                    );
                }

                const verificarTime = db.query(`
                    SELECT id
                    FROM times
                    WHERE id = :time_id
                    AND usuario_id = :usuario_id
                `);

                const time = verificarTime.get({
                    ":time_id": time_id,
                    ":usuario_id": usuario.id
                });

                if (!time) {
                    return Response.json(
                        { erro: "Time não encontrado." },
                        { status: 404 }
                    );
                }

                const buscarJogadores = db.query(`
                    SELECT id, nome, numero, posicao
                    FROM jogadores
                    WHERE time_id = :time_id
                    ORDER BY numero ASC, nome ASC
                `);

                return Response.json(buscarJogadores.all({
                    ":time_id": time_id
                }));
            }
        },


        // ==========================================
        // EDITAR E EXCLUIR JOGADORES
        // ==========================================

        "/api/jogadores/:id": {

            // EDITAR JOGADOR
            PUT: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const jogador_id = Number(req.params.id);

                if (!Number.isInteger(jogador_id) || jogador_id <= 0) {
                    return Response.json(
                        { erro: "ID do jogador inválido." },
                        { status: 400 }
                    );
                }

                try {
                    const body = await req.json();

                    const nome = String(body.nome ?? "").trim();
                    const posicao = String(body.posicao ?? "").trim();

                    const numero =
                        body.numero === "" ||
                            body.numero === null ||
                            body.numero === undefined
                            ? null
                            : Number(body.numero);

                    const posicoesValidas = [
                        "Goleiro",
                        "Zagueiro",
                        "Lateral",
                        "Meio-campo",
                        "Atacante"
                    ];

                    if (
                        !nome ||
                        !posicoesValidas.includes(posicao) ||
                        (
                            numero !== null &&
                            (
                                !Number.isInteger(numero) ||
                                numero < 1 ||
                                numero > 99
                            )
                        )
                    ) {
                        return Response.json(
                            { erro: "Dados do jogador inválidos." },
                            { status: 400 }
                        );
                    }

                    const verificar = db.query(`
                        SELECT jogadores.id
                        FROM jogadores
                        INNER JOIN times
                            ON times.id = jogadores.time_id
                        WHERE jogadores.id = :id
                        AND times.usuario_id = :usuario_id
                    `);

                    const jogador = verificar.get({
                        ":id": jogador_id,
                        ":usuario_id": usuario.id
                    });

                    if (!jogador) {
                        return Response.json(
                            { erro: "Jogador não encontrado." },
                            { status: 404 }
                        );
                    }

                    const atualizar = db.query(`
                        UPDATE jogadores
                        SET
                            nome = :nome,
                            numero = :numero,
                            posicao = :posicao
                        WHERE id = :id
                    `);

                    atualizar.run({
                        ":nome": nome,
                        ":numero": numero,
                        ":posicao": posicao,
                        ":id": jogador_id
                    });

                    return Response.json({
                        mensagem: "Jogador atualizado com sucesso!"
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Não foi possível atualizar. Verifique se o número da camisa já está em uso." },
                        { status: 409 }
                    );
                }
            },

            // EXCLUIR JOGADOR
            DELETE: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const jogador_id = Number(req.params.id);

                if (!Number.isInteger(jogador_id) || jogador_id <= 0) {
                    return Response.json(
                        { erro: "ID do jogador inválido." },
                        { status: 400 }
                    );
                }

                const verificar = db.query(`
                    SELECT jogadores.id
                    FROM jogadores
                    INNER JOIN times
                        ON times.id = jogadores.time_id
                    WHERE jogadores.id = :id
                    AND times.usuario_id = :usuario_id
                `);

                const jogador = verificar.get({
                    ":id": jogador_id,
                    ":usuario_id": usuario.id
                });

                if (!jogador) {
                    return Response.json(
                        { erro: "Jogador não encontrado." },
                        { status: 404 }
                    );
                }

                const estatisticas = db.query(`
                    SELECT COUNT(*) AS total
                    FROM estatisticas_partida
                    WHERE jogador_id = :jogador_id
                `).get({
                    ":jogador_id": jogador_id
                }) as { total: number };

                if (estatisticas.total > 0) {
                    return Response.json(
                        {
                            erro: "Esse jogador possui estatísticas registradas em partidas e não pode ser excluído."
                        },
                        { status: 409 }
                    );
                }

                try {
                    db.query(`
                        DELETE FROM jogadores
                        WHERE id = :id
                    `).run({
                        ":id": jogador_id
                    });

                    return Response.json({
                        mensagem: "Jogador excluído com sucesso!"
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Erro ao excluir jogador." },
                        { status: 500 }
                    );
                }
            }
        },


        // ==========================================
        // CLASSIFICAÇÃO
        // ==========================================

        "/api/ligas/:id/classificacao": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido." },
                        { status: 400 }
                    );
                }

                const liga = db.query(`
                    SELECT id
                    FROM ligas
                    WHERE id = :id
                    AND usuario_id = :usuario_id
                `).get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                const times = db.query(`
                    SELECT times.id, times.nome
                    FROM times
                    INNER JOIN liga_times
                        ON liga_times.time_id = times.id
                    WHERE liga_times.liga_id = :liga_id
                    AND times.usuario_id = :usuario_id
                `).all({
                    ":liga_id": liga_id,
                    ":usuario_id": usuario.id
                }) as {
                    id: number;
                    nome: string;
                }[];

                const partidas = db.query(`
                    SELECT
                        mandante_id,
                        visitante_id,
                        gols_mandante,
                        gols_visitante
                    FROM partidas
                    WHERE liga_id = :liga_id
                    AND gols_mandante IS NOT NULL
                    AND gols_visitante IS NOT NULL
                `).all({
                    ":liga_id": liga_id
                }) as {
                    mandante_id: number;
                    visitante_id: number;
                    gols_mandante: number;
                    gols_visitante: number;
                }[];

                const classificacao = times.map(time => ({
                    id: time.id,
                    nome: time.nome,
                    pontos: 0,
                    jogos: 0,
                    vitorias: 0,
                    empates: 0,
                    derrotas: 0,
                    gols_pro: 0,
                    gols_contra: 0,
                    saldo: 0
                }));

                for (const partida of partidas) {
                    const mandante = classificacao.find(
                        time => time.id === partida.mandante_id
                    );

                    const visitante = classificacao.find(
                        time => time.id === partida.visitante_id
                    );

                    if (!mandante || !visitante) continue;

                    mandante.jogos++;
                    visitante.jogos++;

                    mandante.gols_pro += partida.gols_mandante;
                    mandante.gols_contra += partida.gols_visitante;

                    visitante.gols_pro += partida.gols_visitante;
                    visitante.gols_contra += partida.gols_mandante;

                    if (partida.gols_mandante > partida.gols_visitante) {
                        mandante.vitorias++;
                        mandante.pontos += 3;
                        visitante.derrotas++;

                    } else if (partida.gols_mandante < partida.gols_visitante) {
                        visitante.vitorias++;
                        visitante.pontos += 3;
                        mandante.derrotas++;

                    } else {
                        mandante.empates++;
                        visitante.empates++;

                        mandante.pontos++;
                        visitante.pontos++;
                    }
                }

                classificacao.forEach(time => {
                    time.saldo = time.gols_pro - time.gols_contra;
                });

                classificacao.sort((a, b) =>
                    b.pontos - a.pontos ||
                    b.vitorias - a.vitorias ||
                    b.saldo - a.saldo ||
                    b.gols_pro - a.gols_pro ||
                    a.nome.localeCompare(b.nome)
                );

                return Response.json(classificacao);
            }
        },

        // ==========================================
        // DASHBOARD GERAL DA HOME
        // ==========================================

        "/api/dashboard": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const dados = db.query(`
            SELECT
                (
                    SELECT COUNT(*)
                    FROM ligas
                    WHERE usuario_id = :usuario_id
                ) AS totalLigas,

                (
                    SELECT COUNT(*)
                    FROM times
                    WHERE usuario_id = :usuario_id
                ) AS totalTimes,

                (
                    SELECT COUNT(*)
                    FROM jogadores
                    INNER JOIN times
                        ON times.id = jogadores.time_id
                    WHERE times.usuario_id = :usuario_id
                ) AS totalJogadores,

                (
                    SELECT COUNT(*)
                    FROM partidas
                    INNER JOIN ligas
                        ON ligas.id = partidas.liga_id
                    WHERE ligas.usuario_id = :usuario_id
                    AND partidas.gols_mandante IS NOT NULL
                    AND partidas.gols_visitante IS NOT NULL
                ) AS totalPartidas
        `).get({
                    ":usuario_id": usuario.id
                });

                return Response.json(dados);
            }
        },

        // ==========================================
        // DASHBOARD
        // ==========================================

        "/api/ligas/:id/dashboard": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido." },
                        { status: 400 }
                    );
                }

                const verificarLiga = db.query(`
                    SELECT id
                    FROM ligas
                    WHERE id = :id
                    AND usuario_id = :usuario_id
                `);

                const liga = verificarLiga.get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                const dashboard = db.query(`
                    SELECT
                        (
                            SELECT COUNT(*)
                            FROM liga_times
                            WHERE liga_id = :liga_id
                        ) AS totalTimes,

                        (
                            SELECT COUNT(*)
                            FROM partidas
                            WHERE liga_id = :liga_id
                        ) AS totalPartidas,

                        (
                            SELECT COUNT(*)
                            FROM partidas
                            WHERE liga_id = :liga_id
                            AND gols_mandante IS NOT NULL
                            AND gols_visitante IS NOT NULL
                        ) AS partidasDisputadas,

                        (
                            SELECT COUNT(*)
                            FROM partidas
                            WHERE liga_id = :liga_id
                            AND (
                                gols_mandante IS NULL
                                OR gols_visitante IS NULL
                            )
                        ) AS partidasRestantes
                `);

                const dados = dashboard.get({
                    ":liga_id": liga_id
                });

                return Response.json(dados);
            }
        },

        // ==========================================
        // GERAR PARTIDAS AUTOMATICAMENTE
        // ==========================================

        "/api/ligas/:id/gerar-partidas": {
            POST: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Não autenticado." },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido." },
                        { status: 400 }
                    );
                }

                const verificarLiga = db.query(`
                    SELECT id
                    FROM ligas
                    WHERE id = :id
                    AND usuario_id = :usuario_id
                `);

                const liga = verificarLiga.get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                const buscarTimes = db.query(`
                    SELECT times.id, times.nome
                    FROM times
                    INNER JOIN liga_times
                        ON liga_times.time_id = times.id
                    WHERE liga_times.liga_id = :liga_id
                    AND times.usuario_id = :usuario_id
                    ORDER BY times.id ASC
                `);

                const times = buscarTimes.all({
                    ":liga_id": liga_id,
                    ":usuario_id": usuario.id
                }) as {
                    id: number;
                    nome: string;
                }[];

                if (times.length < 2) {
                    return Response.json(
                        { erro: "A liga precisa ter pelo menos 2 times." },
                        { status: 400 }
                    );
                }

                const verificarPartidas = db.query(`
                    SELECT COUNT(*) AS total
                    FROM partidas
                    WHERE liga_id = :liga_id
                `);

                const resultado = verificarPartidas.get({
                    ":liga_id": liga_id
                }) as { total: number };

                if (resultado.total > 0) {
                    return Response.json(
                        { erro: "As partidas dessa liga já foram geradas." },
                        { status: 409 }
                    );
                }

                // Adiciona uma vaga vazia se a quantidade for ímpar
                let participantes = [...times] as (typeof times[number] | null)[];

                if (participantes.length % 2 !== 0) {
                    participantes.push(null);
                }

                const totalTimes = participantes.length;
                const totalRodadas = totalTimes - 1;

                const partidas: {
                    mandante_id: number;
                    visitante_id: number;
                    turno: number;
                    rodada: number;
                }[] = [];

                // PRIMEIRO TURNO
                for (let rodada = 1; rodada <= totalRodadas; rodada++) {
                    for (let i = 0; i < totalTimes / 2; i++) {
                        const timeA = participantes[i];
                        const timeB = participantes[totalTimes - 1 - i];

                        if (timeA === null || timeB === null) {
                            continue;
                        }

                        const inverter = (rodada + i) % 2 === 0;

                        partidas.push({
                            mandante_id: inverter ? timeA.id : timeB.id,
                            visitante_id: inverter ? timeB.id : timeA.id,
                            turno: 1,
                            rodada
                        });
                    }

                    // Rotaciona os times
                    const ultimo = participantes.pop()!;

                    participantes.splice(1, 0, ultimo);
                }

                // SEGUNDO TURNO: inverte os mandos
                const partidasSegundoTurno = partidas.map(partida => ({
                    mandante_id: partida.visitante_id,
                    visitante_id: partida.mandante_id,
                    turno: 2,
                    rodada: partida.rodada
                }));

                partidas.push(...partidasSegundoTurno);

                // SALVAR PARTIDAS NO BANCO
                try {
                    const gerar = db.transaction(() => {
                        const inserirPartida = db.query(`
                            INSERT INTO partidas (
                                liga_id,
                                mandante_id,
                                visitante_id,
                                turno,
                                rodada
                            )
                            VALUES (
                                :liga_id,
                                :mandante_id,
                                :visitante_id,
                                :turno,
                                :rodada
                            )
                        `);

                        for (const partida of partidas) {
                            inserirPartida.run({
                                ":liga_id": liga_id,
                                ":mandante_id": partida.mandante_id,
                                ":visitante_id": partida.visitante_id,
                                ":turno": partida.turno,
                                ":rodada": partida.rodada
                            });
                        }
                    });

                    gerar();

                    return Response.json({
                        mensagem: "Partidas geradas com sucesso!",
                        totalPartidas: partidas.length,
                        totalRodadas: totalRodadas * 2
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Erro ao gerar partidas." },
                        { status: 500 }
                    );
                }
            }
        },

        // ==========================================
        // LISTAR PARTIDAS
        // ==========================================

        "/api/ligas/:id/partidas": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID inválido." },
                        { status: 400 }
                    );
                }

                const verificarLiga = db.query(`
                    SELECT id
                    FROM ligas
                    WHERE id = :id
                    AND usuario_id = :usuario_id
                `);

                const liga = verificarLiga.get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                const buscarPartidas = db.query(`
                    SELECT
                        partidas.id,
                        partidas.liga_id,
                        partidas.turno,
                        partidas.rodada,
                        partidas.gols_mandante,
                        partidas.gols_visitante,
                        mandante.nome AS mandante,
                        visitante.nome AS visitante
                    FROM partidas
                    INNER JOIN times AS mandante
                        ON mandante.id = partidas.mandante_id
                    INNER JOIN times AS visitante
                        ON visitante.id = partidas.visitante_id
                    WHERE partidas.liga_id = :liga_id
                    ORDER BY
                        partidas.turno ASC,
                        partidas.rodada ASC,
                        partidas.id ASC
                `);

                const partidas = buscarPartidas.all({
                    ":liga_id": liga_id
                });

                return Response.json(partidas);
            }
        },

        // ==========================================
        // SALVAR PLACARES
        // ==========================================

        "/api/ligas/:id/placares": {
            PUT: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido." },
                        { status: 400 }
                    );
                }

                const liga = db.query(`
                    SELECT id
                    FROM ligas
                    WHERE id = :id
                    AND usuario_id = :usuario_id
                `).get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                try {
                    const body = await req.json();
                    const partidas = body.partidas;

                    if (!Array.isArray(partidas)) {
                        return Response.json(
                            { erro: "Lista de partidas inválida." },
                            { status: 400 }
                        );
                    }

                    // Validar todas as partidas antes de salvar
                    for (const partida of partidas) {
                        const id = Number(partida.id);
                        const mandante = partida.gols_mandante;
                        const visitante = partida.gols_visitante;

                        if (
                            !Number.isInteger(id) ||
                            !Number.isInteger(mandante) ||
                            !Number.isInteger(visitante) ||
                            mandante < 0 ||
                            visitante < 0
                        ) {
                            return Response.json(
                                { erro: "Um ou mais placares são inválidos." },
                                { status: 400 }
                            );
                        }

                        const encontrada = db.query(`
                            SELECT id
                            FROM partidas
                            WHERE id = :id
                            AND liga_id = :liga_id
                        `).get({
                            ":id": id,
                            ":liga_id": liga_id
                        });

                        if (!encontrada) {
                            return Response.json(
                                { erro: "Partida não encontrada nesta liga." },
                                { status: 404 }
                            );
                        }
                    }

                    const atualizar = db.query(`
    UPDATE partidas
    SET
        gols_mandante = :gols_mandante,
        gols_visitante = :gols_visitante
    WHERE id = :id
    AND liga_id = :liga_id
`);

                    const registrarTreinador = db.query(`
    INSERT OR IGNORE INTO partida_treinadores (
        partida_id,
        time_id,
        treinador_id
    )
    SELECT
        :partida_id,
        :time_id,
        (
            SELECT treinador_id
            FROM time_treinadores
            WHERE time_id = :time_id
            AND fim IS NULL
            ORDER BY inicio DESC, id DESC
            LIMIT 1
        )
`);

                    const buscarTimes = db.query(`
    SELECT mandante_id, visitante_id
    FROM partidas
    WHERE id = :id
`);

                    const salvar = db.transaction(() => {
                        for (const partida of partidas) {
                            const partidaId = Number(partida.id);

                            atualizar.run({
                                ":gols_mandante": partida.gols_mandante,
                                ":gols_visitante": partida.gols_visitante,
                                ":id": partidaId,
                                ":liga_id": liga_id
                            });

                            const times = buscarTimes.get({
                                ":id": partidaId
                            }) as {
                                mandante_id: number;
                                visitante_id: number;
                            };

                            // Registrar treinador do mandante
                            registrarTreinador.run({
                                ":partida_id": partidaId,
                                ":time_id": times.mandante_id
                            });

                            // Registrar treinador do visitante
                            registrarTreinador.run({
                                ":partida_id": partidaId,
                                ":time_id": times.visitante_id
                            });
                        }
                    });

                    salvar();

                    salvar();

                    return Response.json({
                        mensagem: "Resultados salvos com sucesso!"
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Erro ao salvar resultados." },
                        { status: 500 }
                    );
                }
            }
        },

        "/api/times/:id": {
            DELETE: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const timeId = Number(req.params.id);

                if (!Number.isInteger(timeId) || timeId <= 0) {
                    return Response.json(
                        { erro: "ID do time inválido." },
                        { status: 400 }
                    );
                }

                const time = db.query(`
            SELECT id
            FROM times
            WHERE id = :id
            AND usuario_id = :usuario_id
        `).get({
                    ":id": timeId,
                    ":usuario_id": usuario.id
                });

                if (!time) {
                    return Response.json(
                        { erro: "Time não encontrado." },
                        { status: 404 }
                    );
                }

                const temPartidas = db.query(`
            SELECT id
            FROM partidas
            WHERE mandante_id = :id
            OR visitante_id = :id
            LIMIT 1
        `).get({
                    ":id": timeId
                });

                if (temPartidas) {
                    return Response.json(
                        {
                            erro: "Não é possível excluir um time que possui partidas registradas."
                        },
                        { status: 409 }
                    );
                }

                try {
                    const excluir = db.transaction(() => {
                        db.query(`
                    DELETE FROM time_treinadores
                    WHERE time_id = :id
                `).run({ ":id": timeId });

                        db.query(`
                    DELETE FROM liga_times
                    WHERE time_id = :id
                `).run({ ":id": timeId });

                        db.query(`
                    DELETE FROM jogadores
                    WHERE time_id = :id
                `).run({ ":id": timeId });

                        db.query(`
                    DELETE FROM times
                    WHERE id = :id
                    AND usuario_id = :usuario_id
                `).run({
                            ":id": timeId,
                            ":usuario_id": usuario.id
                        });
                    });

                    excluir();

                    return Response.json({
                        mensagem: "Time excluído com sucesso!"
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Erro ao excluir o time." },
                        { status: 500 }
                    );
                }
            }
        },
        "/api/ligas/:id/treinadores/aproveitamento": {
            GET: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const ligaId = Number(req.params.id);

                if (!Number.isInteger(ligaId) || ligaId <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido." },
                        { status: 400 }
                    );
                }

                const liga = db.query(`
            SELECT id
            FROM ligas
            WHERE id = :id
            AND usuario_id = :usuario_id
        `).get({
                    ":id": ligaId,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                try {
                    const treinadores = db.query(`
                SELECT
                    t.id,
                    t.nome,

                    COUNT(*) AS partidas,

                    SUM(
                        CASE
                            WHEN (
                                (p.mandante_id = pt.time_id
                                    AND p.gols_mandante > p.gols_visitante)
                                OR
                                (p.visitante_id = pt.time_id
                                    AND p.gols_visitante > p.gols_mandante)
                            )
                            THEN 1 ELSE 0
                        END
                    ) AS vitorias,

                    SUM(
                        CASE
                            WHEN p.gols_mandante = p.gols_visitante
                            THEN 1 ELSE 0
                        END
                    ) AS empates,

                    SUM(
                        CASE
                            WHEN (
                                (p.mandante_id = pt.time_id
                                    AND p.gols_mandante < p.gols_visitante)
                                OR
                                (p.visitante_id = pt.time_id
                                    AND p.gols_visitante < p.gols_mandante)
                            )
                            THEN 1 ELSE 0
                        END
                    ) AS derrotas

                FROM partida_treinadores pt

                INNER JOIN treinadores t
                    ON t.id = pt.treinador_id

                INNER JOIN partidas p
                    ON p.id = pt.partida_id

                INNER JOIN liga_times lt
                    ON lt.liga_id = p.liga_id
                    AND lt.time_id = pt.time_id

                WHERE p.liga_id = :liga_id
                AND t.usuario_id = :usuario_id
                AND p.gols_mandante IS NOT NULL
                AND p.gols_visitante IS NOT NULL

                GROUP BY t.id, t.nome

                ORDER BY vitorias DESC, empates DESC, derrotas ASC
            `).all({
                        ":liga_id": ligaId,
                        ":usuario_id": usuario.id
                    }) as {
                        id: number;
                        nome: string;
                        partidas: number;
                        vitorias: number;
                        empates: number;
                        derrotas: number;
                    }[];

                    const resultado = treinadores.map(treinador => {
                        const pontos =
                            treinador.vitorias * 3 + treinador.empates;

                        const aproveitamento =
                            treinador.partidas > 0
                                ? (pontos / (treinador.partidas * 3)) * 100
                                : 0;

                        return {
                            ...treinador,
                            pontos,
                            aproveitamento: Number(aproveitamento.toFixed(2))
                        };
                    });

                    return Response.json(resultado);

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Erro ao calcular aproveitamento dos treinadores." },
                        { status: 500 }
                    );
                }
            }
        },

        // ==========================================
        // ESTATÍSTICAS DOS JOGADORES POR PARTIDA
        // ==========================================

        "/api/partidas/:id/estatisticas": {

            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const partida_id = Number(req.params.id);

                if (!Number.isInteger(partida_id) || partida_id <= 0) {
                    return Response.json(
                        { erro: "ID da partida inválido." },
                        { status: 400 }
                    );
                }

                const buscar = db.query(`
                    SELECT
                        partidas.id AS partida_id,
                        partidas.gols_mandante,
                        partidas.gols_visitante,
                        partidas.mandante_id,
                        partidas.visitante_id,
                        mandante.nome AS mandante,
                        visitante.nome AS visitante
                    FROM partidas
                    INNER JOIN ligas
                        ON ligas.id = partidas.liga_id
                    INNER JOIN times AS mandante
                        ON mandante.id = partidas.mandante_id
                    INNER JOIN times AS visitante
                        ON visitante.id = partidas.visitante_id
                    WHERE partidas.id = :partida_id
                    AND ligas.usuario_id = :usuario_id
                `);

                const partida = buscar.get({
                    ":partida_id": partida_id,
                    ":usuario_id": usuario.id
                }) as any;

                if (!partida) {
                    return Response.json(
                        { erro: "Partida não encontrada." },
                        { status: 404 }
                    );
                }

                const jogadores = db.query(`
                    SELECT
                        jogadores.id AS jogador_id,
                        jogadores.nome,
                        jogadores.numero,
                        jogadores.posicao,
                        jogadores.time_id,
                        COALESCE(estatisticas_partida.gols, 0) AS gols,
                        COALESCE(estatisticas_partida.assistencias, 0) AS assistencias,
                        COALESCE(estatisticas_partida.amarelos, 0) AS amarelos,
                        COALESCE(estatisticas_partida.vermelhos, 0) AS vermelhos
                    FROM jogadores
                    LEFT JOIN estatisticas_partida
                        ON estatisticas_partida.jogador_id = jogadores.id
                        AND estatisticas_partida.partida_id = :partida_id
                    WHERE jogadores.time_id IN (
                        :mandante_id,
                        :visitante_id
                    )
                    ORDER BY jogadores.time_id, jogadores.numero
                `);

                const elenco = jogadores.all({
                    ":partida_id": partida_id,
                    ":mandante_id": partida.mandante_id,
                    ":visitante_id": partida.visitante_id
                });

                return Response.json({
                    partida,
                    jogadores: elenco
                });
            },

            PUT: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const partida_id = Number(req.params.id);

                if (!Number.isInteger(partida_id) || partida_id <= 0) {
                    return Response.json(
                        { erro: "ID da partida inválido." },
                        { status: 400 }
                    );
                }

                try {
                    const body = await req.json();
                    const jogadores = body.jogadores;

                    if (!Array.isArray(jogadores)) {
                        return Response.json(
                            { erro: "Lista de jogadores inválida." },
                            { status: 400 }
                        );
                    }

                    // LOCALIZAR PARTIDA E VERIFICAR PROPRIETÁRIO
                    const partida = db.query(`
                        SELECT
                            partidas.id,
                            partidas.gols_mandante,
                            partidas.gols_visitante,
                            partidas.mandante_id,
                            partidas.visitante_id
                        FROM partidas
                        INNER JOIN ligas
                            ON ligas.id = partidas.liga_id
                        WHERE partidas.id = :partida_id
                        AND ligas.usuario_id = :usuario_id
                    `).get({
                        ":partida_id": partida_id,
                        ":usuario_id": usuario.id
                    }) as {
                        id: number;
                        gols_mandante: number | null;
                        gols_visitante: number | null;
                        mandante_id: number;
                        visitante_id: number;
                    } | null;

                    if (!partida) {
                        return Response.json(
                            { erro: "Partida não encontrada." },
                            { status: 404 }
                        );
                    }

                    if (
                        partida.gols_mandante === null ||
                        partida.gols_visitante === null
                    ) {
                        return Response.json(
                            { erro: "Registre o placar antes das estatísticas." },
                            { status: 400 }
                        );
                    }

                    const ids = new Set<number>();

                    let golsMandante = 0;
                    let golsVisitante = 0;

                    const dados = [];

                    // VALIDAR JOGADORES E ESTATÍSTICAS
                    for (const item of jogadores) {
                        const jogador_id = Number(item.jogador_id);

                        const gols = Number(item.gols ?? 0);
                        const assistencias = Number(item.assistencias ?? 0);
                        const amarelos = Number(item.amarelos ?? 0);
                        const vermelhos = Number(item.vermelhos ?? 0);

                        if (
                            !Number.isInteger(jogador_id) ||
                            jogador_id <= 0 ||
                            ids.has(jogador_id) ||
                            ![gols, assistencias, amarelos, vermelhos]
                                .every(valor =>
                                    Number.isInteger(valor) && valor >= 0
                                )
                        ) {
                            return Response.json(
                                { erro: "Dados inválidos ou jogador duplicado." },
                                { status: 400 }
                            );
                        }

                        ids.add(jogador_id);

                        const jogador = db.query(`
                            SELECT id, time_id
                            FROM jogadores
                            WHERE id = :jogador_id
                            AND time_id IN (:mandante_id, :visitante_id)
                        `).get({
                            ":jogador_id": jogador_id,
                            ":mandante_id": partida.mandante_id,
                            ":visitante_id": partida.visitante_id
                        }) as {
                            id: number;
                            time_id: number;
                        } | null;

                        if (!jogador) {
                            return Response.json(
                                { erro: "Jogador não pertence a nenhum dos times da partida." },
                                { status: 400 }
                            );
                        }

                        if (jogador.time_id === partida.mandante_id) {
                            golsMandante += gols;
                        } else {
                            golsVisitante += gols;
                        }

                        dados.push({
                            jogador_id,
                            gols,
                            assistencias,
                            amarelos,
                            vermelhos
                        });
                    }

                    // CONFERIR SE OS GOLS INDIVIDUAIS BATEM COM O PLACAR
                    if (
                        golsMandante !== partida.gols_mandante ||
                        golsVisitante !== partida.gols_visitante
                    ) {
                        return Response.json(
                            { erro: "A soma dos gols dos jogadores precisa corresponder ao placar." },
                            { status: 400 }
                        );
                    }

                    // SALVAR TUDO EM UMA TRANSAÇÃO
                    const salvar = db.transaction(() => {
                        db.query(`
                            DELETE FROM estatisticas_partida
                            WHERE partida_id = :partida_id
                        `).run({
                            ":partida_id": partida_id
                        });

                        const inserir = db.query(`
                            INSERT INTO estatisticas_partida (
                                partida_id,
                                jogador_id,
                                gols,
                                assistencias,
                                amarelos,
                                vermelhos
                            )
                            VALUES (
                                :partida_id,
                                :jogador_id,
                                :gols,
                                :assistencias,
                                :amarelos,
                                :vermelhos
                            )
                        `);

                        for (const item of dados) {
                            inserir.run({
                                ":partida_id": partida_id,
                                ":jogador_id": item.jogador_id,
                                ":gols": item.gols,
                                ":assistencias": item.assistencias,
                                ":amarelos": item.amarelos,
                                ":vermelhos": item.vermelhos
                            });
                        }
                    });

                    salvar();

                    return Response.json({
                        mensagem: "Estatísticas salvas com sucesso!"
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Erro ao salvar estatísticas." },
                        { status: 500 }
                    );
                }
            }
        },
        "/api/ligas/:id/artilharia": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado." },
                        { status: 401 }
                    );
                }

                const ligaId = Number(req.params.id);

                if (!Number.isInteger(ligaId) || ligaId <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido." },
                        { status: 400 }
                    );
                }

                const liga = db.query(`
            SELECT id
            FROM ligas
            WHERE id = ?
            AND usuario_id = ?
        `).get(ligaId, usuario.id);

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada." },
                        { status: 404 }
                    );
                }

                const artilharia = db.query(`
            SELECT
                jogadores.id AS jogador_id,
                jogadores.nome AS jogador,
                jogadores.numero,
                times.nome AS time,
                SUM(estatisticas_partida.gols) AS gols
            FROM estatisticas_partida
            INNER JOIN partidas
                ON partidas.id = estatisticas_partida.partida_id
            INNER JOIN jogadores
                ON jogadores.id = estatisticas_partida.jogador_id
            INNER JOIN times
                ON times.id = jogadores.time_id
WHERE partidas.liga_id = ?
GROUP BY jogadores.id
HAVING SUM(estatisticas_partida.gols) > 0
ORDER BY gols DESC, jogadores.nome ASC
        `).all(ligaId);

                return Response.json(artilharia);
            }
        },


    }
});

console.log(`Server running at ${srv.url}`);
