import * as assert from 'assert';
import * as z from '../src/index';
import { ObjectType, ObjectShape } from '../src/types';

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
      const schema = z.string().pattern(/^hello/);
      assert.equal(schema.parse('hello world'), 'hello world');
    });

    it('should fail if string does not match pattern ', () => {
      const schema = z.string().pattern(/^hello/);
      const err = catchError(schema.parse.bind(schema))('goodbye world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to match pattern /^hello/ but did not');
    });

    it('should fail if string does not match pattern and use custom error message', () => {
      const schema = z.string().pattern(/^hello/, 'value should start with hello');
      const err = catchError(schema.parse.bind(schema))('goodbye world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'value should start with hello');
    });

    it('should fail if string does not match pattern and use custom error message function', () => {
      const schema = z.string().pattern(/^hello/, value => `value ${JSON.stringify(value)} did notmatch regexp`);
      const err = catchError(schema.parse.bind(schema))('goodbye world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'value "goodbye world" did notmatch regexp');
    });

    it('should pass if string length is within the range', () => {
      const schema = z.string({ min: 3, max: 6 });
      assert.equal(schema.parse('hello'), 'hello');
    });

    it('should fail if string length is outside  length the range', () => {
      const schema = z.string({ min: 3, max: 6 });
      const parse = catchError(schema.parse.bind(schema));

      const minErr = parse('hi');
      assert.ok(minErr instanceof z.ValidationError);
      assert.equal(minErr.message, 'expected string to have length greater than or equal to 3 but had length 2');

      const maxErr = parse('heellloo');
      assert.ok(maxErr instanceof z.ValidationError);
      assert.equal(maxErr.message, 'expected string to have length less than or equal to 6 but had length 8');
    });

    it('should fail if string length is outside  length the range - fluent syntax', () => {
      const schema = z.string().min(3).max(6);
      const parse = catchError(schema.parse.bind(schema));

      const minErr = parse('hi');
      assert.ok(minErr instanceof z.ValidationError);
      assert.equal(minErr.message, 'expected string to have length greater than or equal to 3 but had length 2');

      const maxErr = parse('heellloo');
      assert.ok(maxErr instanceof z.ValidationError);
      assert.equal(maxErr.message, 'expected string to have length less than or equal to 6 but had length 8');
    });

    it('should pass if string length is within the range - fluent syntax', () => {
      const schema = z.string().min(3).max(6);
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
      const schema = z.string().max(6);
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected string to have length less than or equal to 6 but had length 11');
    });

    it('should pass if predicate function returns true', () => {
      const schema = z.string().withPredicate(() => true);
      assert.equal(schema.parse('hello'), 'hello');
    });

    it('should fail if predicate function returns false', () => {
      const schema = z.string().withPredicate(() => false);
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'failed anonymous predicate function');
    });

    it('should fail if predicate function returns false - fluent syntax', () => {
      const schema = z.string().withPredicate(() => false);
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'failed anonymous predicate function');
    });

    it('should fail with predicate error message if predicate function returns false', () => {
      const schema = z.string({ predicate: { func: () => false, errMsg: 'custom predicate message' } });
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'custom predicate message');
    });

    it('should fail with predicate error message if predicate function returns false - fluent syntax', () => {
      const schema = z.string().withPredicate(() => false, 'custom predicate message');
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'custom predicate message');
    });

    it('should support multiple predicates - fluent syntax', () => {
      const schema = z
        .string()
        .withPredicate(value => isNaN(Number(value)), 'value must not be a number')
        .withPredicate(value => value.startsWith('hello'), 'value must start with hello');
      assert.equal(schema.parse('hello world'), 'hello world');
    });

    it('should fail if not all predicates are met', () => {
      const schema = z.string({
        predicate: [
          { func: (value: string) => isNaN(Number(value)), errMsg: 'value must not be a number' },
          { func: (value: string) => value.startsWith('hello'), errMsg: 'value must start with hello' },
        ],
      });

      const parse = catchError(schema.parse.bind(schema));

      const pred1Err = parse('123');
      assert.ok(pred1Err instanceof z.ValidationError);
      assert.equal(pred1Err.message, 'value must not be a number');

      const pred2Err = parse('goodbye world');
      assert.ok(pred2Err instanceof z.ValidationError);
      assert.equal(pred2Err.message, 'value must start with hello');
    });

    it('should fail if not all predicates are met - fluent syntax', () => {
      const schema = z
        .string()
        .withPredicate(value => isNaN(Number(value)), 'value must not be a number')
        .withPredicate(value => value.startsWith('hello'), 'value must start with hello');

      const parse = catchError(schema.parse.bind(schema));

      const pred1Err = parse('123');
      assert.ok(pred1Err instanceof z.ValidationError);
      assert.equal(pred1Err.message, 'value must not be a number');

      const pred2Err = parse('goodbye world');
      assert.ok(pred2Err instanceof z.ValidationError);
      assert.equal(pred2Err.message, 'value must start with hello');
    });

    it('should fail with same error message as predicate function if it throws', () => {
      const schema = z.string().withPredicate(() => {
        throw new Error('predicate error message');
      });
      const err = catchError(schema.parse.bind(schema))('hello world');
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'predicate error message');
    });

    it('should "and" with another type', () => {
      const schema = z.boolean().and(z.boolean().or(z.string()));
      assert.equal(schema.parse(true), true);
    });

    it('should fail "and" with another type', () => {
      const schema = z.boolean().and(z.boolean().or(z.string()));
      const err = catchError(schema.parse.bind(schema))('hello');
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected type to be boolean but got string');
    });

    it('should pass if value is within valid strings', () => {
      const schema = z.string().valid(['hello', 'world']);
      assert.equal(schema.parse('hello'), 'hello');
    });

    it('should fail if value is not within valid strings', () => {
      const schema = z.string().valid(['hello', 'world']);
      const err = catchError(schema.parse.bind(schema))('hi my dudes');
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected string to be one of: ["hello","world"]');
    });

    it('should return default schema value when parsing undefined', () => {
      const schema = z.string().default('hello world!');
      assert.equal(schema.parse(undefined), 'hello world!');
    });

    it('should run default schema function every call with undefined', () => {
      let def = 'hello world';
      const schema = z.string().default(() => (def += '!'));
      assert.equal(schema.parse(undefined), 'hello world!');
      assert.equal(schema.parse('hello'), 'hello');
      assert.equal(schema.parse(undefined), 'hello world!!');
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

    it('should take default value', () => {
      const schema = z.boolean().default(false);
      assert.equal(schema.parse(undefined), false);
    });

    it('should take default value - func', () => {
      const schema = z.boolean().default(() => true);
      assert.equal(schema.parse(undefined), true);
    });

    it('should fail with null even when default value', () => {
      const schema = z.boolean().default(false);
      const err = catchError(schema.parse.bind(schema))(null);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected type to be boolean but got null');
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

    it('should fail if number fails predicate', () => {
      const schema = z.number().withPredicate(
        value => value % 2 === 0,
        value => `expected value ${value} to be even`
      );
      const err = catchError(schema.parse.bind(schema))(1);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected value 1 to be even');
    });

    it('should maintain coercion after an applied predicate', () => {
      const schema = z
        .number()
        .coerce()
        .withPredicate(
          value => value % 2 === 0,
          value => `expected value ${value} to be even`
        );
      assert.equal(schema.parse('2'), 2);
    });

    it('should convert a string to a number if coerce is true', () => {
      const schema = z.number({ coerce: true });
      const ret = schema.parse('42');
      assert.equal(ret, 42);
    });

    it('should convert a string to a number if coerce is true - fluent syntax', () => {
      const schema = z.number().coerce();
      const ret = schema.parse('42');
      assert.equal(ret, 42);
    });

    it('should fail to convert an empty string', () => {
      const schema = z.number().coerce();
      const err = catchError(schema.parse.bind(schema))('');
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected type to be number but got string');
    });

    it('should fail to convert a non numeric string', () => {
      const schema = z.number().coerce();
      const err = catchError(schema.parse.bind(schema))('hello');
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected type to be number but got string');
    });

    it('should apply validators with coerced values', () => {
      const schema = z.number().coerce().min(42);
      const err = catchError(schema.parse.bind(schema))('5');
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected number to be greater than or equal to 42 but got 5');
    });

    it('should "and" with another schema', () => {
      const schema = z.number().and(z.number().or(z.string()));
      assert.equal(schema.parse(42), 42);
    });

    it('should fail "and" with another schema', () => {
      const schema = z.number().and(z.number().or(z.string()));
      const err = catchError(schema.parse.bind(schema))('5');
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected type to be number but got string');
    });

    it('should return the same instance if object contains non coercable number', () => {
      const schema = z.object({ a: z.number() });
      const data = { a: 5 };
      const ret = schema.parse(data);
      assert.equal(ret, data);
    });

    it('should return the different instance if object contains coercable number', () => {
      const schema = z.object({ a: z.number().coerce() });
      const data = { a: 5 };
      const ret = schema.parse(data);
      assert.notEqual(ret, data);
      assert.deepEqual(ret, data);
    });

    it('should return the default value when parsing undefined', () => {
      const schema = z.number().default(0);
      assert.equal(schema.parse(undefined), 0);
    });

    it('should return the default value when parsing undefined - func', () => {
      let num = 0;
      const schema = z.number().default(() => num++);
      assert.equal(schema.parse(undefined), 0);
      assert.equal(schema.parse(100), 100);
      assert.equal(schema.parse(undefined), 1);
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

    it('should create a union of literals', () => {
      const schema = z.literals('hello', 'world');
      assert.equal(schema.parse('hello'), 'hello');
    });

    it('should fail if value is not in union of literals', () => {
      const schema = z.literals('hello', 'world');
      const err = catchError(schema.parse.bind(schema))(null);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(
        err.message,
        'No union satisfied:\n  expected value to be literal "hello" but got null\n  expected value to be literal "world" but got null'
      );
    });

    it('should return literal when default is set', () => {
      const schema = z.literal('hello').default('hello');
      assert.equal(schema.parse(undefined), 'hello');
    });
  });

  describe('date parsing', () => {
    it('should return date instance if valid date', () => {
      const schema = z.date();
      const date = new Date();
      const ret = schema.parse(date);
      assert.equal(ret, date);
    });

    it('should fail if non date or string-date type', () => {
      const schema = z.date();
      const err = catchError(schema.parse.bind(schema))(true);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected type Date but got boolean');
    });

    it('should convert a date string to a date', () => {
      const schema = z.date();
      const date = new Date();
      const ret = schema.parse(date.toISOString());
      assert.ok(ret instanceof Date);
      assert.notEqual(ret, date);
      assert.equal(ret.getTime(), date.getTime());
    });

    it('should apply predicates', () => {
      const now = Date.now();
      const schema = z
        .date()
        .withPredicate(value => value.getTime() > now, 'expected date to be after than current moment')
        .withPredicate(value => value.getUTCDay() <= 5 && value.getUTCDay() >= 1, 'expected date to be a weekday');

      const parse = catchError(schema.parse.bind(schema));

      const pastDate = new Date(Date.now() - 3600);
      const pastErr = parse(pastDate);
      assert.ok(pastErr instanceof z.ValidationError);
      assert.equal(pastErr.message, 'expected date to be after than current moment');

      const weekendDate = 'Sun Jul 30 2023';
      const weekendErr = parse(weekendDate);
      assert.ok(weekendErr instanceof z.ValidationError);
      assert.equal(weekendErr.message, 'expected date to be a weekday');
    });

    it('should return default date when parsing undefined', () => {
      const date = new Date();
      const schema = z.date().default(date);
      assert.equal(schema.parse(undefined), date);
    });

    it('should return default date when parsing undefined - func', () => {
      const date = new Date();
      const schema = z.date().default(() => date);
      assert.equal(schema.parse(undefined), date);
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

    it('should return default value', () => {
      const schema = z.unknown().default('hello');
      assert.equal(schema.parse(undefined), 'hello');
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
      assert.equal(err.message, 'expected type to be string but got null');
    });

    it('should not allow undefined when nullable schema', () => {
      const err = catchError(nullableSchema.parse.bind(nullableSchema))(undefined);
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'expected type to be string but got undefined');
    });

    it('should return a nullable modifiers default value if parsing undefined', () => {
      const nullDefaultSchema = z.number().nullable().default(null);
      const numberDefaultSchema = z.number().nullable().default(123);
      assert.equal(nullDefaultSchema.parse(undefined), null);
      assert.equal(numberDefaultSchema.parse(undefined), 123);
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

    it('should convert string dates to dates', () => {
      const schema = z.object({ value: z.date() });
      const date = new Date();
      const ret = schema.parse({ value: date.toISOString() });
      assert.ok(ret.value instanceof Date);
      assert.equal(ret.value.getTime(), date.getTime());
    });

    it('should convert string numbers to numbers with coercion', () => {
      const schema = z.object({ value: z.number().coerce() });
      const ret = schema.parse({ value: '42' });
      assert.deepEqual(ret, { value: 42 });
    });

    it('should fail if object does not pass predicate', () => {
      const schema = z.object({ a: z.string(), b: z.string() }).withPredicate(
        value => value.a === value.b,
        value => `expected properties "${value.a}" and "${value.b}" to be equal`
      );
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 'world' });
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected properties "hello" and "world" to be equal');
    });

    it('should not transfer predicates over to a pick/omit/partial schema from an object', () => {
      const base = z.object({ a: z.string() }).withPredicate(() => true);
      assert.ok(Array.isArray((base as any).predicates));
      assert.equal((base as any).predicates.length, 1);

      const picked = base.pick(['a']);
      assert.equal((picked as any).predicates, null);

      const omitted = base.omit(['a']);
      assert.equal((omitted as any).predicates, null);

      const partialed = base.partial();
      assert.equal((partialed as any).predicates, null);
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

    it('should create a deep partial', () => {
      const inner = z.object({ a: z.string(), b: z.object({ c: z.number(), d: z.number() }) });
      const schema = inner.partial({ deep: true });
      const ret = schema.parse({ b: { d: 32 } });
      assert.deepEqual(ret, { b: { d: 32 } });
    });

    it('should fail deep partial if unknown keys included in nested objects', () => {
      const schema = z.object({ a: z.string(), b: z.object({ c: z.number(), d: z.number() }) }).partial({ deep: true });
      const err = catchError(schema.parse.bind(schema))({ b: { d: 32, f: 'unknown' } });
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'error parsing object at path: "b" - unexpected keys on object: ["f"]');
    });

    it('should return a new ObjectType when "and" with other object schema', () => {
      const schema = z.object({}).and(z.object({}));
      assert.ok(schema instanceof ObjectType);
    });

    it('should return a new IntersectionType when "and" with non object schema', () => {
      const schema = z.object({}).and(z.array(z.string()));
      //@ts-ignore
      assert.ok(typeof schema.omit === 'undefined');
      //@ts-ignore
      assert.ok(typeof schema.pick === 'undefined');
      //@ts-ignore
      assert.ok(typeof schema.partial === 'undefined');
    });

    it('should return default value if parsing undefined', () => {
      const schema = z.object({ a: z.string(), b: z.string() }).default({ a: 'hello', b: 'world' });
      assert.deepEqual(schema.parse(undefined), { a: 'hello', b: 'world' });
    });

    it('should return default value if parsing undefined - func', () => {
      const schema = z.object({ a: z.string(), b: z.string() }).default(() => ({ a: 'hello', b: 'world' }));
      assert.deepEqual(schema.parse(undefined), { a: 'hello', b: 'world' });
    });

    it('should return nested defaults', () => {
      const schema = z.object({
        a: z.string().default('hello'),
        b: z.number().default(() => 42),
        c: z.boolean().default(true),
        d: z.null().default(null),
      });
      assert.deepEqual(schema.parse({}), { a: 'hello', b: 42, c: true, d: null });
    });

    it('should return nested defaults with default object', () => {
      const schema = z
        .object({
          a: z.string().default('hello'),
          b: z.number().default(() => 42),
          c: z.boolean().default(true),
          d: z.null().default(null),
        })
        .default({});
      assert.deepEqual(schema.parse(undefined), { a: 'hello', b: 42, c: true, d: null });
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
      assert.equal(err.message, 'error parsing object at path: "a" - expected type to be boolean but got string');
    });

    it('should give meaningful error messages for object records with nested errors', () => {
      const schema = z.record(z.object({ a: z.object({ b: z.boolean() }) }));
      const err = catchError(schema.parse.bind(schema))({ key: { a: { b: 'hello' } } });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "key.a.b" - expected type to be boolean but got string');
      assert.deepEqual((err as z.ValidationError).path, ['key', 'a', 'b']);
    });

    it('should fail if a key is present on object but value is undefined', () => {
      const schema = z.record(z.boolean());
      const err = catchError(schema.parse.bind(schema))({ a: undefined, b: false });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "a" - expected type to be boolean but got undefined');
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

    it('should convert inner date strings type', () => {
      const schema = z.record(z.date());
      const date = new Date();
      const ret = schema.parse({ a: date.toISOString() });
      assert.ok(ret.a instanceof Date);
      assert.equal(ret.a.getTime(), date.getTime());
    });

    it('the and of two records should return a ObjectType', () => {
      const r1 = z.record(z.object({ a: z.string() }));
      const r2 = z.record(z.object({ b: z.string() }));
      const schema = r1.and(r2);
      assert.ok(schema instanceof ObjectType);
      const shape: ObjectShape = (schema as any).objectShape;
      assert.deepEqual(Object.keys(shape), []);
      assert.ok(shape[z.keySignature] instanceof ObjectType);
    });

    it('should pick from a record', () => {
      const schema = z.record(z.string()).pick(['a', 'b']);
      const ret = schema.parse({ a: 'hello', b: 'world' });
      assert.deepEqual(ret, { a: 'hello', b: 'world' });
    });

    it('should fail if missing keys from picked records', () => {
      const schema = z.record(z.string()).pick(['a', 'b']);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "b" - expected type to be string but got undefined');
    });

    it('should fail if unknown keys in picked records', () => {
      const schema = z.record(z.string()).pick(['a', 'b']);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 'world', c: '!!!' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["c"]');
    });

    it('should pick from a dictionary', () => {
      const schema = z.dictionary(z.string()).pick(['a', 'b']);
      assert.deepEqual(schema.parse({ a: 'hello', b: 'world' }), { a: 'hello', b: 'world' });
      assert.deepEqual(schema.parse({}), {});
    });

    it('should fail if unknown keys in picked dictionaries', () => {
      const schema = z.record(z.string()).pick(['a', 'b']);
      const err = catchError(schema.parse.bind(schema))({ c: '!!!' });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'unexpected keys on object: ["c"]');
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

    it('should convert date strings', () => {
      const schema = z.array(z.date());
      const date = new Date();
      const ret = schema.parse([date.toISOString()]);
      assert.equal(ret.length, 1);
      assert.ok(ret[0] instanceof Date);
      assert.equal(ret[0].getTime(), date.getTime());
    });

    it('should fail if predicate is not respected', () => {
      const schema = z.array(z.number()).withPredicate(value => value[0] === 0, 'expected first element to be 0');
      assert.deepEqual(schema.parse([0, 1]), [0, 1]);
      const err = catchError(schema.parse.bind(schema))([1, 2]);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected first element to be 0');
    });

    it('should return default value when parsing undefined', () => {
      const schema = z.array(z.number()).default([1, 2, 3]);
      assert.deepEqual(schema.parse(undefined), [1, 2, 3]);
    });

    it('should return default value when parsing undefined - func', () => {
      const schema = z.array(z.number()).default(() => [1, 2, 3]);
      assert.deepEqual(schema.parse(undefined), [1, 2, 3]);
    });

    it('should be possible to fail predicate with default value', () => {
      const schema = z.array(z.number()).length(2).default([]);
      const err = catchError(schema.parse.bind(schema))(undefined);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected array to have length 2 but got 0');
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

    it('should coerce parent object if element is a union of a coerced type', () => {
      const schema = z.object({
        name: z.string(),
        birthday: z.tuple([z.number(), z.number(), z.number()]).or(z.date()),
      });

      const data = { name: 'David', birthday: [1991, 7, 22] };
      const ret = schema.parse(data);
      assert.notEqual(ret, data);
      assert.deepEqual(ret, data);

      const ret2 = schema.parse({ name: 'David', birthday: '1991-07-22' });
      assert.equal(ret2.name, 'David');
      assert.ok(ret2.birthday instanceof Date);
      assert.equal((ret2.birthday as Date).getTime(), new Date('1991-07-22').getTime());
    });

    it('should use deafult value when parsing undefined', () => {
      const schema = z.string().or(z.number()).default('hello');
      assert.equal(schema.parse(undefined), 'hello');
    });

    it('should use deafult value when parsing undefined - func', () => {
      const schema = z
        .string()
        .or(z.number())
        .default(() => 42);
      assert.equal(schema.parse(undefined), 42);
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
      assert.equal(err.message, 'unexpected keys on object: ["c","d"]');
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
      assert.equal(err.message, 'error parsing object at path: "key.b" - expected type to be string but got undefined');
    });

    it('should fail if the value contains object keys not in Record<object> intersection', () => {
      const recordA = z.record(z.object({ a: z.number() }));
      const recordB = z.record(z.object({ b: z.string() }));
      const schema = z.intersection(recordA, recordB);
      const err = catchError(schema.parse.bind(schema))({ key: { a: 2, b: 'string', c: true } });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "key" - unexpected keys on object: ["c"]');
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
      assert.equal(err.message, 'error parsing object at path: "a" - expected type to be string but got number');
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
      assert.equal(err.message, 'unexpected keys on object: ["c"]');
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
      assert.equal(err.message, 'unexpected keys on object: ["c"]');
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
      assert.equal(err.message, 'unexpected keys on object: ["c"]');
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
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });

    it('should fail if missing key in intersect of pick and some other complex type', () => {
      const schema = z
        .pick(z.object({ a: z.string(), b: z.string() }), ['a'])
        .and(z.object({ c: z.number() }).and(z.object({ d: z.boolean() })));
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', d: true });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "c" - expected type to be number but got undefined');
    });

    it('should intersect two tuples', () => {
      const t1 = z.tuple([z.string(), z.number()]);
      const t2 = z.tuple([z.string()]);
      const schema = t1.and(t2);
      const ret = schema.parse(['hello', 42]);
      assert.deepEqual(ret, ['hello', 42]);
    });

    it('should fail if intersect of two tuples is not satisfied', () => {
      const t1 = z.tuple([z.string(), z.number()]);
      const t2 = z.tuple([z.string()]);
      const schema = t1.and(t2);
      const err = catchError(schema.parse.bind(schema))(['hello']);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected tuple length to be 2 but got 1');
    });

    it('should fail if intersect of two tuples is not satisfied - typeError', () => {
      const t1 = z.tuple([z.string(), z.number()]);
      const t2 = z.tuple([z.string()]);
      const schema = t1.and(t2);
      const err = catchError(schema.parse.bind(schema))(['hello', 'world']);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'error parsing tuple at index 1: expected type to be number but got string');
    });

    it('should convert date strings', () => {
      const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.object({ c: z.date() }) }));
      const date = new Date();
      const ret = schema.parse({ a: 'hello', b: { c: date.toISOString() } });
      assert.ok(ret.b.c instanceof Date);
      assert.equal(ret.b.c.getTime(), date.getTime());
    });

    it('should intersect recursive types', () => {
      type Person = {
        name: string;
        friends: Person[];
      };

      type Category = {
        name: string;
        subCategories: Category[];
      };

      const personSchema: z.Type<Person> = z.object({
        name: z.string(),
        friends: z.array(z.lazy(() => personSchema)),
      });

      const categorySchema: z.Type<Category> = z.object({
        name: z.string(),
        subCategories: z.array(z.lazy(() => categorySchema)),
      });

      const schema = personSchema.and(categorySchema);

      const ret = schema.parse({
        name: 'David',
        friends: [
          { name: 'Alex', friends: [] },
          { name: 'Joshua', friends: [] },
        ],
        subCategories: [],
      });

      assert.deepEqual(ret, {
        name: 'David',
        friends: [
          { name: 'Alex', friends: [] },
          { name: 'Joshua', friends: [] },
        ],
        subCategories: [],
      });
    });

    it('should intersect two object arrays', () => {
      const schema = z.array(z.object({ a: z.string() })).and(z.array(z.object({ b: z.string() })));
      const ret = schema.parse([
        { a: 'hello', b: 'world' },
        { a: 'number', b: '42' },
      ]);
      assert.deepEqual(ret, [
        { a: 'hello', b: 'world' },
        { a: 'number', b: '42' },
      ]);
    });

    it('should fail if key is missing from intersect two object arrays', () => {
      const schema = z.array(z.object({ a: z.string() })).and(z.array(z.object({ b: z.string() })));
      const err = catchError(schema.parse.bind(schema))([{ a: 'hello', b: 'world' }, { a: 'number' }]);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'error at [1].b - expected type to be string but got undefined');
    });

    it('should fail if unknown key in intersect two object arrays', () => {
      const schema = z.array(z.object({ a: z.string() })).and(z.array(z.object({ b: z.string() })));
      const err = catchError(schema.parse.bind(schema))([
        { a: 'hello', b: 'world' },
        { a: 'number', b: '42', c: 'hammock' },
      ]);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'error at [1] - unexpected keys on object: ["c"]');
    });

    it('and of two arrays should return an array type', () => {
      const schema = z.array(z.object({ a: z.string() })).and(z.array(z.object({ b: z.string() })));
      assert.equal(typeof schema.unique, 'function');
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

    it('should return default value when parsing undefined', () => {
      const defaultedSchema = schema.default(Colors.green);
      assert.equal(defaultedSchema.parse(undefined), Colors.green);
    });

    it('should return default value when parsing undefined - func', () => {
      const defaultedSchema = schema.default(() => Colors.green);
      assert.equal(defaultedSchema.parse(undefined), Colors.green);
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
        'error parsing object at path: "a" - expected string to match pattern /hello/ but did not'
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
      assert.equal(err.message, 'unexpected keys on object: ["d"]');
    });

    it('should make the values of a record optional', () => {
      const schema = z.partial(z.record(z.number()));
      const ret = schema.parse({ a: 3, b: undefined });
      assert.deepEqual(ret, { a: 3, b: undefined });
    });

    it('should create a deep partial', () => {
      const innerSchema = z.object({ a: z.string(), b: z.object({ c: z.number(), d: z.number() }) });
      const schema = z.partial(innerSchema, { deep: true });
      const ret = schema.parse({ b: { d: 32 } });
      assert.deepEqual(ret, { b: { d: 32 } });
    });

    it('should fail deep partial if unknown keys included in nested objects', () => {
      const innerSchema = z.object({ a: z.string(), b: z.object({ c: z.number(), d: z.number() }) });
      const schema = z.partial(innerSchema, { deep: true });
      const err = catchError(schema.parse.bind(schema))({ b: { d: 32, f: 'unknown' } });
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'error parsing object at path: "b" - unexpected keys on object: ["f"]');
    });

    it('should pass with empty object for object unions partial', () => {
      const schema = z.partial(z.object({ a: z.number() }).or(z.object({ b: z.string() })));
      assert.deepEqual(schema.parse({}), {});
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
      assert.equal(err.message, 'error parsing object at path: "b" - expected type to be number but got undefined');
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

    it('should pick the intersection of a record and an object correctly', () => {
      const schema = z.pick(z.object({ a: z.string(), b: z.number() }).and(z.record(z.boolean())), ['a', 'c']);
      const ret = schema.parse({ a: 'hello', c: true });
      assert.deepEqual(ret, { a: 'hello', c: true });
    });

    it('should fail if missing key from pick the intersection of a record and an object', () => {
      const schema = z.pick(z.object({ a: z.string(), b: z.number() }).and(z.record(z.boolean())), ['a', 'c']);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello' });
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'error parsing object at path: "c" - expected type to be boolean but got undefined');
    });

    it('should fail if missing key from pick the intersection of a record and an object - Inverted LR', () => {
      const schema = z.pick(z.record(z.boolean()).and(z.object({ a: z.string(), b: z.number() })), ['a', 'c']);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello' });
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'error parsing object at path: "c" - expected type to be boolean but got undefined');
    });

    it('should fail if unknown key from pick the intersection of a record and an object', () => {
      const schema = z.pick(z.object({ a: z.string(), b: z.number() }).and(z.record(z.boolean())), ['a', 'c']);
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: 42, c: true });
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'unexpected keys on object: ["b"]');
    });
  });

  describe('omit parsing', () => {
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

    it('should pass if omitted key is not present in record of object intersection', () => {
      const record = z.record(z.string());
      const obj = z.object({ b: z.number() });
      const intersec = record.and(obj);
      const schema = z.omit(intersec, ['b']);
      const ret = schema.parse({ a: 'hello' });
      assert.deepEqual(ret, { a: 'hello' });
    });

    it('should default to keysignature', () => {
      const schema = z.omit(z.record(z.string()).and(z.object({ b: z.number() })), ['b']);
      const err = catchError(schema.parse.bind(schema))({ b: 123 });
      assert.equal(err instanceof z.ValidationError, true);
      assert.equal(err.message, 'error parsing object at path: "b" - expected type to be string but got number');
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
      assert.equal(err.message, 'unexpected keys on object: ["b","c"]');
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
      assert.equal(err.message, 'unexpected keys on object: ["a","b"]');
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

    it('should fail if tuple does not respect predicate function', () => {
      const schema = z
        .tuple([z.number(), z.string()])
        .withPredicate(value => value[0] === value[1].length, 'expected number to indicate length of string');

      assert.deepEqual(schema.parse([5, 'hello']), [5, 'hello']);
      const err = catchError(schema.parse.bind(schema))([2, 'world']);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected number to indicate length of string');
    });

    it('should return default value when parsing undefined', () => {
      const schema = z.tuple([z.number(), z.string()]).default([42, 'hello world']);
      assert.deepEqual(schema.parse(undefined), [42, 'hello world']);
    });

    it('should return default value when parsing undefined - func', () => {
      const schema = z.tuple([z.number(), z.string()]).default(() => [42, 'hello world']);
      assert.deepEqual(schema.parse(undefined), [42, 'hello world']);
    });
  });

  describe('lazy parsing', () => {
    it('should parse a schema without recursion', () => {
      const schema = z.lazy(() => z.string());
      assert.equal(schema.parse('hello'), 'hello');
    });

    it('should parse a schema recursively', () => {
      type Schema = {
        a: string;
        b?: Schema;
      };
      const schema: z.Type<Schema> = z.object({
        a: z.string(),
        b: z.lazy(() => schema).optional(),
      });
      const ret = schema.parse({ a: 'hello', b: { a: 'world' } });
      assert.deepEqual(ret, { a: 'hello', b: { a: 'world', b: undefined } });
    });

    it('should fail when value does not match', () => {
      type Schema = {
        a: string;
        b?: Schema;
      };
      const schema: z.Type<Schema> = z.object({
        a: z.string(),
        b: z.lazy(() => schema).optional(),
      });
      const err = catchError(schema.parse.bind(schema))({ a: 'hello', b: { a: 'world', b: { a: 42 } } });
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'error parsing object at path: "b.b.a" - expected type to be string but got number');
    });

    it('should work with arrays', () => {
      type Category = {
        name: string;
        subCategories: Category[];
      };
      const schema: z.Type<Category> = z.object({
        name: z.string(),
        subCategories: z.array(z.lazy(() => schema)),
      });
      const ret = schema.parse({ name: 'horror', subCategories: [{ name: 'gore', subCategories: [] }] });
      assert.deepEqual(ret, { name: 'horror', subCategories: [{ name: 'gore', subCategories: [] }] });
    });

    it('should fail with appropriate error message', () => {
      type Category = {
        name: string;
        subCategories: Category[];
      };
      const schema: z.Type<Category> = z.object({
        name: z.string(),
        subCategories: z.array(z.lazy(() => schema)),
      });
      const err = catchError(schema.parse.bind(schema))({
        name: 'Horror',
        subCategories: [{ name: 'Gore', subCategories: [{ name: 'super gore', subCategories: null }] }],
      });
      assert.ok(err instanceof z.ValidationError);
      assert.equal(
        err.message,
        'error parsing object at path: "subCategories[0].subCategories[0].subCategories" - expected an array but got null'
      );
    });

    it('should coerce values', () => {
      type Person = {
        name: string;
        birthday: Date;
        friends: Person[];
      };

      const schema: z.Type<Person> = z.object({
        name: z.string(),
        birthday: z.date(),
        friends: z.array(z.lazy(() => schema)),
      });

      const date = new Date();

      const ret = schema.parse({
        name: 'David',
        birthday: date.toISOString(),
        friends: [{ name: 'quentin', birthday: date.toISOString(), friends: [] }],
      });

      assert.ok(ret.birthday instanceof Date);
      assert.ok(ret.friends[0].birthday instanceof Date);
    });
  });

  describe('bigint parsing', () => {
    it('should parse a string to a bigint', () => {
      const schema = z.bigint();
      assert.equal(schema.parse('5'), BigInt(5));
    });

    it('should parse an integer number to a bigint', () => {
      const schema = z.bigint();
      assert.equal(schema.parse(5), BigInt(5));
    });

    it('should parse a bigint', () => {
      const schema = z.bigint();
      assert.equal(schema.parse(BigInt(5)), BigInt(5));
    });

    it('should fail to parse a not integer number to a bigint', () => {
      const schema = z.bigint();
      const err = catchError(schema.parse.bind(schema))(5.23);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(
        err.message,
        'expected type to be bigint interpretable - the number 5.23 cannot be converted to a bigint because it is not an integer'
      );
    });

    it('should throw if value is less than min', () => {
      const schema = z.bigint().min(5);
      const err = catchError(schema.parse.bind(schema))(3);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected bigint to be greater than or equal to 5 but got 3');
    });

    it('should throw if value is greater than max', () => {
      const schema = z.bigint().max(BigInt(5));
      const err = catchError(schema.parse.bind(schema))(8);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected bigint to be less than or equal to 5 but got 8');
    });

    it('should force parse to return a new coerced object when bigint is inside object schema', () => {
      const personSchema = z.object({ name: z.string(), age: z.bigint() });
      const data = { name: 'Joe', age: 32 };
      const person = personSchema.parse(data);
      assert.notEqual(person, data);
      assert.deepEqual(person, { name: 'Joe', age: BigInt(32) });
    });

    it('should fail if predicate is not satisfied', () => {
      const schema = z.bigint().withPredicate(int => int % BigInt(2) === BigInt(0), 'expected bigint to be even');
      const err = catchError(schema.parse.bind(schema))(1);
      assert.ok(err instanceof z.ValidationError);
      assert.equal(err.message, 'expected bigint to be even');
    });

    it('should use default value when parsing undefined', () => {
      const schema = z.bigint().default(BigInt(4));
      assert.equal(schema.parse(undefined), BigInt(4));
    });
  });
});

describe('Type.try', () => {
  it('should return a value', () => {
    const date = new Date();
    const schema = z.object({ name: z.string(), birthday: z.date() });
    const value = schema.try({ name: 'Bilbo', birthday: date.toISOString() });
    if (value instanceof Error) {
      throw new Error('expected value not error');
    }
    assert.deepEqual(Object.keys(value), ['name', 'birthday']);
    assert.equal(value.name, 'Bilbo');
    assert.ok(value.birthday instanceof Date);
    assert.equal(value.birthday.getTime(), date.getTime());
  });

  it('should return an error if failed', () => {
    const schema = z.object({ name: z.string(), age: z.number().min(18) });
    const error = schema.try({ name: 'Bobby Joe', age: 12 });
    if (!(error instanceof Error)) {
      throw new Error('expected an error as a return value');
    }
    assert.ok(error instanceof z.ValidationError);
    assert.equal(
      error.message,
      'error parsing object at path: "age" - expected number to be greater than or equal to 18 but got 12'
    );
  });
});
