const test = require("node:test");
const assert = require("node:assert/strict");

const {
  signJwt,
  verifyJwt,
} = require("../src/auth/jwt");
const {
  readSuperadminEmailAllowlist,
  resolveAgencyUserRole,
  resolveLoginUserRole,
} = require("../src/auth/userRoles");
const { requireAuth } = require("../src/middlewares/requireAuth");
const { requireRole } = require("../src/middlewares/requireRole");
const { resolveVoucherAgencyId } = require("../src/modules/admin/voucherScope");

function createResponseRecorder() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test.beforeEach(() => {
  process.env.JWT_SECRET = "test-secret-for-suite";
});

test("signJwt and verifyJwt round-trip payload", () => {
  const token = signJwt({
    userId: "user-1",
    agencyId: "agency-1",
    role: "ADMIN",
  });

  const decoded = verifyJwt(token);

  assert.equal(decoded.userId, "user-1");
  assert.equal(decoded.agencyId, "agency-1");
  assert.equal(decoded.role, "ADMIN");
});

test("requireAuth rejects requests without bearer token", () => {
  const req = {
    header() {
      return undefined;
    },
  };
  const res = createResponseRecorder();
  let calledNext = false;

  requireAuth(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { message: "Token ausente" });
});

test("requireAuth accepts valid bearer token and hydrates req.user", () => {
  const token = signJwt({
    userId: "user-2",
    agencyId: "agency-2",
    role: "SUPERADMIN",
  });
  const req = {
    user: undefined,
    header(name) {
      return name === "authorization" ? `Bearer ${token}` : undefined;
    },
  };
  const res = createResponseRecorder();
  let calledNext = false;

  requireAuth(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.deepEqual(req.user, {
    userId: "user-2",
    agencyId: "agency-2",
    role: "SUPERADMIN",
  });
});

test("requireRole blocks users outside the allowed list", () => {
  const req = {
    user: {
      userId: "user-3",
      agencyId: "agency-3",
      role: "ADMIN",
    },
  };
  const res = createResponseRecorder();
  let calledNext = false;

  requireRole(["SUPERADMIN"])(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, false);
  assert.equal(res.statusCode, 403);
  assert.equal(typeof res.body?.message, "string");
  assert.match(res.body.message, /^Sem permiss/i);
});

test("requireRole allows users inside the allowed list", () => {
  const req = {
    user: {
      userId: "user-4",
      agencyId: "agency-4",
      role: "SUPERADMIN",
    },
  };
  const res = createResponseRecorder();
  let calledNext = false;

  requireRole(["SUPERADMIN"])(req, res, () => {
    calledNext = true;
  });

  assert.equal(calledNext, true);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body, undefined);
});

test("resolveVoucherAgencyId uses explicit agency for SUPERADMIN", () => {
  const agencyId = resolveVoucherAgencyId(
    {
      user: {
        userId: "super-1",
        agencyId: null,
        role: "SUPERADMIN",
      },
    },
    "agency-explicit"
  );

  assert.equal(agencyId, "agency-explicit");
});

test("resolveVoucherAgencyId ignores explicit agency for non-superadmin", () => {
  const agencyId = resolveVoucherAgencyId(
    {
      user: {
        userId: "admin-1",
        agencyId: "agency-from-token",
        role: "ADMIN",
      },
    },
    "agency-explicit"
  );

  assert.equal(agencyId, "agency-from-token");
});

test("resolveVoucherAgencyId falls back to token agency for SUPERADMIN when no explicit scope", () => {
  const agencyId = resolveVoucherAgencyId({
    user: {
      userId: "super-2",
      agencyId: "agency-from-token",
      role: "SUPERADMIN",
    },
  });

  assert.equal(agencyId, "agency-from-token");
});

test("resolveLoginUserRole keeps SUPERADMIN only for allowlisted emails", () => {
  const allowlist = readSuperadminEmailAllowlist(
    "owner@example.com, ops@example.com "
  );

  assert.equal(
    resolveLoginUserRole({
      dbRole: "SUPERADMIN",
      email: "owner@example.com",
      allowedSuperadminEmails: allowlist,
    }),
    "SUPERADMIN"
  );

  assert.equal(
    resolveLoginUserRole({
      dbRole: "SUPERADMIN",
      email: "agency@example.com",
      allowedSuperadminEmails: allowlist,
    }),
    "ADMIN"
  );
});

test("resolveAgencyUserRole rejects SUPERADMIN in agency flow", () => {
  assert.deepEqual(resolveAgencyUserRole(undefined), {
    ok: true,
    role: "ADMIN",
  });

  assert.deepEqual(resolveAgencyUserRole("ADMIN"), {
    ok: true,
    role: "ADMIN",
  });

  assert.equal(resolveAgencyUserRole("SUPERADMIN").ok, false);
});
