import * as assert from 'assert';

describe('Test functioning exports', () => {
  it('commonjs', () => {
    const mz = require('../src/index');
    const namedExports = { ...mz };
    delete namedExports.default;

    const defaultExports = mz.default;

    assert.deepStrictEqual(Object.keys(namedExports).sort(), Object.keys(defaultExports).sort());
  });
});
