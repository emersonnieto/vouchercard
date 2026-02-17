import "dotenv/config";
import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL não definida no .env");

const pool = new Pool({
  connectionString: databaseUrl,
  // Supabase geralmente exige SSL. Se sua URL já tem sslmode=require,
  // isso ajuda a evitar erro em alguns ambientes.
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => res.json({ message: "API Voucher SaaS rodando 🚀" }));

app.get("/health", async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

app.listen(3333, () => console.log("Servidor rodando na porta 3333"));
