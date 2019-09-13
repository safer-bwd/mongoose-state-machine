import mongoose from 'mongoose';
import stateMachinePlugin from '../src';

let Matter;

const noop = () => {};

const stateMachine = {
  init: 'solid',
  transitions: [
    { name: 'melt', from: 'solid', to: 'liquid' },
    { name: 'freeze', from: 'liquid', to: 'solid' },
    { name: 'vaporize', from: 'liquid', to: 'gas' },
    { name: 'condense', from: 'gas', to: 'liquid' }
  ],
  methods: {
    onEnterState: noop
  }
};

beforeAll(async () => {
  await mongoose.connect(process.env.DB_MONGO_URI, {
    auth: (process.env.DB_MONGO_USER) ? {
      user: process.env.DB_MONGO_USER,
      password: process.env.DB_MONGO_PASSWORD
    } : null,
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false
  });
  const schema = new mongoose.Schema({ matterState: String });
  schema.plugin(stateMachinePlugin, { fieldName: 'matterState', stateMachine });
  Matter = mongoose.model('Matter', schema);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

afterEach(async () => {
  await Matter.deleteMany();
});

it('should work after instantiated', async () => {
  const matter = new Matter();

  expect(matter.matterState).toBe('solid');
  expect(matter.toObject()).toHaveProperty('matterState', 'solid');
  expect(matter.is('solid')).toBeTruthy();
  expect(matter.can('melt')).toBeTruthy();
  expect(matter.cannot('freeze')).toBeTruthy();

  matter.melt();
  expect(matter.matterState).toBe('liquid');
  expect(matter.toObject()).toHaveProperty('matterState', 'liquid');

  matter.matterState = 'gas'; // no effect
  expect(matter.matterState).toBe('liquid');

  expect(() => matter.condense()).toThrow();
});

it('should work after retrieving from a database', async () => {
  const matter = new Matter();
  await matter.save();
  matter.melt();
  await matter.save();

  // findOne
  const found1 = await Matter.findOne();
  expect(found1.matterState).toBe('liquid');
  expect(found1.toObject()).toHaveProperty('matterState', 'liquid');
  found1.vaporize();
  expect(found1.matterState).toBe('gas');
  expect(found1.toObject()).toHaveProperty('matterState', 'gas');

  // find
  const coll = await Matter.find();
  const found2 = coll[0];
  expect(found2.matterState).toBe('liquid');
  expect(found2.toObject()).toHaveProperty('matterState', 'liquid');
  found2.vaporize();
  expect(found2.matterState).toBe('gas');
  expect(found2.toObject()).toHaveProperty('matterState', 'gas');
});

it('should throw error if invalid schema paths', async () => {
  const schema = new mongoose.Schema({ state: String });
  const addPlugin = () => schema.plugin(stateMachinePlugin, {
    fieldName: 'state',
    stateMachine
  });
  expect(() => addPlugin()).toThrow('Invalid schema path: \'state\' is reserved');

  const schema1 = new mongoose.Schema({
    status: String,
    melt: Number
  });
  const addPlugin1 = () => schema1.plugin(stateMachinePlugin, { stateMachine });
  expect(() => addPlugin1()).toThrow('Invalid schema path: \'melt\' is a transition name');

  const schema2 = new mongoose.Schema({});
  const addPlugin2 = () => schema2.plugin(stateMachinePlugin, {
    fieldName: 'status',
    stateMachine
  });
  expect(() => addPlugin2()).toThrow('Failed to find schema path \'status\'');
});
