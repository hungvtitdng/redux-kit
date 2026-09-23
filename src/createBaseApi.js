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

  // A body verb sends `data`, or `params` when there is none (e.g. list as a POST search)
  const send = (name, url, { params, data } = {}) => {
    const verb = verbs[name];
    if (BODYLESS.includes(verb)) {
      return params === undefined ? http[verb](url) : http[verb](url, { params });
    }
    return http[verb](url, data ?? params);
  };

  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  return {
    list: (params) => send("list", path, { params }),
    store: (formData) => send("store", path, { data: formData }),
    detail: (id = null, params = {}) =>
      send("detail", `${path}${id ? `/${id}` : ""}`, { params }),
    update: (id, formData) => send("update", `${path}/${id}`, { data: formData }),
    destroy: (id) => send("destroy", `${path}/${id}`),
    ...customMethods,
  };
};

export default createBaseApi;
