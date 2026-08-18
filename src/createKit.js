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
export const createKit = ({ http, ...httpOptions } = {}) => {
  const client = http || createHttpClient(httpOptions);

  return {
    http: client,
    createBaseApi: (endpoint, customMethods) =>
      createBaseApiWithHttp(client, endpoint, customMethods),
    createBaseStore: (config) =>
      createBaseStoreWithHttp({ http: client, ...config }),
    createUseRequest,
  };
};

export default createKit;
