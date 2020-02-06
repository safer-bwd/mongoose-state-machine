export default class extends Error {
  constructor(fn) {
    super(fn);
    this.name = 'MongooseStateMachineError';
  }
}
