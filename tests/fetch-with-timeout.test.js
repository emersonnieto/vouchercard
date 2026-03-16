const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ExternalRequestTimeoutError,
  fetchWithTimeout,
} = require("../src/lib/fetchWithTimeout");

test("fetchWithTimeout returns the fetch response when it resolves in time", async () => {
  const originalFetch = global.fetch;
  const fakeResponse = { ok: true, status: 200 };

  global.fetch = async () => fakeResponse;

  try {
    const response = await fetchWithTimeout(
      "https://example.com",
      {},
      { serviceName: "Example", timeoutMs: 50 }
    );

    assert.equal(response, fakeResponse);
  } finally {
    global.fetch = originalFetch;
  }
});

test("fetchWithTimeout aborts and throws ExternalRequestTimeoutError on timeout", async () => {
  const originalFetch = global.fetch;
  let aborted = false;

  global.fetch = (_input, init) =>
    new Promise((_, reject) => {
      init.signal.addEventListener("abort", () => {
        aborted = true;
        reject(new Error("aborted"));
      });
    });

  try {
    await assert.rejects(
      () =>
        fetchWithTimeout(
          "https://example.com",
          {},
          { serviceName: "Example", timeoutMs: 10 }
        ),
      (error) => {
        assert.equal(error instanceof ExternalRequestTimeoutError, true);
        assert.equal(error.message, "Tempo limite ao comunicar com Example.");
        return true;
      }
    );

    assert.equal(aborted, true);
  } finally {
    global.fetch = originalFetch;
  }
});
