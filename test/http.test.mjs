import test from "node:test"
import assert from "node:assert/strict"
import { createHttpClient, createErrorHandler } from "../src/index.js"

// Drive the interceptors directly: no network, no axios adapter needed.
const interceptorsOf = (options = {}) => {
  const client = createHttpClient({ baseURL: "http://x", ...options })
  const request = client.interceptors.request.handlers[0].fulfilled
  const [{ fulfilled, rejected }] = client.interceptors.response.handlers
  return { request, response: fulfilled, error: rejected }
}

test("request interceptor: token and locale headers", () => {
  const { request } = interceptorsOf({ getToken: () => "t0k", getLocale: () => "vi" })

  assert.deepEqual(request({ headers: {} }).headers, { Authorization: "Bearer t0k", Localization: "vi" })
})

test("request interceptor: no token, no headers", () => {
  const { request } = interceptorsOf({ getToken: () => null, getLocale: () => "vi" })

  assert.deepEqual(request({ headers: {} }).headers, {})
})

test("response interceptor unwraps data and notifies once", () => {
  const notified = []
  const { response } = interceptorsOf({
    notifySuccess: (message) => notified.push(message),
    silentSuccessPaths: ["/login"],
    silentSuccessSubPaths: ["/invites/verify/"],
  })

  assert.deepEqual(response({ config: { url: "/quotes" }, data: { message: "Saved", data: 1 } }), { message: "Saved", data: 1 })
  response({ config: { url: "/login" }, data: { message: "hidden" } })
  response({ config: { url: "/invites/verify/abc" }, data: { message: "hidden" } })

  assert.deepEqual(notified, ["Saved"])
})

test("error handler: 401 logs out, 422 lists field errors, 404 can be silenced", async () => {
  const errors = []
  const unauthorized = []
  const handle = createErrorHandler({
    notifyError: (message) => errors.push(message),
    onUnauthorized: () => unauthorized.push(true),
    silentNotFoundSubPaths: ["/invites/verify/"],
  })

  const reject = (error) => handle(error).then(() => "resolved", (payload) => payload)

  assert.deepEqual(await reject({ response: { status: 401, data: {}, config: { url: "/me" } } }), {})
  assert.equal(unauthorized.length, 1)

  await reject({ response: { status: 422, data: { errors: { email: ["is invalid", "is taken"] } }, config: { url: "/users" } } })
  await reject({ response: { status: 404, data: {}, config: { url: "/invites/verify/abc" } } })
  await reject({ response: { status: 404, data: {}, config: { url: "/quotes/9" } } })
  await reject({ message: "Network Error" })

  assert.deepEqual(errors, ["is invalid", "is taken", "404 Not Found", "Network Error"])
})
