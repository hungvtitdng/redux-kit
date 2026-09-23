// Named import: the default export of immer's CJS build does not interop under
// plain Node ESM (only under a bundler), and this file must run in both.
import { produce } from "immer";

/**
 * Base Reducer Factory
 * One switch for every generated action: REQUEST flips the loading flag,
 * SUCCESS writes the payload into its selector and raises the success flag.
 */

export const createInitialState = () => ({
  loading: false,
  submitting: false,
  error: null,
  list: null,
  detail: null,
  getListSuccess: null,
  getDetailSuccess: null,
  createSuccess: null,
  updateSuccess: null,
  deleteSuccess: null,
  actionSuccess: null,
});

const ACTION_STATE_NAMES = ["create", "update", "delete"];

// `selector: null` means "keep no response in state"; only `undefined` falls
// back to the action name.
const selectorOf = ({ selector, name }) =>
  selector === undefined ? name : selector;

const createBaseReducer = (
  constants,
  initialStateOverride = {},
  allActions = [],
  operations = [],
  envelope = false,
) => {
  const initialState = {
    ...createInitialState(),
    ...(envelope ? { message: null } : {}),
    ...initialStateOverride,
  };

  allActions.forEach((actionConfig) => {
    const selectorName = selectorOf(actionConfig);
    const successSelector =
      actionConfig.successSelector ||
      `${selectorName || actionConfig.name}Success`;

    if (selectorName) initialState[selectorName] = null;
    initialState[successSelector] = null;
  });

  const operationsByName = {};
  operations.forEach((operation) => {
    operationsByName[operation.name] = operation;
  });

  return (state, action) =>
    produce(state || initialState, (draft) => {
      switch (action.type) {
        case constants.SET_DATA:
          Object.entries(action.params || {}).forEach(([key, value]) => {
            draft[key] = value;
          });
          break;

        case constants.HANDLE_ERROR:
          draft.error = action.error;
          draft.loading = false;
          draft.submitting = false;
          // Reset every success flag and every custom loading flag ("exporting",
          // "detailLoading", ...) — otherwise a failed operation leaves its spinner on.
          allActions.forEach((actionConfig) => {
            const successSelector =
              actionConfig.successSelector ||
              `${selectorOf(actionConfig) || actionConfig.name}Success`;
            draft[successSelector] = false;
            if (actionConfig.loadingType)
              draft[actionConfig.loadingType] = false;
          });
          draft.actionSuccess = false;
          break;

        default: {
          const actionConfig = allActions.find((config) => {
            const actionNameUpper = config.name.toUpperCase();
            return (
              action.type === constants[`${actionNameUpper}_REQUEST`] ||
              action.type === constants[`${actionNameUpper}_SUCCESS`]
            );
          });

          if (!actionConfig) return state;

          const actionNameUpper = actionConfig.name.toUpperCase();
          const selectorName = selectorOf(actionConfig);
          const successSelector =
            actionConfig.successSelector ||
            `${selectorName || actionConfig.name}Success`;
          const loadingType = actionConfig.loadingType || "loading";

          if (action.type === constants[`${actionNameUpper}_REQUEST`]) {
            draft[loadingType] = true;
            draft.error = false;
            if (envelope) draft.message = null;
            // Only reset actionSuccess for create/update/delete requests
            if (ACTION_STATE_NAMES.includes(actionConfig.name)) {
              draft.actionSuccess = null;
            }
            if (selectorName) draft[selectorName] = null;
            draft[successSelector] = null;
          }

          if (action.type === constants[`${actionNameUpper}_SUCCESS`]) {
            draft[loadingType] = false;
            draft[successSelector] = true;
            if (envelope) draft.message = action.message ?? null;

            if (ACTION_STATE_NAMES.includes(actionConfig.name)) {
              draft.actionSuccess = true;
            }

            if (selectorName) draft[selectorName] = action.data;

            // Operation-level reducer runs after success only
            const operation = operationsByName[actionConfig.name];
            if (typeof operation?.reducer === "function") {
              operation.reducer(draft, action);
            }
          }
          break;
        }
      }
    });
};

export default createBaseReducer;
