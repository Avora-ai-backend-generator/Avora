/** Node-only OAuth client shared by Avora CLI and the desktop editor extension. */
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { mkdir } from "node:fs/promises";
import { lock } from "proper-lockfile";

export interface NativeSession {
  authKind: "browser";
  apiBaseUrl: string;
  issuer: string;
  resource: string;
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export const NATIVE_SCOPES = [
  "native:connect",
  "projects:read",
  "projects:configure",
  "code:read",
  "drafts:read",
  "drafts:write",
];

/** Coordinate token rotation between editor windows sharing the same credential. */
export async function withNativeSessionLock<T>(
  directory: string,
  operation: () => Promise<T>,
): Promise<T> {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const release = await lock(directory, {
    retries: { retries: 160, minTimeout: 100, maxTimeout: 250 },
    stale: 60000,
  });
  try {
    return await operation();
  } finally {
    await release();
  }
}

export function normalizeAuthBase(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  ) {
    throw new Error(
      "Avora login requires HTTPS (or a local development server).",
    );
  }
  return url
    .toString()
    .replace(/\/$/, "")
    .replace(/\/api\/v1$/, "");
}

async function jsonRequest(
  url: string,
  init: RequestInit,
  signal?: AbortSignal,
): Promise<any> {
  const response = await fetch(url, {
    ...init,
    redirect: "error",
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
      : AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (data.error === "invalid_grant")
      throw new Error("Your connection expired or was revoked. Sign in again.");
    // Do not echo arbitrary server bodies, callback codes, or tokens into logs.
    throw new Error(
      `Avora authorization failed (${response.status}). Please retry signing in.`,
    );
  }
  return data;
}

function tokenSession(
  data: any,
  previous: Omit<NativeSession, "accessToken" | "refreshToken" | "expiresAt">,
): NativeSession {
  if (
    typeof data.access_token !== "string" ||
    !data.access_token ||
    typeof data.refresh_token !== "string" ||
    !data.refresh_token ||
    !Number.isFinite(data.expires_in) ||
    data.expires_in <= 0 ||
    String(data.token_type).toLowerCase() !== "bearer"
  ) {
    throw new Error("Avora returned an incomplete connection. Sign in again.");
  }
  return {
    ...previous,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
}

export async function browserLogin(options: {
  apiBaseUrl: string;
  clientName: string;
  openBrowser: (url: string) => Promise<unknown>;
  resolveRedirect?: (loopback: string) => Promise<string>;
  signal?: AbortSignal;
  timeoutMs?: number;
}): Promise<NativeSession> {
  const base = normalizeAuthBase(options.apiBaseUrl);
  const timeout = new AbortController();
  const signal = options.signal
    ? AbortSignal.any([timeout.signal, options.signal])
    : timeout.signal;
  const timer = setTimeout(
    () => timeout.abort(new Error("Login timed out. Run login again.")),
    options.timeoutMs ?? 300000,
  );
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let resolveCode!: (code: string) => void;
  let rejectCode!: (error: Error) => void;
  const codePromise = new Promise<string>((resolve, reject) => {
    resolveCode = resolve;
    rejectCode = reject;
  });
  void codePromise.catch(() => {});
  let received = false;
  const server = createServer((request, response) => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader(
      "Content-Security-Policy",
      "default-src 'none'; frame-ancestors 'none'",
    );
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (request.method !== "GET" || url.pathname !== "/avora/callback") {
      response.writeHead(404).end();
      return;
    }
    if (
      received ||
      url.searchParams.getAll("state").length !== 1 ||
      url.searchParams.get("state") !== state ||
      url.searchParams.getAll("iss").length !== 1 ||
      url.searchParams.get("iss") !== base
    ) {
      response
        .writeHead(400)
        .end("Invalid connection response. Return to your application.");
      return;
    }
    received = true;
    if (url.searchParams.has("error")) {
      response.end("Connection cancelled. You can close this tab.");
      rejectCode(new Error("Connection cancelled. No access was granted."));
    } else if (
      url.searchParams.getAll("code").length !== 1 ||
      !url.searchParams.get("code")
    ) {
      response.writeHead(400).end("Missing authorization code.");
      rejectCode(new Error("Missing authorization code. Sign in again."));
    } else {
      response.end(
        "Approval received. Return to Avora CLI or your editor. You can close this tab.",
      );
      resolveCode(url.searchParams.get("code")!);
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 10000;
  const abort = () =>
    rejectCode(
      new Error(
        signal.reason instanceof Error
          ? signal.reason.message
          : "Login cancelled.",
      ),
    );
  signal.addEventListener("abort", abort, { once: true });
  try {
    signal.throwIfAborted();
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.removeListener("error", reject);
        resolve();
      });
    });
    const localRedirect = `http://127.0.0.1:${(server.address() as AddressInfo).port}/avora/callback`;
    const redirectUri = options.resolveRedirect
      ? await options.resolveRedirect(localRedirect)
      : localRedirect;
    const metadata = await jsonRequest(
      `${base}/.well-known/oauth-authorization-server`,
      {},
      signal,
    );
    if (
      metadata.issuer !== base ||
      metadata.native_api_resource !== `${base}/api/v1` ||
      metadata.authorization_endpoint !== `${base}/oauth/authorize` ||
      metadata.token_endpoint !== `${base}/oauth/token` ||
      metadata.registration_endpoint !== `${base}/oauth/register`
    ) {
      throw new Error(
        "This server does not support Avora browser login. Check the configured API URL and server version.",
      );
    }
    const registered = await jsonRequest(
      metadata.registration_endpoint,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: options.clientName,
          redirect_uris: [redirectUri],
          token_endpoint_auth_method: "none",
          grant_types: ["authorization_code", "refresh_token"],
          response_types: ["code"],
        }),
      },
      signal,
    );
    if (typeof registered.client_id !== "string" || !registered.client_id)
      throw new Error("Application registration failed.");
    const params = new URLSearchParams({
      client_id: registered.client_id,
      response_type: "code",
      redirect_uri: redirectUri,
      state,
      scope: NATIVE_SCOPES.join(" "),
      resource: metadata.native_api_resource,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });
    await options.openBrowser(`${metadata.authorization_endpoint}?${params}`);
    const code = await codePromise;
    const data = await jsonRequest(
      metadata.token_endpoint,
      {
        method: "POST",
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: registered.client_id,
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier,
          resource: metadata.native_api_resource,
        }),
      },
      signal,
    );
    return tokenSession(data, {
      authKind: "browser",
      apiBaseUrl: base,
      issuer: base,
      resource: metadata.native_api_resource,
      clientId: registered.client_id,
    });
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function sessionBase(session: NativeSession): string {
  const base = normalizeAuthBase(session.apiBaseUrl);
  if (base !== session.issuer || session.resource !== `${base}/api/v1`)
    throw new Error("Connection server changed. Sign in again.");
  return base;
}

export async function refreshNativeSession(
  session: NativeSession,
): Promise<NativeSession> {
  const data = await jsonRequest(`${sessionBase(session)}/oauth/token`, {
    method: "POST",
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: session.clientId,
      refresh_token: session.refreshToken,
      resource: session.resource,
    }),
  });
  return tokenSession(data, session);
}

export async function revokeNativeSession(
  session: NativeSession,
): Promise<void> {
  await jsonRequest(`${sessionBase(session)}/oauth/revoke`, {
    method: "POST",
    body: new URLSearchParams({
      client_id: session.clientId,
      token: session.refreshToken,
    }),
  });
}
