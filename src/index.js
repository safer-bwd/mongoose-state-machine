import StateMachine from 'javascript-state-machine';
import wrap from 'lodash.wrap';
import get from 'lodash.get';
import set from 'lodash.set';

class PluginError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MongooseStateMachineError';
  }
}

const reservedPaths = new Set([
  'state',
  'is',
  'cannot',
  'transitions',
  'allTransitions',
  'allStates'
]);

export default (schema, options = {}) => {
  const { stateMachine, fieldName = 'status' } = options;
  if (!schema.path(fieldName)) {
    throw new PluginError(`Failed to find schema path '${fieldName}'`);
  }

  const transitionNames = new Set(stateMachine.transitions.map(t => t.name));
  schema.eachPath((path) => {
    if (reservedPaths.has(path)) {
      throw new PluginError(`Invalid schema path: '${path}' is reserved`);
    }
    if (transitionNames.has(path)) {
      throw new PluginError(`Invalid schema path: '${path}' is a transition name`);
    }
  });

  const onEnterState = get(stateMachine, 'methods.onEnterState');
  const wrappedOnEnterState = wrap(onEnterState, (fn, lifecycle, ...args) => {
    const doc = lifecycle.fsm;
    if (doc[fieldName] !== lifecycle.to) {
      doc[fieldName] = lifecycle.to;
    }
    if (fn) {
      fn.bind(doc)(lifecycle, ...args);
    }
  });
  set(stateMachine, 'methods.onEnterState', wrappedOnEnterState);

  function onInstantiated() {
    const doc = this;
    if (!doc.isNew) {
      return;
    }
    StateMachine.apply(doc, stateMachine);
  }

  // eslint-disable-next-line no-param-reassign
  schema.methods.$onInstantiated = onInstantiated;
  schema.queue('$onInstantiated', []);

  function onInit() {
    const doc = this;
    const init = doc[fieldName] ? doc[fieldName] : undefined;
    StateMachine.apply(doc, { ...stateMachine, init });
  }

  schema.post('init', onInit);
};
