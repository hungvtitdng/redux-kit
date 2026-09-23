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
 * @param {Function} [options.getLocale] - () => string|null, sets the locale header
 * @param {string} [options.localeHeader] - name of that header (default "Accept-Language")
 * @param {Function} [options.notifySuccess] - (message) => void
 * @param {Function} [options.getSuccessMessage] - (response) => string|null, what to toast on success;
 *   null/empty means no toast. Default: the server's `data.message`, for every method
 * @param {Function} [options.notifyError] - (message) => void
 * @param {Function} [options.onUnauthorized] - (error) => void, 401 (e.g. logout)
 * @param {boolean} [options.notifyFieldErrors] - 422: toast each field error (default true);
 *   false toasts only `message`, and only when there are no field errors
 * @param {string[]} [options.silentSuccessPaths] - exact urls that never notify success
 * @param {string[]} [options.silentSuccessSubPaths] - url prefixes that never notify success
 * @param {string[]} [options.silentNotFoundPaths] - exact urls that never notify 404
 * @param {string[]} [options.silentNotFoundSubPaths] - url prefixes that never notify 404
 * @param {Object} [options.messages] - override the built-in error texts, string or () => string
 * @returns {Object} axios instance
 */
export const createHttpClient = ({
  baseURL,
  headers = {},
  getToken = () => null,
  getLocale = () => null,
  localeHeader = "Accept-Language",
  notifySuccess = () => {},
  getSuccessMessage = (response) => response.data?.message,
  notifyError = () => {},
  onUnauthorized = () => {},
  notifyFieldErrors = true,
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
    if (token) config.headers.Authorization = `Bearer ${token}`;

    // Guests need a language too (login / register error messages)
    const locale = getLocale();
    if (locale) config.headers[localeHeader] = locale;

    return config;
  });

  client.interceptors.response.use((response) => {
    const url = response.config?.url || "";
    const silent =
      silentSuccessPaths.includes(url) ||
      startsWithAny(url, silentSuccessSubPaths);

    const message = silent ? null : getSuccessMessage(response);
    if (message) notifySuccess(message);

    return response.data;
  }, createErrorHandler({ notifyError, onUnauthorized, notifyFieldErrors, silentNotFoundPaths, silentNotFoundSubPaths, messages }));

  return client;
};

export default createHttpClient;
