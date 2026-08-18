import axios from "axios";
import { createErrorHandler, startsWithAny } from "./errorHandler.js";

/**
 * HTTP client factory (port of src/services/httpRequest.jsx).
 *
 * Responses are unwrapped to `response.data`; errors are notified and rejected
 * with the server payload. Auth, i18n and notifications are injected — the
 * package knows none of them.
 *
 * @param {Object} options
 * @param {string} options.baseURL
 * @param {Object} [options.headers] - default headers
 * @param {Function} [options.getToken] - () => string|null, sets Authorization
 * @param {Function} [options.getLocale] - () => string|null, sets the Localization header
 * @param {Function} [options.notifySuccess] - (message) => void, called on `data.message`
 * @param {Function} [options.notifyError] - (message) => void
 * @param {Function} [options.onUnauthorized] - (error) => void, 401 (e.g. logout)
 * @param {string[]} [options.silentSuccessPaths] - exact urls that never notify success
 * @param {string[]} [options.silentSuccessSubPaths] - url prefixes that never notify success
 * @param {string[]} [options.silentNotFoundPaths] - exact urls that never notify 404
 * @param {string[]} [options.silentNotFoundSubPaths] - url prefixes that never notify 404
 * @param {Object} [options.messages] - override the built-in error texts
 * @returns {Object} axios instance
 */
export const createHttpClient = ({
  baseURL,
  headers = {},
  getToken = () => null,
  getLocale = () => null,
  notifySuccess = () => {},
  notifyError = () => {},
  onUnauthorized = () => {},
  silentSuccessPaths = [],
  silentSuccessSubPaths = [],
  silentNotFoundPaths = [],
  silentNotFoundSubPaths = [],
  messages,
  ...axiosOptions
} = {}) => {
  const client = axios.create({ baseURL, headers, ...axiosOptions });

  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      const locale = getLocale();
      if (locale) config.headers.Localization = locale;
    }

    return config;
  });

  client.interceptors.response.use((response) => {
    const url = response.config?.url || "";
    const silent =
      silentSuccessPaths.includes(url) ||
      startsWithAny(url, silentSuccessSubPaths);

    if (!silent && response.data?.message) {
      notifySuccess(response.data.message);
    }

    return response.data;
  }, createErrorHandler({ notifyError, onUnauthorized, silentNotFoundPaths, silentNotFoundSubPaths, messages }));

  return client;
};

export default createHttpClient;
