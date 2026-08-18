import { combineReducers } from "redux";

/**
 * Build the root reducer from the app's static reducers plus whatever module
 * reducers have been injected so far.
 *
 * Both registries live on the store object, so nothing is held in module scope.
 */
export const buildRootReducer = (
  staticReducers = {},
  injectedReducers = {},
) => {
  const reducers = { ...staticReducers, ...injectedReducers };

  // combineReducers throws on an empty object; keep the store usable before the
  // first module is injected.
  if (Object.keys(reducers).length === 0) {
    return (state = {}) => state;
  }

  return combineReducers(reducers);
};

export default buildRootReducer;
