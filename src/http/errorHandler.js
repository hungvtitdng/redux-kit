/**
 * Response error handling: notify, then reject with the server payload.
 * Everything app-specific (how to notify, what to do on 401) is injected.
 */

export const startsWithAny = (url = "", prefixes = []) =>
  prefixes.some((prefix) => url.indexOf(prefix) === 0);

const notifyValidationErrors = (errors, notifyError) => {
  if (typeof errors === "string") {
    notifyError(errors);
    return;
  }

  Object.values(errors || {}).forEach((messages) => {
    if (Array.isArray(messages)) {
      messages.forEach((message) => notifyError(message));
    } else if (messages) {
      notifyError(String(messages));
    }
  });
};

export const createErrorHandler = ({
  notifyError = () => {},
  onUnauthorized = () => {},
  notifyFieldErrors = true,
  silentNotFoundPaths = [],
  silentNotFoundSubPaths = [],
  messages = {},
} = {}) => {
  const text = {
    forbidden: "403 Forbidden",
    notFound: "404 Not Found",
    serverError: "500 Internal Server Error",
    timeout: "Request timeout!",
    network: null, // null: fall back to the axios message ("Network Error")
    ...messages,
  };
  // A message may be a function so it follows a runtime language switch
  const t = (key) => (typeof text[key] === "function" ? text[key]() : text[key]);

  return (error) => {
    const statusCode = error?.response?.status;
    const payload = error?.response?.data;
    const url = error?.response?.config?.url || "";

    switch (statusCode) {
      case 401:
        onUnauthorized(error);
        break;

      case 403:
        notifyError(payload?.message || t("forbidden"));
        break;

      case 404:
        if (
          !silentNotFoundPaths.includes(url) &&
          !startsWithAny(url, silentNotFoundSubPaths)
        ) {
          notifyError(t("notFound"));
        }
        break;

      case 422:
        if (!payload) {
          notifyError(t("timeout"));
        } else if (!notifyFieldErrors) {
          // Field errors are rendered inline by the form; toast only a general message
          const hasFieldErrors = Object.keys(payload.errors || {}).length > 0;
          if (!hasFieldErrors && payload.message) notifyError(payload.message);
        } else {
          notifyValidationErrors(
            payload.errors || payload.message,
            notifyError,
          );
        }
        break;

      case 500:
        notifyError(t("serverError"));
        break;

      default:
        if (statusCode) {
          notifyError(`${statusCode} ${payload?.message ?? ""}`.trim());
        } else {
          notifyError(t("network") || error?.message || t("timeout"));
        }
        break;
    }

    // No response (network error, timeout): reject the axios error so callers still see a failure
    return Promise.reject(payload ?? error);
  };
};

export default createErrorHandler;
