import createBaseApi from "../createBaseApi.js";
import createBaseConstants from "./constants.js";
import createBaseActions from "./actions.js";
import createBaseReducer, { createInitialState } from "./reducer.js";
import createBaseSaga from "./saga.js";
import { createUseSelector } from "./useSelector.js";

/**
 * Base Store Factory
 *
 * @param {Object} config
 * @param {string} config.name - module name, also the state key (e.g. "transaction")
 * @param {Object} [config.http] - HTTP client, required when `endpoint` is used without `api`
 * @param {string} [config.endpoint] - API path, e.g. "warehouse-transactions"
 * @param {Object} [config.api] - ready-made API object; wins over `endpoint`
 * @param {Object} [config.customApiMethods] - extra methods merged into the API
 * @param {Array}  [config.baseActions] - override the default CRUD action list ([] to disable)
 * @param {Array}  [config.operations] - non-CRUD actions:
 *   { name, apiName, payload, selector, loadingType, successSelector, saga: { before, after, error }, reducer }
 * @param {Object} [config.overrides] - { actions, reducer, saga, initialState }
 *
 * @returns {Object} { constants, actions, reducer, saga, initialState, name, allActions, operations, useSelector }
 *
 * @example
 * const transactionStore = createBaseStore({
 *   name: "transaction",
 *   endpoint: "warehouse-transactions",
 *   operations: [
 *     { name: "export", apiName: "export", payload: ["params"], loadingType: "exporting" },
 *   ],
 * })
 */

// Default CRUD actions
const BASE_ACTIONS_CONFIG = [
  {
    name: "getList",
    apiName: "list",
    payload: ["params"],
    selector: "list",
    loadingType: "loading",
    successSelector: "getListSuccess",
  },
  {
    name: "create",
    apiName: "store",
    payload: ["formData"],
    selector: null,
    loadingType: "submitting",
    successSelector: "createSuccess",
  },
  {
    name: "getDetail",
    apiName: "detail",
    payload: ["id", "params"],
    selector: "detail",
    loadingType: "loading",
    successSelector: "getDetailSuccess",
  },
  {
    name: "update",
    apiName: "update",
    payload: ["id", "formData"],
    selector: "detail",
    loadingType: "submitting",
    successSelector: "updateSuccess",
  },
  {
    name: "delete",
    apiName: "destroy",
    payload: ["id"],
    selector: null,
    loadingType: "loading",
    successSelector: "deleteSuccess",
  },
];

export const createBaseStore = (config) => {
  const {
    name,
    http,
    endpoint,
    api: providedApi,
    customApiMethods = {},
    baseActions: providedBaseActions,
    operations = [],
    overrides = {},
  } = config;

  if (!name) {
    throw new Error("createBaseStore requires 'name' parameter");
  }

  // Resolve the API: an explicit object wins, otherwise build CRUD over the endpoint
  let api;
  if (providedApi) {
    api = providedApi;
  } else if (endpoint) {
    api = createBaseApi(http, endpoint, customApiMethods);
  } else {
    // No API and no endpoint: operations must bring their own methods
    api = {};
  }

  // Without an endpoint or an API object there is nothing for CRUD actions to call
  const baseActions =
    providedBaseActions !== undefined
      ? providedBaseActions
      : endpoint || providedApi
        ? BASE_ACTIONS_CONFIG
        : [];

  if (Object.keys(customApiMethods).length > 0) {
    api = { ...api, ...customApiMethods };
  }

  // Operations -> action configs
  const operationActions = operations.map((operation) => {
    // selector: null means "no selector", undefined means "use the operation name"
    const selectorName =
      operation.selector !== undefined ? operation.selector : operation.name;
    const successSelector =
      operation.successSelector || `${selectorName || operation.name}Success`;

    return {
      name: operation.name,
      apiName: operation.apiName || operation.name,
      payload: operation.payload !== undefined ? operation.payload : null,
      selector: selectorName,
      loadingType: operation.loadingType || "loading",
      successSelector,
      saga: operation.saga,
      reducer: operation.reducer,
    };
  });

  const allActions = [...baseActions, ...operationActions];

  allActions.forEach((actionConfig) => {
    if (!actionConfig.name) {
      throw new Error('Action requires "name" property');
    }
  });

  // 1. Constants
  const constants = createBaseConstants(name, allActions);

  // 2. Actions
  const actions = {
    ...createBaseActions(constants, allActions),
    ...(overrides.actions || {}),
  };

  // 3. Initial state
  const operationInitialState = {};
  operationActions.forEach(({ selector, successSelector }) => {
    if (selector) operationInitialState[selector] = null;
    operationInitialState[successSelector] = null;
  });
  const initialState = {
    ...createInitialState(),
    ...operationInitialState,
    ...(overrides.initialState || {}),
  };

  // 4. Reducer — a custom reducer runs first and may fall through to the base one
  const baseReducer = createBaseReducer(
    constants,
    overrides.initialState,
    allActions,
    operations,
  );
  const reducer = overrides.reducer
    ? (state, action) => {
        const customResult = overrides.reducer(state, action);
        return customResult !== undefined
          ? customResult
          : baseReducer(state, action);
      }
    : baseReducer;

  // 5. Saga
  const baseSaga = createBaseSaga(
    constants,
    actions,
    api,
    allActions,
    operations,
  );
  const saga =
    typeof overrides.saga === "function" && overrides.saga.length > 0
      ? overrides.saga(constants, actions, api)
      : overrides.saga || baseSaga;

  // 6. useSelector hook
  const useSelector = createUseSelector(name, initialState);

  return {
    constants,
    actions,
    reducer,
    saga,
    initialState,
    name,
    api,
    allActions,
    operations,
    useSelector,
  };
};

export default createBaseStore;
