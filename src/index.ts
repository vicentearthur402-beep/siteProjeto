import { db } from "./db.ts";
import login from "./index.html"
import home from "./home.html"
import ligas from "./ligas.html"
import liga from "./liga.html"
import times from "./times.html"
import partidas from "./partidas.html"
import jogos from "./jogos.html";

const logger: any = {}
const srv = Bun.serve({
    port: 3000,
    routes: {
        "/": login,
        "/home": home,
        "/ligas": ligas,
        "/liga": liga,
        "/times": times,
        "/partidas": partidas,
        "/jogos": jogos,
        "/register": {
            POST: async (req) => {
                const body = await req.body?.json()
                const query = db.query(`
                    INSERT INTO user (username, email, password_hash)
                    VALUES (:username, :email, :password_hash);
                    `)
                const hash = await Bun.password.hash(body.password)
                const data = query.run({ ":username": body.username, ":email": body.email, ":password_hash": hash })
                return Response.json(data)
            }
        },

        "/api/ligas": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado" },
                        { status: 401 }
                    );
                }
                const query = db.query(`
                    SELECT
                        ligas.*,
                        COUNT(times.id) AS times
                    FROM ligas
                 LEFT JOIN times
                       ON times.liga_id = ligas.id
                   WHERE ligas.usuario_id = :usuario_id
                   GROUP BY ligas.id
`);

                const ligas = query.all({
                    ":usuario_id": usuario.id
                }
                );

                return Response.json(ligas)
            },

            POST: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado", },
                        { status: 401 }
                    );
                }
                const body = await req.json();
                console.log("Dados recebidos:", body);

                const query = db.query(`
        INSERT INTO ligas (nome, descricao, data_criacao, usuario_id)
        VALUES (:nome, :descricao, :data_criacao, :usuario_id)
    `);

                const data = query.run({
                    ":nome": body.nome,
                    ":descricao": body.descricao,
                    ":data_criacao": new Date().toISOString().split("T")[0],
                    ":usuario_id": usuario.id
                });
                console.log("Resultado:", data);

                return Response.json(data);
            }
        },



        "/api/ligas/:id/placares": {
            PUT: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado" },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido" },
                        { status: 400 }
                    );
                }

                const liga = db.query(`
            SELECT id FROM ligas
            WHERE id = :id AND usuario_id = :usuario_id
        `).get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada" },
                        { status: 404 }
                    );
                }

                try {
                    const { partidas } = await req.json();

                    if (!Array.isArray(partidas)) {
                        return Response.json(
                            { erro: "Lista de partidas inválida" },
                            { status: 400 }
                        );
                    }

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
                                { erro: "Um ou mais placares são inválidos" },
                                { status: 400 }
                            );
                        }

                        const encontrada = db.query(`
                    SELECT id FROM partidas
                    WHERE id = :id AND liga_id = :liga_id
                `).get({
                            ":id": id,
                            ":liga_id": liga_id
                        });

                        if (!encontrada) {
                            return Response.json(
                                { erro: "Partida não encontrada nesta liga" },
                                { status: 404 }
                            );
                        }
                    }

                    const atualizar = db.query(`
                UPDATE partidas
                SET
                    gols_mandante = :gols_mandante,
                    gols_visitante = :gols_visitante
                WHERE id = :id AND liga_id = :liga_id
            `);

                    const salvar = db.transaction(() => {
                        for (const partida of partidas) {
                            atualizar.run({
                                ":gols_mandante": partida.gols_mandante,
                                ":gols_visitante": partida.gols_visitante,
                                ":id": Number(partida.id),
                                ":liga_id": liga_id
                            });
                        }
                    });

                    salvar();

                    return Response.json({
                        mensagem: "Resultados salvos com sucesso!"
                    });

                } catch (erro) {
                    console.error(erro);

                    return Response.json(
                        { erro: "Erro ao salvar resultados" },
                        { status: 500 }
                    );
                }
            }
        },

        "/api/ligas/:id/classificacao": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado" },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                const liga = db.query(`
            SELECT id FROM ligas
            WHERE id = :id AND usuario_id = :usuario_id
        `).get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada" },
                        { status: 404 }
                    );
                }

                const times = db.query(`
            SELECT id, nome FROM times
            WHERE liga_id = :liga_id
        `).all({ ":liga_id": liga_id }) as {
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
        `).all({ ":liga_id": liga_id }) as {
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



        "/login": {
            POST: async (req) => {
                const body = await req.body?.json()
                const query = db.query(`SELECT * FROM user WHERE username=:username LIMIT 1`)
                const data: any = query.get({
                    ":username": body.username
                })
                if (!data) {
                    return Response.json(
                        { msg: "User Not Found" },
                        { status: 404 }
                    )
                }
                const hash = data.password_hash
                const ismatch = await Bun.password.verify(body.password, hash)

                if (!ismatch) {
                    return Response.json({ msg: "nao senha" }, { status: 401 })
                }
                const uuid = crypto.randomUUID()
                delete data.password_hash
                logger[uuid] = data
                req.cookies.set("ses", uuid)
                return Response.json(ismatch)
            }
        },
        "/login/user": (req) => {
            const ses = req.cookies.get("ses") as string
            const data = logger[ses]
            if (!ses || !data)
                return Response.json({ msg: "usuário não logado" }, { status: 401 })
            return Response.json(data)
        },
        "/api/ligas/:id": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não encontrado" },
                        { status: 401 }
                    );
                }

                const id = Number(req.params.id);

                const query = db.query(`
                    SELECT * FROM ligas
                    WHERE id = :id AND usuario_id = :usuario_id
                    `);

                const liga = query.get({
                    ":id": id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { msg: "Liga não encontrada" },
                        { status: 404 }
                    )
                }

                return Response.json(liga)
            },

            PUT: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado" },
                        { status: 401 }
                    );
                }

                const id = Number(req.params.id);

                if (!Number.isInteger(id) || id <= 0) {
                    return Response.json(
                        { msg: "ID inválido" },
                        { status: 400 }
                    );
                }

                const body = await req.json();

                const query = db.query(`
        UPDATE ligas
        SET nome = :nome, descricao = :descricao
        WHERE id = :id AND usuario_id = :usuario_id
    `);

                const resultado = query.run({
                    ":nome": body.nome,
                    ":descricao": body.descricao,
                    ":id": id,
                    ":usuario_id": usuario.id
                });

                if (resultado.changes === 0) {
                    return Response.json(
                        { msg: "Liga não encontrada" },
                        { status: 404 }
                    );
                }

                return Response.json({
                    msg: "Liga atualizada com sucesso!"
                });
            },


            DELETE: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado" },
                        { status: 401 }
                    )
                }

                const id = Number(req.params.id);

                if (!Number.isInteger(id) || id <= 0) {
                    return Response.json(
                        { msg: "Id inválido" },
                        { status: 400 }
                    )
                }

                const verificarLiga = db.query(`
                    SELECT id FROM ligas
                    where id = :id AND usuario_id = :usuario_id`)

                const liga = verificarLiga.get({
                    ":id": id,
                    ":usuario_id": usuario.id
                })

                if (!liga) {
                    return Response.json(
                        { msg: "Liga não encontrada" },
                        { status: 404 }
                    )
                }

                const excluir = db.transaction(() => {
                    db.query(`
                      DELETE FROM times
                      WHERE liga_id = :id
                    `).run({ ":id": id });

                    db.query(`
                    DELETE FROM ligas
                    WHERE id = :id AND usuario_id = :usuario_id
                    `).run({
                        ":id": id,
                        ":usuario_id": usuario.id
                    });
                });

                excluir();

                return Response.json({
                    msg: "Liga excluída com sucesso!"
                })

            }


        },

        "/api/ligas/:id/dashboard": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado" },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido" },
                        { status: 400 }
                    );
                }

                const verificarLiga = db.query(`
            SELECT id FROM ligas
            WHERE id = :id AND usuario_id = :usuario_id
        `);

                const liga = verificarLiga.get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada" },
                        { status: 404 }
                    );
                }

                const dashboard = db.query(`
            SELECT
                (SELECT COUNT(*)
                 FROM times
                 WHERE liga_id = :liga_id) AS totalTimes,

                (SELECT COUNT(*)
                 FROM partidas
                 WHERE liga_id = :liga_id) AS totalPartidas,

                (SELECT COUNT(*)
                 FROM partidas
                 WHERE liga_id = :liga_id
                 AND gols_mandante IS NOT NULL
                 AND gols_visitante IS NOT NULL) AS partidasDisputadas,

                (SELECT COUNT(*)
                 FROM partidas
                 WHERE liga_id = :liga_id
                 AND (
                     gols_mandante IS NULL
                     OR gols_visitante IS NULL
                 )) AS partidasRestantes
        `);

                const dados = dashboard.get({
                    ":liga_id": liga_id
                });

                return Response.json(dados);
            }
        },

        "/api/times": {
            POST: async (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado" },
                        { status: 401 }
                    );
                }

                const body = await req.json();

                const nome = String(body.nome ?? "").trim();
                const liga_id = Number(body.liga_id)
                if (!nome || !Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { msg: "Dados invalidos" },
                        { status: 400 }
                    )
                }

                const verificarLiga = db.query(`
                    SELECT id FROM ligas
                    WHERE id = :id AND usuario_id = :usuario_id`)

                const liga = verificarLiga.get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                })

                if (!liga) {
                    return Response.json(
                        { msg: "Liga não encontrada" },
                        { status: 404 }
                    );
                }

                const query = db.query(`
            INSERT INTO times (nome, liga_id)
            VALUES (:nome, :liga_id)
        `);

                const resultado = query.run({
                    ":nome": nome,
                    ":liga_id": liga_id
                });
                return Response.json(
                    {
                        msg: "Time cadastrado com sucesso!",
                        id: resultado.lastInsertRowid
                    },
                    { status: 201 }
                )
            }
        },

        "/api/ligas/:id/times": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { msg: "Usuário não autenticado" },
                        { status: 401 }
                    );
                }

                const id = Number(req.params.id);

                const verificarLiga = db.query(`
            SELECT id FROM ligas
            WHERE id = :id AND usuario_id = :usuario_id
        `);

                const liga = verificarLiga.get({
                    ":id": id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { msg: "Liga não encontrada" },
                        { status: 404 }
                    );
                }

                const query = db.query(`
            SELECT * FROM times
            WHERE liga_id = :liga_id
            ORDER BY nome ASC
        `);

                const times = query.all({
                    ":liga_id": id
                });

                return Response.json(times);
            },
        },
        "/api/ligas/:id/gerar-partidas": {
            async POST(req) {
                const sessao = req.cookies.get("ses");
                const usuario = logger[sessao];

                if (!usuario) {
                    return Response.json(
                        { erro: "Não autenticado" },
                        { status: 401 }
                    );
                }

                const { id } = req.params;
                const liga_id = Number(id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID da liga inválido" },
                        { status: 400 }
                    );
                }

                const verificarLiga = db.query(`
            SELECT id FROM ligas
            WHERE id = :id AND usuario_id = :usuario_id
        `);

                const liga = verificarLiga.get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada" },
                        { status: 404 }
                    );
                }

                const buscarTimes = db.query(`
            SELECT id, nome FROM times
            WHERE liga_id = :liga_id
            ORDER BY id ASC
        `);

                const times = buscarTimes.all({
                    ":liga_id": liga_id
                });

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

                // Adiciona uma vaga vazia caso a quantidade de times seja ímpar
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

                // Geração do primeiro turno
                for (let rodada = 1; rodada <= totalRodadas; rodada++) {

                    for (let i = 0; i < totalTimes / 2; i++) {

                        const timeA = participantes[i];
                        const timeB = participantes[totalTimes - 1 - i];

                        // Se algum time estiver na vaga vazia, ele folga
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

                    // Rotaciona os times para a próxima rodada
                    const ultimo = participantes.pop()!;
                    participantes.splice(1, 0, ultimo);
                }

                // Geração do segundo turno, invertendo os mandos
                const partidasSegundoTurno = partidas.map(partida => ({
                    mandante_id: partida.visitante_id,
                    visitante_id: partida.mandante_id,
                    turno: 2,
                    rodada: partida.rodada
                }));

                partidas.push(...partidasSegundoTurno);

                // Salva todas as partidas no banco de dados
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
            }
        },
        "/api/ligas/:id/partidas": {
            GET: (req) => {
                const ses = req.cookies.get("ses");
                const usuario = logger[ses];

                if (!usuario) {
                    return Response.json(
                        { erro: "Usuário não autenticado" },
                        { status: 401 }
                    );
                }

                const liga_id = Number(req.params.id);

                if (!Number.isInteger(liga_id) || liga_id <= 0) {
                    return Response.json(
                        { erro: "ID inválido" },
                        { status: 400 }
                    );
                }

                const verificarLiga = db.query(`
            SELECT id FROM ligas
            WHERE id = :id AND usuario_id = :usuario_id
        `);

                const liga = verificarLiga.get({
                    ":id": liga_id,
                    ":usuario_id": usuario.id
                });

                if (!liga) {
                    return Response.json(
                        { erro: "Liga não encontrada" },
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
    },
})

console.log(`Server running at ${srv.url}`)