import { db } from "./db.ts";
import login from "./index.html"
import home from "./home.html"
import ligas from "./ligas.html"

const logger: any = {}
const srv = Bun.serve({
    port: 3000,
    routes: {
        "/": login,
        "/home": home,
        "/ligas": ligas,
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
            GET: () => {
                const query = db.query(`
                    SELECT * FROM ligas`);

                const ligas = query.all();

                return Response.json(ligas)
            },

            POST: async (req) => {
                const body = await req.json();
                console.log("Dados recebidos:", body);

                const query = db.query(`
        INSERT INTO ligas (nome, descricao, data_criacao)
        VALUES (:nome, :descricao, :data_criacao)
    `);

                const data = query.run({
                    ":nome": body.nome,
                    ":descricao": body.descricao,
                    ":data_criacao": new Date().toISOString().split("T")[0]
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
        }
    }
})

console.log(`Server running at ${srv.url}`)