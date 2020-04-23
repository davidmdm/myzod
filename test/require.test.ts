import * as assert from 'assert';

import myzod from '../src';

const expectedExports = [
  'Type',
  'ValidationError',
  'array',
  'bigint',
  'boolean',
  'date',
  'default',
  'dictionary',
  'enum',
  'intersection',
  'keySignature',
  'lazy',
  'literal',
  'literals',
  'null',
  'number',
  'object',
  'omit',
  'partial',
  'pick',
  'record',
  'string',
  'tuple',
  'undefined',
  'union',
  'unknown',
];

const idxOfDefault = expectedExports.findIndex(x => x === 'default');
const expectedExportsWithoutDefault = [
  ...expectedExports.slice(0, idxOfDefault),
  ...expectedExports.slice(idxOfDefault + 1),
];

describe('Test functioning exports', () => {
  it('default exports', () => {
    assert.deepEqual(Object.keys(myzod).sort(), expectedExportsWithoutDefault);

    // make sure typescript compiles with myzod.func
    const schema = myzod.string();
    schema;
  });

  it('commonjs', () => {
    const z = require('../src/index');
    assert.deepEqual(Object.keys(z).sort(), expectedExports);
  });
});
