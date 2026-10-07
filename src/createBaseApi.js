/**
 * Base API Factory (port of src/api/base.jsx)
 * Create CRUD API functions for an endpoint, plus any custom methods.
 *
 * @param {Object} http - HTTP client (see createHttpClient)
 * @param {string} endpoint - e.g. "/categories" or "categories"
 * @param {Object} [customMethods] - extra/overriding methods
 * @param {Object} [methods] - HTTP verb per CRUD method, e.g. { update: "put" }
 * @returns {Object} api object
 */
export const DEFAULT_METHODS = {
  list: "get",
  store: "post",
  detail: "get",
  update: "patch",
  destroy: "delete",
};

// Verbs without a request body: params go in the query string
const BODYLESS = ["get", "delete", "head", "options"];

export const createBaseApi = (
  http,
  endpoint = null,
  customMethods = {},
  methods = {},
) => {
  if (!endpoint) return customMethods;

  if (!http) {
    throw new Error(
      `@hungvt/redux-kit: createBaseApi("${endpoint}") needs an http client`,
    );
  }

  const verbs = { ...DEFAULT_METHODS, ...methods };
  Object.entries(verbs).forEach(([name, verb]) => {
    if (typeof http[verb] !== "function") {
      throw new Error(
        `@hungvt/redux-kit: createBaseApi("${endpoint}") ${name} uses "${verb}", which the http client does not have`,
      );
    }
  });

  // A body verb sends `data`, or `params` when there is none (e.g. list as a POST search).
  // `config` is the per-request axios config, e.g. { silent: true }
  const send = (name, url, { params, data } = {}, config) => {
    const verb = verbs[name];
    if (BODYLESS.includes(verb)) {
      if (params === undefined) return config ? http[verb](url, config) : http[verb](url);
      return http[verb](url, { ...config, params });
    }
    return config ? http[verb](url, data ?? params, config) : http[verb](url, data ?? params);
  };

  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  return {
    list: (params, config) => send("list", path, { params }, config),
    store: (formData, config) => send("store", path, { data: formData }, config),
    detail: (id = null, params = {}, config) =>
      send("detail", `${path}${id ? `/${id}` : ""}`, { params }, config),
    update: (id, formData, config) =>
      send("update", `${path}/${id}`, { data: formData }, config),
    destroy: (id, config) => send("destroy", `${path}/${id}`, {}, config),
    ...customMethods,
  };
};

export default createBaseApi;
