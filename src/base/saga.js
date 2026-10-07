import { all, call, put, takeEvery } from "redux-saga/effects";

/**
 * Base Saga Factory
 * One takeEvery per generated action: read the payload config, call the API
 * method, dispatch success — or handleError.
 */
/**
 * Run an operation hook. Accepts a generator function (effects are yielded to
 * the saga), an async function (awaited) or a plain function (side effects
 * only) — `yield* plainFn()` would throw on the undefined return value.
 */
function* runHook(hook, ...args) {
  if (typeof hook !== "function") return;
  const result = hook(...args);
  if (result && typeof result[Symbol.iterator] === "function") {
    yield* result;
  } else if (result && typeof result.then === "function") {
    yield result;
  }
}

const isEnvelope = (body) =>
  body !== null && typeof body === "object" && !Array.isArray(body) && "data" in body;

const createBaseSaga = (
  constants,
  actions,
  api,
  allActions = [],
  operations = [],
  envelope = false,
) => {
  const sagas = [];

  const operationsByName = {};
  operations.forEach((operation) => {
    operationsByName[operation.name] = operation;
  });

  allActions.forEach((actionConfig) => {
    const actionName = actionConfig.name;
    const actionNameUpper = actionName.toUpperCase();
    const apiMethod = actionConfig.apiName || actionConfig.name;
    const operation = operationsByName[actionName];

    function* actionSaga(payload) {
      try {
        yield* runHook(operation?.saga?.before, payload, actions);

        const apiFunction = api[apiMethod];
        if (!apiFunction) {
          throw new Error(`API method "${apiMethod}" not found`);
        }

        // Per-request http config ({ silent: true }), passed as the API method's last argument
        const options = payload.options;

        let res;
        const payloadConfig = actionConfig.payload;
        if (
          payloadConfig !== undefined &&
          payloadConfig !== null &&
          payloadConfig !== ""
        ) {
          // Supports both "id, params" and ["id", "params"]
          const paramNames = Array.isArray(payloadConfig)
            ? payloadConfig
            : payloadConfig.split(",").map((name) => name.trim());

          const apiParams = [];
          paramNames.forEach((paramName) => {
            const value =
              paramName === "formData" || paramName === "data"
                ? payload.formData || payload.data
                : payload[paramName];

            // With options, keep empty slots so options lands after every param
            if (value !== undefined || options) apiParams.push(value);
          });
          if (options) apiParams.push(options);

          res =
            apiParams.length > 0
              ? yield call(apiFunction, ...apiParams)
              : yield call(apiFunction);
        } else {
          res = options ? yield call(apiFunction, options) : yield call(apiFunction);
        }

        // envelope: `{ data, message }` -> selector gets `data`, `message` goes to state.message
        const body = res ?? {};
        const unwrap = envelope && isEnvelope(body);
        const successData = unwrap ? body.data : body;
        const message = unwrap ? body.message : undefined;
        yield put(actions[`${actionName}SuccessAction`](successData, message));

        yield* runHook(operation?.saga?.after, successData, payload, actions);
      } catch (error) {
        yield* runHook(operation?.saga?.error, error, payload, actions);
        yield put(actions.handleErrorAction(error));
      }
    }

    sagas.push({
      constant: constants[`${actionNameUpper}_REQUEST`],
      saga: actionSaga,
    });
  });

  return function* rootSaga() {
    yield all(sagas.map(({ constant, saga }) => takeEvery(constant, saga)));
  };
};

export default createBaseSaga;
