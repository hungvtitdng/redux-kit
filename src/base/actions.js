/**
 * Base Actions Factory
 * Create action creators for a module from its actions config.
 */
const createBaseActions = (constants, allActions = []) => {
  const actions = {
    handleErrorAction(error) {
      return { type: constants.HANDLE_ERROR, error };
    },
    setDataAction(params) {
      return { type: constants.SET_DATA, params };
    },
  };

  allActions.forEach((actionConfig) => {
    const actionName = actionConfig.name;
    const actionNameUpper = actionName.toUpperCase();

    // name: "getList" -> getListAction, name: "export" -> exportAction
    actions[`${actionName}Action`] = (payload = {}) => {
      let id;
      let params;
      let formData;

      if (typeof payload === "object" && payload !== null && !payload.type) {
        // Payload is an object { id, params, formData }
        id = payload.id;
        params = payload.params;
        formData = payload.formData || payload.data;
      } else {
        // Backward compatible: a bare value is treated as params/data
        params = payload;
        formData = payload;
      }

      return {
        type: constants[`${actionNameUpper}_REQUEST`],
        id,
        params,
        formData,
        data: formData, // alias for backward compatibility
      };
    };

    actions[`${actionName}SuccessAction`] = (data) => ({
      type: constants[`${actionNameUpper}_SUCCESS`],
      data,
    });
  });

  return actions;
};

export default createBaseActions;
