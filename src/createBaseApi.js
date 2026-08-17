/**
 * Base API Factory (port of src/api/base.jsx)
 * Create CRUD API functions for an endpoint, plus any custom methods.
 *
 * @param {Object} http - HTTP client (see createHttpClient)
 * @param {string} endpoint - e.g. "/categories" or "categories"
 * @param {Object} [customMethods] - extra/overriding methods
 * @returns {Object} api object
 */
export const createBaseApi = (http, endpoint = null, customMethods = {}) => {
  if (!endpoint) return customMethods

  if (!http) {
    throw new Error(`redux-kit: createBaseApi("${endpoint}") needs an http client`)
  }

  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`

  return {
    list: (params) => http.get(path, { params }),
    store: (formData) => http.post(path, formData),
    detail: (id = null, params = {}) => http.get(`${path}${id ? `/${id}` : ""}`, { params }),
    update: (id, formData) => http.patch(`${path}/${id}`, formData),
    destroy: (id) => http.delete(`${path}/${id}`),
    ...customMethods,
  }
}

export default createBaseApi
