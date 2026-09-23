import test from "node:test";
import assert from "node:assert/strict";
import { createHttpClient, createErrorHandler } from "../src/index.js";

// Drive the interceptors directly: no network, no axios adapter needed.
const interceptorsOf = (options = {}) => {
  const client = createHttpClient({ baseURL: "http://x", ...options });
  const request = client.interceptors.request.handlers[0].fulfilled;
  const [{ fulfilled, rejected }] = client.interceptors.response.handlers;
  return { request, response: fulfilled, error: rejected };
};

test("request interceptor: token and locale headers", () => {
  const { request } = interceptorsOf({
    getToken: () => "t0k",
    getLocale: () => "vi",
  });

  assert.deepEqual(request({ headers: {} }).headers, {
    Authorization: "Bearer t0k",
    "Accept-Language": "vi",
  });
});

test("request interceptor: no token still sends the locale", () => {
  const { request } = interceptorsOf({
    getToken: () => null,
    getLocale: () => "vi",
  });

  assert.deepEqual(request({ headers: {} }).headers, { "Accept-Language": "vi" });
});

test("response interceptor unwraps data and notifies once", () => {
  const notified = [];
  const { response } = interceptorsOf({
    notifySuccess: (message) => notified.push(message),
    silentSuccessPaths: ["/login"],
    silentSuccessSubPaths: ["/invites/verify/"],
  });

  assert.deepEqual(
    response({
      config: { url: "/quotes" },
      data: { message: "Saved", data: 1 },
    }),
    { message: "Saved", data: 1 },
  );
  response({ config: { url: "/login" }, data: { message: "hidden" } });
  response({
    config: { url: "/invites/verify/abc" },
    data: { message: "hidden" },
  });

  assert.deepEqual(notified, ["Saved"]);
});

test("error handler: 401 logs out, 422 lists field errors, 404 can be silenced", async () => {
  const errors = [];
  const unauthorized = [];
  const handle = createErrorHandler({
    notifyError: (message) => errors.push(message),
    onUnauthorized: () => unauthorized.push(true),
    silentNotFoundSubPaths: ["/invites/verify/"],
  });

  const reject = (error) =>
    handle(error).then(
      () => "resolved",
      (payload) => payload,
    );

  assert.deepEqual(
    await reject({
      response: { status: 401, data: {}, config: { url: "/me" } },
    }),
    {},
  );
  assert.equal(unauthorized.length, 1);

  await reject({
    response: {
      status: 422,
      data: { errors: { email: ["is invalid", "is taken"] } },
      config: { url: "/users" },
    },
  });
  await reject({
    response: { status: 404, data: {}, config: { url: "/invites/verify/abc" } },
  });
  await reject({
    response: { status: 404, data: {}, config: { url: "/quotes/9" } },
  });
  await reject({ message: "Network Error" });

  assert.deepEqual(errors, [
    "is invalid",
    "is taken",
    "404 Not Found",
    "Network Error",
  ]);
});

test("getSuccessMessage decides the toast: silent GET, fallback text on POST", () => {
  const notified = [];
  const { response } = interceptorsOf({
    notifySuccess: (message) => notified.push(message),
    getSuccessMessage: ({ config, data }) =>
      config.method === "get" ? null : data?.message || "Saved!",
  });

  response({ config: { url: "/trips", method: "get" }, data: { message: "OK" } });
  response({ config: { url: "/trips", method: "post" }, data: {} });
  response({ config: { url: "/trips/1", method: "patch" }, data: { message: "Updated" } });

  assert.deepEqual(notified, ["Saved!", "Updated"]);
});

test("error handler: notifyFieldErrors off, server 403 text, network message, reject the error", async () => {
  const errors = [];
  let lang = "en";
  const handle = createErrorHandler({
    notifyError: (message) => errors.push(message),
    notifyFieldErrors: false,
    messages: { network: () => (lang === "vi" ? "Lỗi mạng" : "Network down") },
  });
  const reject = (error) => handle(error).then(() => "resolved", (payload) => payload);

  // 422 with field errors: the form shows them, no toast
  await reject({
    response: { status: 422, data: { message: "Invalid", errors: { email: ["taken"] } }, config: {} },
  });
  // 422 without field errors: toast the general message
  await reject({ response: { status: 422, data: { message: "Wrong password" }, config: {} } });
  await reject({ response: { status: 403, data: { message: "Not your trip" }, config: {} } });
  await reject({ response: { status: 403, data: {}, config: {} } });

  const networkError = { message: "Network Error" };
  assert.equal(await reject(networkError), networkError);
  lang = "vi";
  await reject({ message: "Network Error" });

  assert.deepEqual(errors, [
    "Wrong password",
    "Not your trip",
    "403 Forbidden",
    "Network down",
    "Lỗi mạng",
  ]);
});

test("request interceptor: localeHeader renames the locale header", () => {
  const { request } = interceptorsOf({
    getLocale: () => "vi",
    localeHeader: "Localization",
  });

  assert.deepEqual(request({ headers: {} }).headers, { Localization: "vi" });
});
