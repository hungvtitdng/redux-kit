import createHttpClient from "./http/createHttpClient.js";
import createBaseApiWithHttp from "./createBaseApi.js";
import { createBaseStore as createBaseStoreWithHttp } from "./base/index.js";
import { createUseRequest } from "./createUseRequest.js";

/**
 * Bind the kit to one HTTP client so modules don't repeat it.
 *
 * Nothing is stored in module scope — the client lives in this closure, so a
 * second kit (different baseURL, different auth) is just a second call.
 *
 * @param {Object} options - an existing client via `http`, otherwise createHttpClient options
 * @param {boolean} [options.envelope] - responses are `{ data, message }`: selectors get `data`,
 *   `message` goes to `state.message` (passed to every createBaseStore)
 * @param {Object} [options.methods] - HTTP verb per CRUD method for every module, e.g. { update: "put" };
 *   a module's own `methods` wins
 * @returns {Object} { http, createBaseApi, createBaseStore, createUseRequest }
 *
 * @example
 * export const { http, createBaseStore, createUseRequest } = createKit({
 *   baseURL: API_URL,
 *   getToken: () => localStorage.getItem("token"),
 *   notifyError: (message) => toast.error(message),
 *   onUnauthorized: () => signOut(),
 * })
 */
export const createKit = ({ http, envelope = false, methods = {}, ...httpOptions } = {}) => {
  const client = http || createHttpClient(httpOptions);

  return {
    http: client,
    createBaseApi: (endpoint, customMethods, moduleMethods) =>
      createBaseApiWithHttp(client, endpoint, customMethods, { ...methods, ...moduleMethods }),
    createBaseStore: (config) =>
      createBaseStoreWithHttp({
        http: client,
        envelope,
        ...config,
        methods: { ...methods, ...config.methods },
      }),
    createUseRequest,
  };
};

export default createKit;
