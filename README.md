# @safer-bwd/mongoose-state-machine
[![Build Status](https://travis-ci.com/safer-bwd/mongoose-state-machine.svg?branch=master)](https://travis-ci.com/safer-bwd/mongoose-state-machine)

A Mongoose plugin that implement a *state machine* into a Mongoose model. 

The plugin is based on [javascript-state-machine](https://github.com/jakesgordon/javascript-state-machine).

## Install

```sh
npm install @safer-bwd/mongoose-state-machine --save
```

## Options

-   `stateMachine` **[Object](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object)** The state machine definition object ([javascript-state-machine](https://github.com/jakesgordon/javascript-state-machine))
-   `fieldName` **[String](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String)** The name of the model field that stores the current state (optional, default `status`)

## Usage

```javascript
import mongoose from 'mongoose';
import stateMachinePlugin from '@safer-bwd/mongoose-state-machine';

const matterSchema = new mongoose.Schema({ matterState: String });

const stateMachine = {
  init: 'solid',
  transitions: [
    { name: 'melt', from: 'solid', to: 'liquid' },
    { name: 'freeze', from: 'liquid', to: 'solid' },
    { name: 'vaporize', from: 'liquid', to: 'gas' },
    { name: 'condense', from: 'gas', to: 'liquid' }
  ],
  methods: {
    onMelt() { console.log('I melted') },
    onFreeze() { console.log('I froze') },
    onVaporize() { console.log('I vaporized') },
    onCondense() { console.log('I condensed') }
  }
};

matterSchema.plugin(stateMachinePlugin, { 
  fieldName: 'matterState',
  stateMachine 
});
  
const Matter = mongoose.model('Matter', schema);
```

