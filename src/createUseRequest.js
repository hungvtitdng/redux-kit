import { useDispatch } from "react-redux"
import { bindActionCreators } from "redux"
import { useInjectReducer, useInjectSaga } from "./injectors.js"

const BASE_ACTION_NAMES = ["getList", "create", "getDetail", "update", "delete"]

/**
 * Base Request Hook Factory
 * Returns a hook that lazily injects the module's reducer + saga and exposes
 * one request method per action.
 *
 * @param {string} name - module name (also the injection key and state key)
 * @param {Object} store - a createBaseStore() result
 * @param {Object} [customMethods] - extra methods; called with (...args, actions, dispatch)
 * @returns {Function} hook
 *
 * @example
 * const useTransactionRequest = createUseRequest("transaction", transactionStore)
 * // -> getListTransactionRequest, getDetailTransactionRequest, createTransactionRequest,
 * //    updateTransactionRequest, deleteTransactionRequest, setDataTransactionRequest,
 * //    plus one method per operation (exportTransactionRequest, ...)
 */
export const createUseRequest = (name, store, customMethods = {}) => {
  const nameCapitalized = name.charAt(0).toUpperCase() + name.slice(1)

  return function useModuleRequest() {
    useInjectReducer({ key: name, reducer: store.reducer })
    useInjectSaga({ key: name, saga: store.saga })

    const dispatch = useDispatch()
    const actions = bindActionCreators(store.actions, dispatch)

    const baseMethods = {
      [`setData${nameCapitalized}Request`]: (params) => actions.setDataAction(params),
      [`getList${nameCapitalized}Request`]: (params) => actions.getListAction({ params }),
      [`getDetail${nameCapitalized}Request`]: (id, params) => actions.getDetailAction({ id, params }),
      [`create${nameCapitalized}Request`]: (data) => actions.createAction({ formData: data }),
      [`update${nameCapitalized}Request`]: (id, data) => actions.updateAction({ id, formData: data }),
      [`delete${nameCapitalized}Request`]: (id) => actions.deleteAction({ id }),
    }

    // One method per non-base action: exportTransactionRequest, getSummaryStorageHistoryRequest, ...
    const customActionMethods = {}
    ;(store.allActions || []).forEach(({ name: actionName }) => {
      if (BASE_ACTION_NAMES.includes(actionName)) return

      customActionMethods[`${actionName}${nameCapitalized}Request`] = (payload) => {
        const actionCreator = actions[`${actionName}Action`]

        if (typeof payload === "object" && payload !== null && !payload.type) {
          const hasExplicitPayloadShape = ["id", "params", "formData", "data"]
            .some((payloadKey) => payloadKey in payload)
          // Shorthand: request({ search: ... }) is treated as params
          actionCreator(hasExplicitPayloadShape ? payload : { params: payload })
        } else {
          actionCreator({ params: payload })
        }
      }
    })

    const boundCustomMethods = {}
    Object.entries(customMethods).forEach(([methodName, method]) => {
      boundCustomMethods[methodName] = typeof method === "function"
        ? (...args) => method(...args, actions, dispatch)
        : method
    })

    // customMethods win, so a base method can be overridden
    return { ...baseMethods, ...customActionMethods, ...boundCustomMethods }
  }
}

export default createUseRequest
