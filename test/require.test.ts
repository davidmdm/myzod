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
  'required',
  'string',
  'tuple',
  'undefined',
  'union',
  'unknown',
].sort();

const idxOfDefault = expectedExports.findIndex(x => x === 'default');
const expectedExportsWithoutDefault = [
  ...expectedExports.slice(0, idxOfDefault),
  ...expectedExports.slice(idxOfDefault + 1),
];

describe('Test functioning exports', () => {
  it('default exports', () => {
    assert.deepStrictEqual(Object.keys(myzod).sort(), expectedExportsWithoutDefault);

    // make sure typescript compiles with myzod.func
    const schema = myzod.string();
    schema;
  });

  it('commonjs', () => {
    const z = require('../src/index');
    assert.deepStrictEqual(Object.keys(z).sort(), expectedExports);
  });
});
