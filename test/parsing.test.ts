import * as assert from 'assert';
import * as z from '../src/index';

type ArgumentsType<T extends (...args: any[]) => any> = T extends (...args: (infer K)[]) => any ? K : any;

const catchError = <T extends (...args: any[]) => any>(fn: T): ((...args: ArgumentsType<T>[]) => Error) => {
  return function (...args) {
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
    const schema = z.string();

    it('should return valid string', () => {
      const ret = schema.parse('hello world');
      assert.equal(ret, 'hello world');
    });

    it('should throw a ValidationError if not a string', () => {
      const err = catchError(schema.parse.bind(schema))(123);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be string but got number');
    });

    it('should pass if matches provided pattern', () => {
      const schema = z.string({ pattern: /^hello/ });
      assert.equal(schema.parse('hello world'), 'hello world');
    });

    it('should pass if matches provided pattern - fluent syntax', () => {
      const schema = z.string().pattern(/^hello/);
      assert.equal(schema.parse('hello world'), 'hello world');
    });

    it('should fail if string does not match pattern', () => {
      const schema = z.string({ pattern: /^hello/ });
      const err = catchError(schema.parse.bind(schema))('goodbye world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to match pattern /^hello/ but did not');
    });

    it('should fail if string does not match pattern - fluent syntax', () => {
      const schema = z.string().pattern(/^hello/);
      const err = catchError(schema.parse.bind(schema))('goodbye world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to match pattern /^hello/ but did not');
    });

    it('should pass if string length is within the range', () => {
      const schema = z.string({ min: 3, max: 6 });
      assert.equal(schema.parse('hello'), 'hello');
    });

    it('should fail if string length is less than min', () => {
      const schema = z.string({ min: 3 });
      const err = catchError(schema.parse.bind(schema))('hi');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to have length greater than or equal to 3 but had length 2');
    });

    it('should fail if string length is less than min - fluent syntax', () => {
      const schema = z.string().min(3);
      const err = catchError(schema.parse.bind(schema))('hi');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to have length greater than or equal to 3 but had length 2');
    });

    it('should fail if string length is greater than max', () => {
      const schema = z.string({ max: 6 });
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to have length less than or equal to 6 but had length 11');
    });

    it('should fail if string length is greater than max - fluent syntax', () => {
      const schema = z.string().max(6);
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to have length less than or equal to 6 but had length 11');
    });

    it('should pass if predicate function returns true', () => {
      const schema = z.string().predicate(() => true);
      assert.equal(schema.parse('hello'), 'hello');
    });

    it('should fail if predicate function returns false', () => {
      const schema = z.string({ predicate: () => false });
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to pass predicate function');
    });

    it('should fail if predicate function returns false - fluent syntax', () => {
      const schema = z.string().predicate(() => false);
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to pass predicate function');
    });

    it('should fail with predicate error message if predicate function returns false - fluent syntax', () => {
      const schema = z.string().predicate(() => false, 'custom predicate message');
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'custom predicate message');
    });

    it('should fail with predicate error message from options object if not overridden in fluent syntax', () => {
      const schema = z.string({ predicateErrMsg: 'options.predicateErrMsg' }).predicate(() => false);
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'options.predicateErrMsg');
    });

    it('should fail with same error message as predicate function if it throws', () => {
      const schema = z.string().predicate(() => {
        throw new Error('predicate error message');
      });
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'predicate error message');
    });
  });

  describe('boolean parsing', () => {
    const schema = z.boolean();

    it('should return valid boolean', () => {
      const ret = schema.parse(false);
      assert.equal(ret, false);
    });

    it('should throw a ValidationError if not a boolean', () => {
      const err = catchError(schema.parse.bind(schema))({});
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be boolean but got object');
    });
  });

  describe('number parsing', () => {
    const schema = z.number();

    it('should return valid number', () => {
      const ret = schema.parse(321);
      assert.equal(ret, 321);
    });

    it('should throw a ValidationError if not a number', () => {
      const err = catchError(schema.parse.bind(schema))(null);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be number but got null');
    });

    it('should succeed if number is with range', () => {
      const schema = z.number({ min: 0, max: 10 });
      const ret = schema.parse(5);
      assert.equal(ret, 5);
    });

    it('should succeed if number is equal to min or max', () => {
      const schema = z.number({ min: 0, max: 10 });
      assert.equal(schema.parse(0), 0);
      assert.equal(schema.parse(10), 10);
    });

    it('should fail if number is below min', () => {
      const schema = z.number({ min: 0 });
      const err = catchError(schema.parse.bind(schema))(-1);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected number to be greater than or equal to 0 but got -1');
    });

    it('should fail if number is below min - fluent syntax', () => {
      const schema = z.number().min(0);
      const err = catchError(schema.parse.bind(schema))(-1);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected number to be greater than or equal to 0 but got -1');
    });

    it('should fail if number is greater than max - fluent syntax', () => {
      const schema = z.number().max(10);
      const err = catchError(schema.parse.bind(schema))(20);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected number to be less than or equal to 10 but got 20');
    });
  });

  describe('undefined parsing', () => {
    const schema = z.undefined();

    it('should return undefined', () => {
      const ret = schema.parse(undefined);
      assert.equal(ret, undefined);
    });

    it('should throw a ValidationError if not undefined', () => {
      const err = catchError(schema.parse.bind(schema))('hello');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be undefined but got string');
    });
  });

  describe('null parsing', () => {
    const schema = z.null();

    it('should return null', () => {
      const ret = schema.parse(null);
      assert.equal(ret, null);
    });

    it('should throw a ValidationError if not null', () => {
      const err = catchError(schema.parse.bind(schema))(123);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be null but got number');
    });
  });

  describe('literal parsing', () => {
    const schema = z.literal('123');

    it('should return the literal if match', () => {
      const ret = schema.parse('123');
      assert.equal(ret, '123');
    });

    it('should throw a ValidationError if not the same type', () => {
      const err = catchError(schema.parse.bind(schema))(123);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, `expected value to be literal "123" but got 123`);
    });

    it('should throw validation error if literal is not the same value', () => {
      const err = catchError(schema.parse.bind(schema))('321');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, `expected value to be literal "123" but got "321"`);
    });
  });

  describe('unknown parsing', () => {
    it('should return the unknown value as is', () => {
      const schema = z.unknown();
      const ret = schema.parse('hello');
      assert.equal(ret, 'hello');
    });

    it('should force a key to be required within an object schema', () => {
      const schema = z.object({ required: z.unknown() });
      const err = catchError(schema.parse.bind(schema))({});
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(
        err.message,
        `error parsing object at path: "required" - expected key "required" of unknown type to be present on object`
      );
    });

    it('should force a key to be required within an object schema even if key value is undefined', () => {
      const schema = z.object({ required: z.unknown() });
      const ret = schema.parse({ required: undefined });
      assert.deepEqual(ret, { required: undefined });
      assert.equal(ret.hasOwnProperty('required'), true);
    });
  });

  describe('optional and nullable modifiers', () => {
    const optionalSchema = z.string().optional();
    const nullableSchema = z.string().nullable();

    it('should accept undefined as a value when optional schema', () => {
      const ret = optionalSchema.parse(undefined);
      assert.equal(ret, undefined);
    });

    it('should accept null as a value when nullable schema', () => {
      const ret = nullableSchema.parse(null);
      assert.equal(ret, null);
    });

    it('should not allow null when optional schema', () => {
      const err = catchError(optionalSchema.parse.bind(optionalSchema))(null);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(
        err.message,
        'No union satisfied:\n  expected type to be string but got null\n  expected type to be undefined but got null'
      );
    });

    it('should not allow undefined when nullable schema', () => {
      const err = catchError(nullableSchema.parse.bind(nullableSchema))(undefined);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(
        err.message,
        'No union satisfied:\n  expected type to be string but got undefined\n  expected type to be null but got undefined'
      );
    });
  });

  describe('object parsing', () => {
    const emptySchema = z.object({});
    it('should only accept empty object', () => {
      const ret = emptySchema.parse({});
      assert.deepEqual(ret, {});
    });

    it('should fail if value provided is null', () => {
      const err = catchError(emptySchema.parse.bind(emptySchema))(null);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected object but got null');
    });

    it('should fail if value provided is an array', () => {
      const err = catchError(emptySchema.parse.bind(emptySchema))([]);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be regular object but got array');
    });

    it('should fail if there are unknown keys', () => {
      const err = catchError(emptySchema.parse.bind(emptySchema))({ key: 'unkown', value: 'unknown' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["key","value"]');
    });

    it('should allow unknown keys', () => {
      const ret = emptySchema.parse({ a: 1 }, { allowUnknown: true });
      assert.deepEqual(ret, { a: 1 });
    });

    it('should return object with correct object shape - simple', () => {
      const schema = z.object({ name: z.string() });
      const ret = schema.parse({ name: 'Bobby' });
      assert.deepEqual(ret, { name: 'Bobby' });
    });

    it('should allow omitted properties on optional keys but include them in returned object', () => {
      const schema = z.object({
        name: z.string(),
        age: z.number().optional(),
      });
      const ret = schema.parse({ name: 'Bobby Darrin' });
      assert.deepEqual(ret, { name: 'Bobby Darrin' });
    });

    it('should fail if object has wrong shape', () => {
      const schema = z.object({ name: z.string() });
      const err = catchError(schema.parse.bind(schema))({ name: 5 });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "name" - expected type to be string but got number');
      assert.equal((err as z.ValidationError).path, 'name');
    });

    it('should give meaningful error for nested objects errors', () => {
      const schema = z.object({ person: z.object({ name: z.string() }) });
      const topLevelError = catchError(schema.parse.bind(schema))({ person: 5 });
      assert.equal(topLevelError instanceof z.ValidationError, true);
      assert.equal(
        topLevelError.message,
        'error parsing object at path: "person" - expected type to be object but got number'
      );
      assert.equal((topLevelError as z.ValidationError).path, 'person');

      const nestedError = catchError(schema.parse.bind(schema))({ person: { name: 5 } });
      assert.equal(nestedError instanceof z.ValidationError, true);
      assert.equal(
        nestedError.message,
        'error parsing object at path: "person.name" - expected type to be string but got number'
      );
      assert.deepEqual((nestedError as z.ValidationError).path, ['person', 'name']);
    });

    it('should give meaningful path error for errors occuring within array', () => {
      const carSchema = z.object({
        make: z.string(),
        year: z.number(),
      });
      const friendSchema = z.object({
        cars: z.array(carSchema),
      });
      const personSchema = z.object({ friends: z.array(friendSchema) });
      const schema = z.object({ person: personSchema });

      const err = catchError(schema.parse.bind(schema))({
        person: {
          friends: [
            { cars: [{ make: 'toyota', year: 1996 }] },
            {
              cars: [
                { make: 'hyundai', year: 2000 },
                { make: 'kia', year: '2003' }, // error is here on the year
              ],
            },
          ],
        },
      });

      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(
        err.message,
        'error parsing object at path: "person.friends[1].cars[1].year" - expected type to be number but got string'
      );
      assert.deepEqual((err as z.ValidationError).path, ['person', 'friends', 1, 'cars', 1, 'year']);
    });
  });

  describe('object utility parsing', () => {
    it('should pick some keys', () => {
      const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() }).pick(['a', 'b']);
      const ret = schema.parse({ a: 'hello', b: 42 });
      assert.deepEqual(ret, { a: 'hello', b: 42 });
    });

    it('should fail unexpected key in object.pick', () => {
      const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() }).pick(['a', 'b']);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 42, c: false });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["c"]');
    });

    it('should fail if missing key in object.pick', () => {
      const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() }).pick(['a', 'b']);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "b" - expected type to be number but got undefined');
    });

    it('should create an equivalent object between omit and pick', () => {
      const root = z.object({ a: z.string(), b: z.number(), c: z.boolean() });
      const picked = root.pick(['a', 'b']);
      const omitted = root.omit(['c']);
      assert.deepEqual(picked, omitted);
    });

    it('should create a partial of the object', () => {
      const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() }).partial();
      const ret = schema.parse({});
      assert.deepEqual(ret, {});
    });

    it('should fail if value contains an unknown key in object.partial', () => {
      const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() }).partial();
      const err = catchError(schema.parse.bind(schema))({ d: 'hello' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["d"]');
    });
  });

  describe('record parsing', () => {
    it('should pass for a record of primitive type', () => {
      const schema = z.record(z.string());
      const ret = schema.parse({ a: 'hello', b: 'world' });
      assert.deepEqual(ret, { a: 'hello', b: 'world' });
    });

    it('should fail if value to be parsed is not a record/object', () => {
      const schema = z.record(z.boolean());
      const err = catchError(schema.parse.bind(schema))('i am a string');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be object but got string');
    });

    it('should pass if all values in object match type', () => {
      const schema = z.record(z.boolean());
      const ret = schema.parse({ a: true, b: false });
      assert.deepEqual(ret, { a: true, b: false });
    });

    it('should fail if a value in object does not match the type', () => {
      const schema = z.record(z.boolean());
      const err = catchError(schema.parse.bind(schema))({ a: 'true', b: false });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing record at path "a" - expected type to be boolean but got string');
    });

    it('should give meaningful error messages for object records with nested errors', () => {
      const schema = z.record(z.object({ a: z.object({ b: z.boolean() }) }));
      const err = catchError(schema.parse.bind(schema))({ key: { a: { b: 'hello' } } });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing record at path "key.a.b" - expected type to be boolean but got string');
      assert.deepEqual((err as z.ValidationError).path, ['key', 'a', 'b']);
    });

    it('should fail if a key is present on object but value is undefined', () => {
      const schema = z.record(z.boolean());
      const err = catchError(schema.parse.bind(schema))({ a: undefined, b: false });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing record at path "a" - expected type to be boolean but got undefined');
    });

    it('should pass if a key is present on object but value is undefined if using dictionary', () => {
      const schema = z.dictionary(z.boolean());
      const ret = schema.parse({ a: undefined, b: false });
      assert.deepEqual(ret, { a: undefined, b: false });
    });

    it('should pass for record of partial objects', () => {
      const schema = z.record(z.partial(z.object({ a: z.string(), b: z.string() })));
      const ret = schema.parse({
        key1: { a: 'hello', b: 'world' },
        key2: { a: 'hello' },
        key3: {},
      });
      assert.deepEqual(ret, {
        key1: { a: 'hello', b: 'world' },
        key2: { a: 'hello' },
        key3: {},
      });
    });
  });

  describe('array parsing', () => {
    it('should pass when given an empty array', () => {
      const schema = z.array(z.number());
      const ret = schema.parse([]);
      assert.deepEqual(ret, []);
    });

    it('should pass when given an array with elements that match type', () => {
      const schema = z.array(z.number());
      const ret = schema.parse([1, 2, 3]);
      assert.deepEqual(ret, [1, 2, 3]);
    });

    it('should fail if not given an array', () => {
      const schema = z.array(z.string());
      const err = catchError(schema.parse.bind(schema))({ 0: 'first', 1: 'second', length: 2 });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected an array but got object');
    });

    it('should fail if an array element does not match schema', () => {
      const schema = z.array(z.string());
      const err = catchError(schema.parse.bind(schema))(['hello', 123]);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error at [1] - expected type to be string but got number');
      assert.deepEqual((err as z.ValidationError).path, [1]);
    });

    it('should pass if array has provided length', () => {
      const schema = z.array(z.string(), { length: 2 });
      const ret = schema.parse(['hello', 'world']);
      assert.deepEqual(ret, ['hello', 'world']);
    });

    it('should pass if array has provided length - fluent syntax', () => {
      const schema = z.array(z.string()).length(2);
      const ret = schema.parse(['hello', 'world']);
      assert.deepEqual(ret, ['hello', 'world']);
    });

    it('should fail if array does not have provided length', () => {
      const schema = z.array(z.string()).length(2);
      const err = catchError(schema.parse.bind(schema))([]);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected array to have length 2 but got 0');
    });

    it('should pass if array has length falls within range', () => {
      const schema = z.array(z.number(), { min: 2, max: 2 });
      const ret = schema.parse([1, 2]);
      assert.deepEqual(ret, [1, 2]);
    });

    it('should pass if array has length falls within range - fluent syntax', () => {
      const schema = z.array(z.number()).min(2).max(2);
      const ret = schema.parse([1, 2]);
      assert.deepEqual(ret, [1, 2]);
    });

    it('should fail if array length is less than min', () => {
      const schema = z.array(z.number(), { min: 2 });
      const err = catchError(schema.parse.bind(schema))([]);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected array to have length greater than or equal to 2 but got 0');
    });

    it('should fail if array length is greater than max', () => {
      const schema = z.array(z.number(), { max: 1 });
      const err = catchError(schema.parse.bind(schema))([1, 2]);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected array to have length less than or equal to 1 but got 2');
    });

    it('should pass if elements are unique', () => {
      const schema = z.array(z.number(), { unique: true });
      const ret = schema.parse([1, 2, 3]);
      assert.deepEqual(ret, [1, 2, 3]);
    });

    it('should fail if elements are not unique', () => {
      const schema = z.array(z.number(), { unique: true });
      const err = catchError(schema.parse.bind(schema))([1, 2, 2]);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected array to be unique but found same element at indexes 1 and 2');
    });

    it('should fail if elements are not unique - fluent syntax', () => {
      const schema = z.array(z.number()).unique();
      const err = catchError(schema.parse.bind(schema))([1, 2, 2]);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected array to be unique but found same element at indexes 1 and 2');
    });

    it('should give meaningful path error for objects', () => {
      const schema = z.array(z.object({ key: z.number() }));
      const err = catchError(schema.parse.bind(schema))([{ key: '123' }, { key: 321 }]);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error at [0].key - expected type to be number but got string');
      assert.deepEqual((err as z.ValidationError).path, [0, 'key']);
    });
  });

  describe('union parsing', () => {
    it('should pass for every type inside of a union', () => {
      const schema = z.union([
        z.string(),
        z.boolean(),
        z.number(),
        z.undefined(),
        z.null(),
        z.object({}),
        z.array(z.number()),
      ]);

      schema.parse('hello');
      schema.parse(true);
      schema.parse(123);
      schema.parse(undefined);
      schema.parse(null);
      schema.parse({});
      schema.parse([]);
    });

    it('should fail if type does not match any schema inside of union', () => {
      const schema = z.union([z.string(), z.number()]);
      const err = catchError(schema.parse.bind(schema))(true);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(
        err.message,
        'No union satisfied:\n  expected type to be string but got boolean\n  expected type to be number but got boolean'
      );
    });

    it('should fail for the union of objects if value not strictly one or the other', () => {
      const schema = z.union([z.object({ a: z.string() }), z.object({ b: z.number() }), z.object({ c: z.boolean() })]);
      const err = catchError(schema.parse.bind(schema))({ a: 'string', b: 123, c: false });
      assert.equal(err instanceof z.ValidationError, true);

      const expectedSubMessages = [
        'unexpected keys on object: ["b","c"]',
        'unexpected keys on object: ["a","c"]',
        'unexpected keys on object: ["a","b"]',
      ];
      assert.equal(err.message, 'No union satisfied:\n  ' + expectedSubMessages.join('\n  '));
    });

    it('should pass for the union of objects when strict is false and value subclasses one type', () => {
      const schema = z.union([z.object({ a: z.string() }), z.object({ b: z.number() }), z.object({ c: z.boolean() })], {
        strict: false,
      });
      const ret = schema.parse({ a: 'string', b: 123, c: false });
      assert.deepEqual(ret, { a: 'string', b: 123, c: false });
    });
  });

  describe('intersection parsing', () => {
    it('should pass if value is the intersection of both object types', () => {
      const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));
      const ret = schema.parse({ a: 'hello', b: 123 });
      assert.deepEqual(ret, { a: 'hello', b: 123 });
    });

    it('should fail if value is not the intersection of both object types', () => {
      const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));
      const err = catchError(schema.parse.bind(schema))({ a: 'hello' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "b" - expected type to be number but got undefined');
    });

    it('should fail if value has unknown keys to the intersection of both object types', () => {
      const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 3, c: true, d: false });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object ["c","d"]');
    });

    it('should reduce union types to their interseciton', () => {
      const schema = z.intersection(z.string(), z.string().nullable());
      const ret = schema.parse('string');
      assert.equal(ret, 'string');

      const err = catchError(schema.parse.bind(schema))(null);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be string but got null');
    });

    it('should intersect a record an object such that the object fields have precedence over the record', () => {
      const schema = z.intersection(z.object({ a: z.string() }), z.record(z.number()));
      const ret = schema.parse({ a: 'hello', b: 3 });
      assert.deepEqual(ret, { a: 'hello', b: 3 });
    });

    it('should fail the record and object intersection does not respect the object shape', () => {
      const schema = z.intersection(z.object({ a: z.string() }), z.record(z.number()));
      const err = catchError(schema.parse.bind(schema))({ a: 2, b: 3 });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "a" - expected type to be string but got number');
    });

    it('should pass if key values in object respects record intersection', () => {
      const recordA = z.record(z.object({ a: z.number() }));
      const recordB = z.record(z.object({ b: z.string() }));
      const schema = z.intersection(recordA, recordB);
      const ret = schema.parse({ key: { a: 2, b: 'hello' } });
      assert.deepEqual(ret, { key: { a: 2, b: 'hello' } });
    });

    it('should fail if key values in object do satisfy record intersection', () => {
      const recordA = z.record(z.object({ a: z.number() }));
      const recordB = z.record(z.object({ b: z.string() }));
      const schema = z.intersection(recordA, recordB);
      const err = catchError(schema.parse.bind(schema))({ key: { a: 2 } });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing record at path "key.b" - expected type to be string but got undefined');
    });

    it('should fail if the value contains object keys not in Record<object> intersection', () => {
      const recordA = z.record(z.object({ a: z.number() }));
      const recordB = z.record(z.object({ b: z.string() }));
      const schema = z.intersection(recordA, recordB);
      const err = catchError(schema.parse.bind(schema))({ key: { a: 2, b: 'string', c: true } });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing record at path "key" - unexpected keys on object ["c"]');
    });

    it('should parse the intersection of partials objects', () => {
      const schema = z.intersection(z.partial(z.object({ a: z.string() })), z.partial(z.object({ b: z.number() })));
      const ret = schema.parse({ a: 'hello' });
      assert.deepEqual(ret, { a: 'hello' });
    });

    it('should fail if intersection of partial types is not respected', () => {
      const schema = z.intersection(z.partial(z.object({ a: z.string() })), z.partial(z.object({ b: z.number() })));
      const err = catchError(schema.parse.bind(schema))({ a: 3 });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(
        err.message,
        'error parsing object at path: "a" - No union satisfied:\n  expected type to be string but got number\n  expected type to be undefined but got number'
      );
    });

    it('should intersect two picked types', () => {
      const schemaA = z.pick(z.object({ a: z.string(), b: z.string() }), ['a']);
      const schemaB = z.pick(z.object({ a: z.number(), b: z.number() }), ['b']);
      const schema = schemaA.and(schemaB);
      const ret = schema.parse({ a: 'hello', b: 123 });
      assert.deepEqual(ret, { a: 'hello', b: 123 });
    });

    it('should fail if unknown key is present of intersect of two picked types', () => {
      const schemaA = z.pick(z.object({ a: z.string(), b: z.string() }), ['a']);
      const schemaB = z.pick(z.object({ a: z.number(), b: z.number() }), ['b']);
      const schema = schemaA.and(schemaB);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 123, c: 'patate' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object ["c"]');
    });

    it('should fail if key is missing from intersect of two picked types', () => {
      const schemaA = z.pick(z.object({ a: z.string(), b: z.string() }), ['a']);
      const schemaB = z.pick(z.object({ a: z.number(), b: z.number() }), ['b']);
      const schema = schemaA.and(schemaB);
      const err = catchError(schema.parse.bind(schema))({ b: 123 });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "a" - expected type to be string but got undefined');
    });

    it('should intersect two omit types', () => {
      const schemaA = z.omit(z.object({ a: z.string(), b: z.string() }), ['a']);
      const schemaB = z.omit(z.object({ a: z.number(), b: z.number() }), ['b']);
      const schema = schemaA.and(schemaB);
      const ret = schema.parse({ a: 123, b: 'hello' });
      assert.deepEqual(ret, { a: 123, b: 'hello' });
    });

    it('should fail if unknown key in intersect of two omit types', () => {
      const schemaA = z.omit(z.object({ a: z.string(), b: z.string() }), ['a']);
      const schemaB = z.omit(z.object({ a: z.number(), b: z.number() }), ['b']);
      const schema = schemaA.and(schemaB);
      const err = catchError(schema.parse.bind(schema))({ a: 123, b: 'hello', c: 'patate' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object ["c"]');
    });

    it('should fail if missing key in intersect of two omit types', () => {
      const schemaA = z.omit(z.object({ a: z.string(), b: z.string() }), ['a']);
      const schemaB = z.omit(z.object({ a: z.number(), b: z.number() }), ['b']);
      const schema = schemaA.and(schemaB);
      const err = catchError(schema.parse.bind(schema))({ b: 'hello' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "a" - expected type to be number but got undefined');
    });

    it('should intersect a pick and an omit', () => {
      const schemaA = z.omit(z.object({ a: z.string(), b: z.string() }), ['a']);
      const schemaB = z.pick(z.object({ a: z.number(), b: z.number() }), ['a']);
      const schema = schemaA.and(schemaB);
      const ret = schema.parse({ a: 123, b: 'hello' });
      assert.deepEqual(ret, { a: 123, b: 'hello' });
    });

    it('should fail if unknown key in intersect of pick and omit types', () => {
      const schemaA = z.omit(z.object({ a: z.string(), b: z.string() }), ['a']);
      const schemaB = z.pick(z.object({ a: z.number(), b: z.number() }), ['a']);
      const schema = schemaA.and(schemaB);
      const err = catchError(schema.parse.bind(schema))({ a: 123, b: 'hello', c: 'patate' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object ["c"]');
    });

    it('should fail if missing key in intersect of pick and omit types', () => {
      const schemaA = z.pick(z.object({ a: z.string(), b: z.string() }), ['a']);
      const schemaB = z.omit(z.object({ a: z.number(), b: z.number() }), ['a']);
      const schema = schemaA.and(schemaB);
      const err = catchError(schema.parse.bind(schema))({ b: 'hello' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "a" - expected type to be string but got undefined');
    });

    it('should intersect a pick and some other type correctly', () => {
      const schema = z
        .pick(z.object({ a: z.string(), b: z.string() }), ['a'])
        .and(z.object({ c: z.number() }).and(z.object({ d: z.boolean() })));
      const ret = schema.parse({ a: 'hello', c: 42, d: true });
      assert.deepEqual(ret, { a: 'hello', c: 42, d: true });
    });

    it('should fail if unknown key in intersect of pick and some other complex type', () => {
      const schema = z
        .pick(z.object({ a: z.string(), b: z.string() }), ['a'])
        .and(z.object({ c: z.number() }).and(z.object({ d: z.boolean() })));
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 'world', c: 42, d: true });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object ["b"]');
    });

    it('should fail if missing key in intersect of pick and some other complex type', () => {
      const schema = z
        .pick(z.object({ a: z.string(), b: z.string() }), ['a'])
        .and(z.object({ c: z.number() }).and(z.object({ d: z.boolean() })));
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', d: true });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "c" - expected type to be number but got undefined');
    });

    it('should fail if trying to create an intersection of a tuple type', () => {
      const err = catchError(z.intersection)(z.tuple([]), z.object({}));
      assert.equal(err.message, 'tuple intersection not supported');
    });
  });

  describe('enum parsing', () => {
    enum Colors {
      red = 'red',
      blue = 'blue',
      green = 'green',
    }
    const schema = z.enum(Colors);

    it('should pass if value is part of enum', () => {
      assert.equal(schema.parse('red'), Colors.red);
    });

    it('should fail if not part of enum', () => {
      const err = catchError(schema.parse.bind(schema))('hot fuzz');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error "hot fuzz" not part of enum values');
    });

    it('should return true if value satisfies enum', () => {
      assert.equal(schema.check('green'), true);
    });

    it('should return false if value satisfies enum', () => {
      assert.equal(schema.check('blueberry'), false);
    });
  });

  describe('partial parsing', () => {
    it('should have no effect on a primitive type', () => {
      const schema = z.partial(z.string());
      assert.equal(schema.parse('hello'), 'hello');

      const err = catchError(schema.parse.bind(schema))(undefined);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be string but got undefined');
    });

    it('should make an object keys optional', () => {
      const schema = z.partial(z.object({ a: z.string(), b: z.boolean() }));
      const ret = schema.parse({});
      assert.deepEqual(ret, {});
    });

    it('should not lose any validation definitions', () => {
      const schema = z.partial(z.object({ a: z.string().pattern(/hello/) }));
      const err = catchError(schema.parse.bind(schema))({ a: 'hey' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(
        err.message,
        'error parsing object at path: "a" - No union satisfied:\n  expected string to match pattern /hello/ but did not\n  expected type to be undefined but got string'
      );
    });

    it('should make arrays become "holey" with undefined', () => {
      const schema = z.partial(z.array(z.string()));
      const ret = schema.parse(['hello', undefined, 'world']);
      assert.deepEqual(ret, ['hello', undefined, 'world']);
    });

    it('should make object intersection keys optional', () => {
      const schemaA = z.object({ a: z.string() });
      const schemaB = z.object({ b: z.boolean() });
      const schema = z.partial(schemaA.and(schemaB));
      assert.deepEqual(schema.parse({}), {});
    });

    it('should fail if unknown keys of partial object intersection', () => {
      const schemaA = z.object({ a: z.string() });
      const schemaB = z.object({ b: z.boolean() });
      const schema = z.partial(schemaA.and(schemaB));
      const err = catchError(schema.parse.bind(schema))({ d: 'hey' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object ["d"]');
    });

    it('should make the values of a record optional', () => {
      const schema = z.partial(z.record(z.number()));
      const ret = schema.parse({ a: 3, b: undefined });
      assert.deepEqual(ret, { a: 3, b: undefined });
    });

    xit('should pass with empty object for object unions partial', () => {
      const schema = z.partial(z.object({ a: z.number() }).or(z.object({ b: z.string() })));
      assert.deepEqual(schema.parse({}), { a: undefined, b: undefined });
    });
  });

  describe('pick parsing', () => {
    it('should pass if picked object type is satisfied', () => {
      const schema = z.pick(z.object({ a: z.number(), b: z.string() }), ['a']);
      const ret = schema.parse({ a: 1 });
      assert.deepEqual(ret, { a: 1 });
    });

    it('should fail if value contains all keys and not only picked ones from picked object', () => {
      const schema = z.pick(z.object({ a: z.number(), b: z.string() }), ['a']);
      const err = catchError(schema.parse.bind(schema))({ a: 1, b: 'hello' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });

    it('should fail if value is missing properties from picked object', () => {
      const schema = z.pick(z.object({ a: z.number(), b: z.string() }), ['a']);
      const err = catchError(schema.parse.bind(schema))({});
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "a" - expected type to be number but got undefined');
    });

    it('should pass if picked record type is satisfied', () => {
      const schema = z.pick(z.record(z.number()), ['a', 'b']);
      const ret = schema.parse({ a: 1, b: 2 });
      assert.deepEqual(ret, { a: 1, b: 2 });
    });

    it('should fail if keys not part of the pick in from the record', () => {
      const schema = z.pick(z.record(z.number()), ['a', 'b']);
      const err = catchError(schema.parse.bind(schema))({ a: 1, b: 2, c: 3 });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["c"]');
    });

    it('should fail if value is missing properties from picked record', () => {
      const schema = z.pick(z.record(z.number()), ['a', 'b']);
      const err = catchError(schema.parse.bind(schema))({ a: 1 });
      assert.equal(err instanceof z.ValidationError, true, 'Did not throw ValidationError');
      assert.equal(err.message, 'error parsing record at path "b" - expected type to be number but got undefined');
    });

    it('should pass if picked object intersection type is satisfied', () => {
      const schema = z.pick(z.object({ a: z.number() }).and(z.object({ b: z.string() })), ['a']);
      const ret = schema.parse({ a: 1 });
      assert.deepEqual(ret, { a: 1 });
    });

    it('should pass if value contains all keys and not only picked ones from object intersection', () => {
      const schema = z.pick(z.object({ a: z.number() }).and(z.object({ b: z.string() })), ['a']);
      const err = catchError(schema.parse.bind(schema))({ a: 1, b: 'hello' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });

    it('should fail if value is missing properties from picked object intersection', () => {
      const schema = z.pick(z.object({ a: z.number() }).and(z.object({ b: z.string() })), ['a']);
      const err = catchError(schema.parse.bind(schema))({});
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "a" - expected type to be number but got undefined');
    });

    it('should fail on construction of primitive schema if root is primitive', () => {
      // @ts-ignore
      for (const type of [z.string, z.boolean, z.undefined, z.unknown, z.null, z.number]) {
        const err = catchError(z.pick)(type(), ['a']);
        assert.equal(err.message, 'cannot instantiate a PickType with a primitive schema');
      }
    });

    it('should fail on construction of intesection of primitive schemas', () => {
      const err = catchError(z.pick)(z.string().and(z.string().optional()), ['a']);
      assert.equal(err.message, 'cannot instantiate a PickType with a primitive schema');
    });

    it('should fail on construction of union of only primitive schemas', () => {
      const err = catchError(z.pick)(z.string().or(z.boolean()).or(z.number()), []);
      assert.equal(err.message, 'cannot instantiate a PickType with a primitive schema');
    });

    it('should pass for pick of pick', () => {
      const schema = z.pick(
        z.pick(
          z.object({
            a: z.string(),
            b: z.string(),
            c: z.string(),
          }),
          ['a', 'b']
        ),
        ['a']
      );
      const ret = schema.parse({ a: 'hello' });
      assert.deepEqual(ret, { a: 'hello' });
    });

    it('should fail for pick of pick if keys outside of picked are present', () => {
      const schema = z.pick(
        z.pick(
          z.object({
            a: z.string(),
            b: z.string(),
            c: z.string(),
          }),
          ['a', 'b']
        ),
        ['a']
      );
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 'world', c: 'yo' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b","c"]');
    });

    it('should pass for pick of omitted object', () => {
      const schema = z.pick(
        z.omit(
          z.object({
            a: z.string(),
            b: z.string(),
            c: z.string(),
          }),
          ['c']
        ),
        ['a']
      );
      const ret = schema.parse({ a: 'hello' });
      assert.deepEqual(ret, { a: 'hello' });
    });

    it('should fail for pick of omitted object', () => {
      const schema = z.pick(
        z.omit(
          z.object({
            a: z.string(),
            b: z.string(),
            c: z.string(),
          }),
          ['c']
        ),
        ['a']
      );
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 'world', c: 'yo' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b","c"]');
    });
  });

  describe('omit parsing', () => {
    it('should fail on construction of primitive schema if root is primitive', () => {
      // @ts-ignore
      for (const type of [z.string, z.boolean, z.undefined, z.unknown, z.null, z.number]) {
        const err = catchError(z.omit)(type(), ['a']);
        assert.equal(err.message, 'cannot instantiate a OmitType with a primitive schema');
      }
    });

    it('should fail on construction of intesection of primitive schemas', () => {
      const err = catchError(z.omit)(z.string().and(z.string().optional()), ['a']);
      assert.equal(err.message, 'cannot instantiate a OmitType with a primitive schema');
    });

    it('should fail on construction of union of only primitive schemas', () => {
      const err = catchError(z.omit)(z.string().or(z.boolean()).or(z.number()), []);
      assert.equal(err.message, 'cannot instantiate a OmitType with a primitive schema');
    });

    it('should pass if value satisfies schema and omits indicated keys', () => {
      const schema = z.omit(z.object({ a: z.string(), b: z.string() }), ['b']);
      const ret = schema.parse({ a: 'hello' });
      assert.deepEqual(ret, { a: 'hello' });
    });

    it('should fail if value does not omit indicated key', () => {
      const schema = z.omit(z.object({ a: z.string(), b: z.string() }), ['b']);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 'world' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });

    it('should pass when value omit key from object intersection', () => {
      const schema = z.omit(z.object({ a: z.string() }).and(z.object({ b: z.string() })), ['b']);
      const ret = schema.parse({ a: 'hello' });
      assert.deepEqual(ret, { a: 'hello' });
    });

    it('should pass if record does not contain omitted fields', () => {
      const schema = z.omit(z.record(z.string()), ['b']);
      const ret = schema.parse({ a: 'hello' });
      assert.deepEqual(ret, { a: 'hello' });
    });

    it('should fail if record does contain omitted fields', () => {
      const schema = z.omit(z.record(z.string()), ['b']);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 'world' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });

    it('should fail key is in record intersection', () => {
      const schema = z.omit(z.record(z.object({ a: z.string() }).and(z.record(z.object({ b: z.string() })))), ['b']);
      const err = catchError(schema.parse.bind(schema))({
        a: { a: 'hello', b: 'world' },
        b: { a: 'hello', b: 'world' },
      });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });

    it('should pass if omitted key is not present in record of object intersection', () => {
      const record = z.record(z.string());
      const obj = z.object({ b: z.number() });
      const intersec = record.and(obj);
      const schema = z.omit(intersec, ['b']);
      const ret = schema.parse({ a: 'hello' });
      assert.deepEqual(ret, { a: 'hello' });
    });

    it('should fail if key is present in record object intersection', () => {
      const schema = z.omit(z.record(z.string()).and(z.object({ b: z.number() })), ['b']);
      const err = catchError(schema.parse.bind(schema))({ b: 123 });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });

    it('should omit a key from a picked type', () => {
      const schema = z.omit(
        z.pick(
          z.object({
            a: z.string(),
            b: z.string(),
            c: z.string(),
          }),
          ['a', 'b']
        ),
        ['b']
      );
      const ret = schema.parse({ a: 'hello' });
      assert.deepEqual(ret, { a: 'hello' });
    });
    it('should fail if key is present in the omit of a picked type', () => {
      const schema = z.omit(
        z.pick(
          z.object({
            a: z.string(),
            b: z.string(),
            c: z.string(),
          }),
          ['a', 'b']
        ),
        ['b']
      );
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 'world', c: 'yolo' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });

    it('should work for omit of omit', () => {
      const schema = z.omit(
        z.omit(
          z.object({
            a: z.string(),
            b: z.string(),
            c: z.string(),
          }),
          ['a']
        ),
        ['b']
      );
      const ret = schema.parse({ c: 'hello' });
      assert.deepEqual(ret, { c: 'hello' });
    });

    it('should fail for omit of omit if omitted keys are preset', () => {
      const schema = z.omit(
        z.omit(
          z.object({
            a: z.string(),
            b: z.string(),
            c: z.string(),
          }),
          ['a']
        ),
        ['b']
      );
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 'world', c: 'yolo' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });
  });

  describe('tuple parsing', () => {
    it('should fail if non array is passed as value', () => {
      const schema = z.tuple([]);
      const err = catchError(schema.parse.bind(schema))(null);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected tuple value to be type array but got null');
    });

    it('should fail fast if value does not have same length as tuple type', () => {
      const schema = z.tuple([z.string(), z.number()]);
      const err = catchError(schema.parse.bind(schema))(['hello']);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected tuple length to be 2 but got 1');
    });

    it('should pass for tuple', () => {
      const schema = z.tuple([z.string(), z.number(), z.object({ a: z.string(), b: z.number() })]);
      const ret = schema.parse(['hello', 42, { a: 'hello', b: 42 }]);
      assert.deepEqual(ret, ['hello', 42, { a: 'hello', b: 42 }]);
    });

    it('should fail if tuple does not match', () => {
      const schema = z.tuple([z.string(), z.number()]);
      const err = catchError(schema.parse.bind(schema))(['hello', 'world']);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing tuple at index 1: expected type to be number but got string');
    });

    it('should give meaningful error message', () => {
      const schema = z.tuple([z.string(), z.object({ a: z.object({ b: z.string() }) })]);
      const err = catchError(schema.parse.bind(schema))(['hello', { a: { b: 42 } }]);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(
        err.message,
        'error parsing tuple at index 1: error parsing object at path: "a.b" - expected type to be string but got number'
      );
    });
  });
});
