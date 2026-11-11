import { db } from "./db.ts";
import login from "./index.html"
import home from "./home.html"
import ligas from "./ligas.html"
import liga from "./liga.html"
import times from "./times.html"

const logger: any = {}
const srv = Bun.serve({
    port: 3000,
    routes: {
        "/": login,
        "/home": home,
        "/ligas": ligas,
        "/liga": liga,
        "/times": times,
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
                    SELECT * FROM ligas
                    WHERE usuario_id = :usuario_id`);

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
                if (!nome || !Number.isInteger(liga_id) || liga_id < 0) {
                    return Response.json(
                        { msg: "Dados invalidos" },
                        { status: 400 }
                    )
                }

                const verificarLiga = db.query(`
                    SELECT id FROM ligas
                    WHERE id = :id AND usuario_id = :usuario_id`)

                const liga = verificarLiga.get({
                    "id": liga_id,
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
        }
    }
})

console.log(`Server running at ${srv.url}`)