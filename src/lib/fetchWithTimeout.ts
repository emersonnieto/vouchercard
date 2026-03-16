export class ExternalRequestTimeoutError extends Error {
  constructor(
    readonly serviceName: string,
    readonly timeoutMs: number
  ) {
    super(`Tempo limite ao comunicar com ${serviceName}.`);
    this.name = "ExternalRequestTimeoutError";
  }
}

type FetchWithTimeoutOptions = {
  serviceName: string;
  timeoutMs: number;
};

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions
) {
  const controller = new AbortController();
  const upstreamSignal = init.signal;
  let timedOut = false;

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs);

  const abortFromUpstream = () => controller.abort();

  if (upstreamSignal) {
    if (upstreamSignal.aborted) {
      controller.abort();
    } else {
      upstreamSignal.addEventListener("abort", abortFromUpstream, { once: true });
    }
  }

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (timedOut) {
      throw new ExternalRequestTimeoutError(
        options.serviceName,
        options.timeoutMs
      );
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
    upstreamSignal?.removeEventListener("abort", abortFromUpstream);
  }
}
