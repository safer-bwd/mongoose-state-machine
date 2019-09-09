import StateMachine from 'javascript-state-machine';
import wrap from 'lodash.wrap';
import get from 'lodash.get';
import set from 'lodash.set';

export default (schema, options = {}) => {
  const { stateMachine, fieldName = 'status' } = options;

  if (fieldName === 'state') {
    throw new Error('Invalid field name: `state` is a reserved property.');
  }

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
