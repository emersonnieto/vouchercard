const test = require("node:test");
const assert = require("node:assert/strict");

const {
  SIGNUP_EMAIL_IN_USE_MESSAGE,
  SIGNUP_EMAIL_RESERVED_MESSAGE,
  resolveSignupEmailPolicy,
} = require("../src/modules/billing/signupEmailPolicy");

test("resolveSignupEmailPolicy allows a brand new email", () => {
  assert.deepEqual(resolveSignupEmailPolicy(null), {
    status: "available",
  });
});

test("resolveSignupEmailPolicy blocks reserved superadmin emails", () => {
  assert.deepEqual(
    resolveSignupEmailPolicy({
      role: "superadmin",
      agency: {
        isActive: true,
      },
    }),
    {
      status: "reserved",
      message: SIGNUP_EMAIL_RESERVED_MESSAGE,
    }
  );
});

test("resolveSignupEmailPolicy blocks emails already tied to an active panel login", () => {
  assert.deepEqual(
    resolveSignupEmailPolicy({
      role: "ADMIN",
      agency: {
        isActive: true,
      },
    }),
    {
      status: "in_use",
      message: SIGNUP_EMAIL_IN_USE_MESSAGE,
    }
  );
});

test("resolveSignupEmailPolicy allows reusing an inactive signup account", () => {
  assert.deepEqual(
    resolveSignupEmailPolicy({
      role: "ADMIN",
      agency: {
        isActive: false,
      },
    }),
    {
      status: "reusable",
    }
  );
});
