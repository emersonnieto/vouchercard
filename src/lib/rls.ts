import { Prisma } from "@prisma/client";
import { UserRole } from "../auth/jwt";
import { appPrisma, isDedicatedAppDatabaseUrlConfigured } from "./prisma";

export type RlsDbClient = Prisma.TransactionClient;

type RlsActor = {
  userId: string;
  agencyId?: string | null;
  role: UserRole;
};

let warnedAboutRlsFallback = false;

function warnAboutRlsFallback() {
  if (warnedAboutRlsFallback || isDedicatedAppDatabaseUrlConfigured) {
    return;
  }

  warnedAboutRlsFallback = true;
  console.warn(
    "[RLS] DATABASE_URL_APP nao configurada; rotas autenticadas estao usando DATABASE_URL e o isolamento real depende de esse usuario nao ter BYPASSRLS."
  );
}

export async function runWithRlsContext<T>(
  actor: RlsActor,
  callback: (db: RlsDbClient) => Promise<T>
) {
  warnAboutRlsFallback();

  return appPrisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      select
        set_config('app.user_id', ${actor.userId}, true),
        set_config('app.agency_id', ${String(actor.agencyId ?? "")}, true),
        set_config('app.role', ${actor.role}, true),
        set_config('app.access_mode', 'app', true)
    `;

    return callback(tx);
  });
}
