import { createStore, applyMiddleware, compose } from "redux"
import createSagaMiddleware from "redux-saga"
import { buildRootReducer } from "./rootReducer.js"

/**
 * Create the redux store with saga middleware and the injection registries.
 *
 * Persistence, router sync and the rest stay in the app: pass their reducers
 * via `staticReducers` and their middleware via `middleware`.
 *
 * @param {Object} options
 * @param {Object} [options.initialState]
 * @param {Object} [options.staticReducers] - always-present reducers owned by the app, e.g. { router, session }
 * @param {Array}  [options.middleware] - extra middleware appended after sagaMiddleware
 * @param {Array}  [options.enhancers] - extra store enhancers
 * @param {boolean} [options.devTools] - hook up Redux DevTools (default: non-production)
 * @returns {Object} store, with runSaga / staticReducers / injectedReducers / injectedSagas attached
 */
export const configureStore = ({
  initialState = {},
  staticReducers = {},
  middleware = [],
  enhancers = [],
  devTools = process.env.NODE_ENV !== "production",
} = {}) => {
  const sagaMiddleware = createSagaMiddleware()

  const composeEnhancers = devTools
    && typeof window === "object"
    && window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
    ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({})
    : compose

  const store = createStore(
    buildRootReducer(staticReducers),
    initialState,
    composeEnhancers(applyMiddleware(sagaMiddleware, ...middleware), ...enhancers),
  )

  store.runSaga = sagaMiddleware.run
  store.staticReducers = staticReducers
  store.injectedReducers = {}
  store.injectedSagas = {}

  return store
}

export default configureStore
