import * as assert from 'assert';
import * as zod from '../src/index';

type ArgumentsType<T extends (...args: any[]) => any> = T extends (...args: (infer K)[]) => any ? K : any;

const catchError = <T extends (...args: any[]) => any>(fn: T): ((...args: ArgumentsType<T>[]) => Error) => {
  return function(...args) {
    try {
      fn(...args);
      throw new Error('expected function to throw');
    } catch (err) {
      return err;
    }
  };
};

describe('Zod Parsing', () => {
  describe('String parsing', () => {
    const schema = zod.string();

    it('should return valid string', () => {
      const ret = schema.parse('hello world');
      assert.equal(ret, 'hello world');
    });

    it('should throw a ValidationError if not a string', () => {
      const err = catchError(schema.parse.bind(schema))(123);
      assert.equal(err instanceof zod.ValidationError, true);
      assert.equal(err.message, 'expected type to be string but got number');
    });
  });

  describe('boolean parsing', () => {
    const schema = zod.boolean();

    it('should return valid boolean', () => {
      const ret = schema.parse(false);
      assert.equal(ret, false);
    });

    it('should throw a ValidationError if not a boolean', () => {
      const err = catchError(schema.parse.bind(schema))({});
      assert.equal(err instanceof zod.ValidationError, true);
      assert.equal(err.message, 'expected type to be boolean but got object');
    });
  });

  describe('number parsing', () => {
    const schema = zod.number();

    it('should return valid number', () => {
      const ret = schema.parse(321);
      assert.equal(ret, 321);
    });

    it('should throw a ValidationError if not a number', () => {
      const err = catchError(schema.parse.bind(schema))(null);
      assert.equal(err instanceof zod.ValidationError, true);
      assert.equal(err.message, 'expected type to be number but got object');
    });
  });

  describe('undefined parsing', () => {
    const schema = zod.undefined();

    it('should return undefined', () => {
      const ret = schema.parse(undefined);
      assert.equal(ret, undefined);
    });

    it('should throw a ValidationError if not undefined', () => {
      const err = catchError(schema.parse.bind(schema))('hello');
      assert.equal(err instanceof zod.ValidationError, true);
      assert.equal(err.message, 'expected type to be undefined but got string');
    });
  });

  describe('null parsing', () => {
    const schema = zod.null();

    it('should return null', () => {
      const ret = schema.parse(null);
      assert.equal(ret, null);
    });

    it('should throw a ValidationError if not null', () => {
      const err = catchError(schema.parse.bind(schema))(123);
      assert.equal(err instanceof zod.ValidationError, true);
      assert.equal(err.message, 'expected type to be null but got number');
    });
  });

  describe('literal parsing', () => {
    const schema = zod.literal('123');

    it('should return the literal if match', () => {
      const ret = schema.parse('123');
      assert.equal(ret, '123');
    });

    it('should throw a ValidationError if not the same type', () => {
      const err = catchError(schema.parse.bind(schema))(123);
      assert.equal(err instanceof zod.ValidationError, true);
      assert.equal(err.message, `expected value to be literal "123" but got 123`);
    });

    it('should throw validation error if literal is not the same value', () => {
      const err = catchError(schema.parse.bind(schema))('321');
      assert.equal(err instanceof zod.ValidationError, true);
      assert.equal(err.message, `expected value to be literal "123" but got "321"`);
    });
  });
});
