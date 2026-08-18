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
  silentNotFoundPaths = [],
  silentNotFoundSubPaths = [],
  messages = {},
} = {}) => {
  const text = {
    forbidden: "403 Forbidden",
    notFound: "404 Not Found",
    serverError: "500 Internal Server Error",
    timeout: "Request timeout!",
    ...messages,
  };

  return (error) => {
    const statusCode = error?.response?.status;
    const payload = error?.response?.data;
    const url = error?.response?.config?.url || "";

    switch (statusCode) {
      case 401:
        onUnauthorized(error);
        break;

      case 403:
        notifyError(text.forbidden);
        break;

      case 404:
        if (
          !silentNotFoundPaths.includes(url) &&
          !startsWithAny(url, silentNotFoundSubPaths)
        ) {
          notifyError(text.notFound);
        }
        break;

      case 422:
        if (!payload) {
          notifyError(text.timeout);
        } else {
          notifyValidationErrors(
            payload.errors || payload.message,
            notifyError,
          );
        }
        break;

      case 500:
        notifyError(text.serverError);
        break;

      default:
        if (statusCode) {
          notifyError(`${statusCode} ${payload?.message ?? ""}`.trim());
        } else {
          notifyError(error?.message || text.timeout);
        }
        break;
    }

    return Promise.reject(payload);
  };
};

export default createErrorHandler;
