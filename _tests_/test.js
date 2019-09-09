const mongoose = require('mongoose');
const mongooseStateMachine = require('../src');

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
  schema.plugin(mongooseStateMachine, { fieldName: 'matterState', stateMachine });
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

  expect(() => matter.condense()).toThrow();
});

it('should work after find one', async () => {
  const matter = new Matter();
  matter.melt();
  await matter.save();

  const foundMatter = await Matter.findOne();
  expect(foundMatter.matterState).toBe('liquid');
  expect(matter.toObject()).toHaveProperty('matterState', 'liquid');

  foundMatter.vaporize();
  expect(foundMatter.matterState).toBe('gas');
  expect(matter.toObject()).toHaveProperty('matterState', 'liquid');
});

it('should work after find', async () => {
  const matter = new Matter();
  matter.melt();
  matter.vaporize();
  await matter.save();

  const coll = await Matter.find();
  expect(coll[0].matterState).toBe('gas');
  expect(coll[0].toObject()).toHaveProperty('matterState', 'gas');
});

it('should throw an error if `fieldName` is reserved', async () => {
  const schema = new mongoose.Schema({ state: String });
  const addPlugin = () => schema.plugin(mongooseStateMachine, {
    fieldName: 'state',
    stateMachine
  });
  expect(() => addPlugin()).toThrow();
});
