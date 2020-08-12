# myzod

Schema Validation with typescript type inference.

### Acknowledgements

Major Shout-out to [zod](https://www.npmjs.com/package/zod) for the inspiration.

### Description

Myzod tries to emulate the typescript type system as much as possible and is even in some ways a little stricter. The goal is that writing a schema feels the same as defining a typescript type, with equivalent & and | operators, and well known Generic types like Record, Pick and Omit. On top of that myzod aims to offer validation within the schemas for such things as number ranges, string patterns and lengths to help enforce business logic.

The resulting package has a similar api to `zod` with a little bit of inspiration from [joi](https://www.npmjs.com/package/@hapi/joi).

The goal is to write schemas from which the _type_ of a successfully parsed value can be inferred. With myzod typescript types and validation logic no longer need to be maintained separately.

### Performance

When parsing equivalent simple object (with nesting) schemas for myzod, zod and joi, on my machine Linux Ubuntu 18.04 running NodeJS 13.X, the results are as such:

objects parsed per second:

- `zod`: 51861
- `joi`: 194325
- `myzod`: 1288659

myzod vs zod: ~25 X Speedup

myzod vs joi: ~6 X Speedup

### Installation

```
npm install --save myzod
```

### Usage

Myzod is used by creating a schema, extracting the type by inferring it, and finally by parsing javascript values.

```typescript
import myzod, { Infer } from 'myzod';

const personSchema = myzod.object({
  id: myzod.number(),
  name: myzod.string().pattern(/^[A-Z]/),
  age: myzod.number().min(0),
  birthdate: myzod.number().or(myzod.string()),
  employed: myzod.boolean(),
  friendIds: myzod.array(myzod.number()).nullable()
});

type Person = Infer<typeof personSchema>;

const person: Person = personSchema.parse({ ... });
```

### Api Reference

Type Root

- [Type<T>](#type)
  - [parse](#type.parse)
  - [try](#type.try)
  - [and](#type.and)
  - [or](#type.or)
  - [optional](#type.optional)
  - [nullable](#type.nullable)

Primitive Types

- [string](#string)
- [number](#number)
- [bigint](#bigint)
- [boolean](#boolean)
- [undefined](#undefined)
- [null](#null)
- [literal](#literal)
- [unknown](#unknown)

Reference Types

- [object](#object)
  - [pick/omit/partial](#object.pick/omit/partial)
- [record](#record)
- [array](#array)
- [tuple](#tuple)
- [enum](#enum)
- [date](#date)

Logical Types

- [union](#union)
- [intersection](#intersection)
- [partial](#partial)
- [pick](#pick)
- [omit](#omit)

Recursive Schemas

- [lazy](#lazy)

### Type.

All myzod schemas extend the generic myzod.Type class, and as such inherit these methods:

#### Type.parse

Takes an unknown value, and returns it typed if passed validation. Otherwise throws a myzod.ValidationError

```typescript
parse(value: unknown): T
```

#### Type.try

Takes an unknown value and returns a result which will either be the parsed value or an instance of ValidationError.
This api is useful if you do not want to throw exceptions.

```typescript
const result = schema.try(data);
if (result instanceof myzod.ValidationError) {
  // handle Error
} else {
  // result is of type: myzod.Infer<typeof schema>
}
```

##### Type.and

Shorthand for creating intersection types of two schemas.

```typescript
const nameSchema = myzod.object({ name: myzod.string() });
const ageSchema = myzod.object({ age: myzod.number() });

const personSchema = nameSchema.and(ageSchema); // Same as ageSchema.and(nameSchema);

type Person = Infer<typeof personSchema>; // => { name: string; age: number; }
```

##### Type.or

Shorthand for creating union types of two schemas.

```typescript
const stringOrBoolSchema = myzod.string().or(myzod.boolean());

type StringOrUndefined = Infer<typeof stringOrBoolSchema>; // => string | boolean
```

##### Type.optional

Returns a new schema which is a wrapped OptionalType of the current schema.

```typescript
const optionalStringSchema = myzod.string().optional(); // => OptionalType<StringType>

type StringOrUndefined = Infer<typeof optionalStringSchema>; // => string | undefined
```

##### Type.nullable

Returns a new schema which is a wrapped NullableType of the current schema.

```typescript
const nullableStringSchema = myzod.string().nullable(); // => NullableType<StringType>

type StringOrUndefined = Infer<typeof nullableStringSchema>; // => string | null
```

#### String

options:

- min `number` - min length of string
- max `number` - max length of string
- pattern `RegExp` - regular expression string must match
- valid `string[]` - list of valid stings
- predicate `Predicate<string>` - custom predicates to apply to string value

methods:

- `min(value: number, errMsg?: string) => StringType`  
   returns a new string schema where minimum string lenth is min
- `max(value: number, errMsg?: string) => StringType`  
   returns a new string schema where maximum string length is max
- `pattern(value: RegExp, errMsg?: string) => StringType`  
   returns a new string schema where string must match pattern
- `valid(list: string[], errMsg?: string) => StringType`  
   returns a new string schema where string must be included in valid string array
- `withPredicate(fn: (val: string) => boolean), errMsg?: string }`  
   returns a new schema where string must pass predicate function(s).
- `default(value: string | (() => string)) => StringType`  
   returns a new schema which will use defaultValue when parsing undefined

options can be passed as an option object or chained from schema.

```typescript
myzod.string({ min: 3, max: 10, pattern: /^hey/ });
// same as
myzod.string().min(3).max(10).pattern(/^hey/);
```

The valid options lets you validate against a set of strings.

```typescript
const helloworld = myzod.string().valid(['hello', 'world']);
typeof HelloWorld = myzod.Infer<typeof helloworld>; // => string
```

if however you want the stings to be typed used the [literals](#literals) helper function:

```typescript
const helloworld = myzod.literals('hello', 'world');
type HelloWorld = myzod.Infer<typeof helloworld>; // => 'hello' | 'world'
```

Myzod is not interested in reimplementing all possible string validations, ie isUUID, isEmail, isAlphaNumeric, etc. The myzod string validation can be easily extended via the withPredicate API.

```typescript
const uuidSchema = myzod.string().withPredicate(validator.isUUID, 'expected string to be uuid');

type UUID = Infer<typeof uuidSchema>; // => string

uuidSchema.parse('hello world'); // Throws ValidationError with message 'expected string to be uuid'
// note that if predicate function throws an error that message will be used instead
```

Note that you can register multiple predicates, and that each invocation will create a new schema:

```typescript
const greeting = myzod.string().withPredicate(value => value.startsWith('hello'), 'string must start with hello');
const evenGreeting = greeting.withPredicate(value => value.length % 2 === 0, 'string must have even length');
const oddGreeting = greeting.withPredicate(value => value.length % 2 === 1, 'string must have odd length');
```

You can use default values or functions to create default values for myzod string schemas.

```typescript
const uuidSchema = z.string().default(() => uuidv4());
const val = uuidSchema.parse(undefined); // val is a valid uuid constructed by uuidv4()
uuid.parse(null); // throws an error
```

#### Number

options:

- min: `number` - min value for number
- max: `number` - max value for number
- coerce: `boolean` - when true will attempt to coerce strings to numbers. default `false`

methods:

- `min(value: number, errMsg?: string) => NumberType`  
  returns a new number schema where number must be greater than or equal to min value
- `max(value: number, errMsg?: string) => NumberType`  
   returns a new number schema where number must be less than or equal to max value
- `withPredicate(fn: (value: number) => boolean, errMsg?: string) => NumberType`  
  returns a new number schema where number must satisfy predicate function
- `coerce(flag?: boolean) => NumberType`  
  returns a new number schema which depending on the flag will coerce strings to numbers
- `default(value: number | (() => number)) => NumberType`  
   returns a new number schema which will use value as default when parsing undefined

options can be passed as an option object or chained from schema.

```typescript
myzod.number({ min: 0, max: 10 });
// Same as:
myzod.number().min(0).max(10);
```

Coercion example:

```typescript
const schema = myzod.number().coerce(); // same as myzod.number({ coerce: true });

const value = schema.parse('42');

assert.ok(typeof value === 'number'); // succeeds
assert.equal(value, 42); // succeeds
```

#### BigInt

options:

- min: `number` - min value for number
- max: `number` - max value for number

methods:

- `min(value: number | bigint) => BigIntType`  
   returns a new bigint schema where value must be at least min
- `max(value: number | bigint) => BigIntType`  
   returns a new bigint schema where value must be lesser or equal to max
- `withPredicate(fn: (value: bigint) => boolean, errMsg?: string) => BigIntType`  
   returns a new bigint schema where value must pass predicate function

options can be passed as an option object or chained from schema.

```typescript
myzod.bigint({ min: 0, max: 10 });
// Same as:
myzod.bigint().min(0).max(10);

const integer = myzod.bigint();
type Integer = myzod.Infer<typeof integer>; // => bigint
```

The bigint schema automatically coerces bigint interpretable numbers and strings into bigint values.

```typescript
const schema = myzod.bigint();
const value = schema.parse('42');

assert.ok(typeof value === 'bigint'); // succeeds
assert.equal(value, 42n); // succeeds
```

#### Boolean

methods:

- `default(value: boolean | (() => boolean)) => BooleanType`  
   returns a new boolean schema instance which will use value as default when parsing undefined

```typescript
myzod.boolean();
```

#### Undefined

```typescript
myzod.undefined();
```

#### Null

methods:

- `default() => NullType`  
   returns a new null schema instance which will use set null as default when parsing undefined

```typescript
myzod.null();
```

#### Literal

methods:

- `default() => LiteralType`  
   returns a new literal schema instance which will use its literal as default when parsing undefined

Just as in typescript we can type things using literals

```typescript
const schema = myzod.literal('Value');
type Val = Infer<typeof schema>; // => 'Value'
```

Sometimes we do not want to go all out and create an enum to represent a combination of literals.
Myzod offers a utility function to avoid have to "or" multiple times over many literalTypes.

##### Literals

```typescript
const schema = myzod.literals('red', 'green', 'blue');
type Schema = myzod.Infer<typeof schema>; // => 'red' | 'green' | 'blue'

// Other equivalent ways of creating the same schema:
const schema = myzod.literal('red').or(myzod.literal('green')).or(myzod.literal('blue'));
const schema = myzod.union([myzod.literal('red'), myzod.literal('green'), myzod.literal('blue')]);
```

#### Unknown

methods:

- `default(value: any | (() => any)) => UnknownType`  
   returns a new unknown schema instance which will use value as default when parsing undefined

```typescript
myzod.unknown();
```

The unknown schema does nothing when parsing by itself. However it is useful to require a key to be present inside an object schema when we don't know or don't care about the type.

```typescript
const schema = myzod.object({ unknownYetRequiredField: myzod.unknown() });
type Schema = Infer<typeof schema>; // => { unknownYetRequiredField: unknown }

schema.parse({}); // throws a ValidationError
schema.parse({ unknownYetRequiredField: 'hello' }); // succeeds
```

#### Object

options:

- allowUnknown: `boolean` - allows for object with keys not specified in expected shape to succeed parsing, default `false`
- suppressErrPathMsg: `boolean` - suppress the path to the invalid key in thrown validationErrors. This option should stay false for most cases but is used internally to generate appropriate messages when validating nested objects. default `false`

myzod.object is the way to construct arbitrary object schemas.

```typescript
function object(shape: { [key: string]: Type<T> }, opts?: options);
```

examples:

```typescript
const strictEmptyObjSchema = myzod.object({});
const emptyObjSchema = myzod.object({}, { allowUnknown: true });

// Both Schemas infer the same type
type Empty = Infer<typeof emptyObjSchema>; // => {}
type StrictEmpty = Infer<typeof strictEmptyObjSchema>; // => {}

emptyObjSchema.parse({ key: 'value' }); // => succeeds
strictEmptyObjSchema.parse({ key: 'value' }); // => throws ValidationError because not expected key: "key"

const personSchema = myzod.object({
  name: myzod.string(),
});
const shape = personSchema.shape(); // => returns { name: myzod.string() }
```

#### object.withPredicate

You can add predicate functions to object schemas. Note that these predicate functions will not be kept around for schemas produces from object.pick/omit/partial as they predicate function signatures need to change for those signatures.

```typescript
const registrationSchema = myzod
  .object({
    email: z.string().withPredicate(validator.isEmail, 'expected email'),
    password: z.string().min(8),
    confirmedPassword: z.string(),
  })
  .withPredicate(value => value.password === value.confirmedPassword, 'password and confirmed do not match');
```

#### object.shape

You can extract the shape from an ObjectType.

```typescript
const personSchema = myzod.object({
  name: myzod.string(),
});
const shape = personSchema.shape(); // => returns { name: myzod.string() }
```

#### object.pick/omit/partial

The Object type has utility methods pick, omit, and partial for creating new ObjectType schemas based on the current instance. Note once more that predicates do not carry over from base schema.

```typescript
const profileSchema = myzod.object({
  id: myzod.string().predicate(validator.isUUID),
  name: myzod.string().pattern(/[A-Z]\w+/)
  age: myzod.number().min(0),
});

type Profile = myzod.Infer<typeof profileSchema>; // => { id: string; name: string; age: number }

const putProfileSchema = profileSchema.pick(['name','age']); // Same as profileSchema.omit(['id']);

type PutProfile = myzod.Infer<typeof putProfileSchema>; // => { name: string; age: number }

const patchProfileSchema = putProfileSchema.partial();

type PatchProfile = myzod.Infer<typeof patchProfileSchema>; // => { name?: string; age?: number }

```

Partial accepts an options object to allow for deeply nested partials:

```typescript
const schema = myzod
  .object({
    name: myzod.string(),
    birthday: myzod.object({
      year: myzod.number(),
      month: myzod.number().min(1).max(12),
      date: myzod.number().min(1).max(31),
    }),
  })
  .partial({ deep: true });

type DeeplyPartialSchema = myzod.Infer<typeof schema>; // { name?: string; birthday?: { year?: number; month?: number; date?: number; } }
```

#### object.default

With the default function you can set a default value for the object schema which will be used when trying to parse undefined:

```typescript
const personSchema = myzod
  .object({ name: myzod.string(), lastName: myzod.string() })
  .default({ name: 'John', lastName: 'Doe' });

const person = personSchema.parse(undefined); // => { name: 'John', lastName: 'Doe' }
```

##### Key Signatures

In the next section myzod goes over "records" which is the simple and idiomatic way in typescript of describing an object with solely a key signature.
However you can use key signatures directly in your object schema definitions if you like using the myzod.keySignature symbol.

```typescript
const scores = myzod.object({ [myzod.keySignature]: myzod.number() }); // same as: myzod.record(myzod.number());

type Scores = myzod.Infer<typeof scores>; // => { [x: string]: number }
```

The advantage of this approach is to mix statically known keys with a keysignature without intersecting records and objects.

#### Record

The record function emulates as the equivalent typescript type: `Record<string, T>`.

```typescript
const schema = myzod.record(myzod.string());

type Schema = Infer<typeof schema>; // => { [x: string] : string }
```

One primary use case of the record type is for creating schemas for objects with unknown keys that you want to have typed. This would be the equivalent of passing a pattern to joi. The way this is done in myzod is to intersect a recordSchema with a object schema.

```typescript
const objSchema = myzod.object({
  a: myzod.string(),
  b: myzod.boolean(),
  c: myzod.number(),
});

const recordSchema = myzod.record(zod.number());

const schema = objSchema.and(recordSchema);

type Schema = Infer<typeof schema>;

// Here Schema is the same as the following type definition:
type Schema = {
  a: string;
  b: boolean;
  c: number;
  [key: string]: number;
};
```

As a utility you can pick directly from a recordSchema and get an equivalent objectSchema:

```typescript
const recordSchema = z.record(z.string());

type RecordType = z.Infer<typeof recordSchema>; // => { [x: string]: string }

const objSchema = recordSchema.pick(['a', 'b']);

type ObjType = z.Infer<typeof objSchema>; // => { a: string; b: string; }
```

As a utility for creating records whose values are by default optional, you can use the myzod.dictionary function.

```typescript
const schema = myzod.dictionary(myzod.string());
// same as
const schema = myzod.record(myzod.string().optional());

type Schema = Infer<typeof schema>; // => { [key: string]: string | undefined }

// Note I have experienced issues with vscode type hints omitting the undefined union
// however when running tsc it evaluates Schema as the type above.
```

#### Array

options:

- length: `number` - the expected length of the array
- min: `number` - the minimum length of the array
- max: `number` - the maximum length of the array
- unique: `boolean` - should the array be unique. default `false`
- coerce: `(value: string) => T[]` - function to coerce string representations to an array

methods:

- `length(value: number, errMsg?: string) => ArrayType<T>`  
  returns a new array schema of the same type where the length of the array must be value
- `min(value: number, errMsg?: string) => ArrayType<T>`  
  returns a new array schema of the same type where the minimum length is value
- `max(value: number, errMsg?: string) => ArrayType<T>`  
  returns a new array schema of the same type where the maximum length is value
- `unique() => ArrayType<T>`  
  returns a new array schema of the same type where every element must be unique
- `withPredicate(fn: (value: T[]) => boolean, errMsg?: string) => ArrayType<T>`  
  returns a new array schema that must respect predicate function
- `default(value: T[] | (() => T[])) => ArrayType<T>`  
   returns a new array schema that will use value as default when parsing undefined
- `coerce(fn: (value: string) => T[]) => ArrayType<T>`  
   returns a new array schema that will coerce string representations using given function

Signature:

```typescript
function array(schema: Type<T>, opts?: Options);
```

Example:

```typescript
const schema = myzod.array(myzod.number()).unique();

type Schema = Infer<typeof schema>; // => string[]

schema.parse([1, 1, 2]); // => throws ValidationError
```

Myzod allows for string representations to be coerced to the array of your type via a coercion function. A common example is when parsing csv values.

```typescript
const schema = myzod.array(myzod.string()).coerce((csv: string) => csv.split(','));
const result = schema.try('red,blue,green');

// result === ['red', 'blue', 'green'];
```

#### Tuple

methods:

- `withPredicate(fn: (value: Infer<TupleType<T>>) => boolean, errMsg?: string) => TupleType<T>`  
  returns a new tuple type that must respect predicate function
- `default(value: InferTupleType<T>) => TupleType<T>`  
   returns a new tuple type schema that will use value as default when parsing undefined

Tuples are similar to arrays but allow for mixed types of static length.
Note that myzod does not support intersections of tuple types at this time.

```typescript
const schema = myzod.tuple([myzod.string(), myzod.object({ key: myzod.boolean() }), myzod.array(myzod.number())]);

type Schema = Infer<typeof schema>; // => [string, { key: boolean; }, number[]];
```

#### Enum

methods:

- `default(value: Enum | (() => Enum)) => EnumType`  
   returns a new enum schema instance which will use value as default when parsing undefined

The enum implementation differs greatly from the original zod implementation.
In zod you would create an enum schema by passing an array of litteral schemas.
I, however, did not like this since enums are literals they must by typed out in the source code regardless, and I prefer to use actual typescript `enum` values.

The cost of this approach is that I cannot statically check that you are passing an enum type to the zod.enum function. If you pass another value it won't make sense within the type system. Users beware.

```typescript
enum Color {
  red = 'red',
  blue = 'blue',
  green = 'green',
}

const colorSchema = zod.enum(Color);

Infer<typeof colorSchema> // => Color -- Redundant

const color = colorSchema.parse('red');
```

The enum schema provides a check method as a typeguard for enums.

```typescript
const value: string = 'some string variable';
if (colorSchema.check(value)) {
  // value's type is Color within this if block
}
```

The enum type also accepts an options object as a second parameter.

You can set `coerce` to `'lower'` or `'upper'` to ignore string casing when calling `check` or `parse`.

```typescript
z.enum(Colors, { coerce: 'lower' });
const value: string = 'Red';
colorSchema.parse(value);
// parse will return a lowercased value
```

You can also set a default value in the options object.

```typescript
z.enum(Colors, { defaultValue: 'red' });
```

#### Date

methods:

- `withPredicate(fn: (value: Date) => boolean, errMsg?: string) => DateType`  
   returns a new date schema where value must pass predicate function(s)
- `default(value: Date | (() => Date)) => DateType`  
   returns a new date schema which will use value as default when parsing undefined

the myzod.date function creates a date schema. Values that will be successfully parsed by this schema are
Javascript Date instances and valid string representations of dates. The returned parse Date will be an instance of Date.

```typescript
const schema = myzod.date();
type Schema = myzod.Infer<typeof schema>; // => Date

const date = new Date();
schema.parse(date); // returns date
schema.parse(date.toISOString()); // returns a date instance equal to date

// WithPredicate example
const weekDay = myzod
  .date()
  .withPredicate(date => date.getUTCDate() !== 6 && date.getUTCDate() !== 0, 'expected weekday');
```

#### Union

The myzod.union function accepts an arbitrary number of schemas and creates a union of their inferred types.

```typescript
const schema = myzod.union([myzod.string(), myzod.array(myzod.string()), myzod.number()]);

type Schema = Infer<typeof schema>; // => string | string[] | number
```

#### Intersection

The myzod.intersection takes two schemas as arguments and creates an intersection between their types.

```typescript
const a = myzod.object({ a: myzod.string() });
const b = myzod.object({ b: myzod.string() });

const schema = myzod.intersection(a, b);
// same as
const schema = a.and(b);
// or
const schema = b.and(a);

type Schema = Infer<typeof schema>; // => { a: string; b: string }
```

#### Partial

The myzod.partial function takes a schema and generates a new schema equivalent to typescript's Partial<T> type for that schema.

```typescript
const personSchema = myzod.object({ name: myzod.string() });
const partialPersonSchema = myzod.partial(personSchema);

type PartialPerson = Infer<typeof partialPersonSchema>; // => Partial<{ name: string }> || { name?: string }

partialPersonSchema.parse({}); // Succeeds
partialPersonSchema.parse({ nickName: 'lil kenny g' }); // throws validation error
```

The partial function accepts an options object as second argument to create a deeply partial object.

options:

- deep: `boolean` created a deeply partial schema for nested objects

```typescript
const schema = myzod.object({
  name: myzod.string(),
  birthday: myzod.object({
    year: myzod.number(),
    month: myzod.number().min(1).max(12),
    date: myzod.number().min(1).max(31),
  }),
});

const partialSchema = myzod.partial(schema);

type PartialSchema = myzod.Infer<typeof partialSchema>; // => { name?: string; birthday?: { year: number; month: number; date: number; } }

const deeplyPartialSchema = myzod.partial(schema, { deep: true });

type DeeplyPartialSchema = myzod.Infer<typeof deeplyPartialSchema>; // { name?: string; birthday?: { year?: number; month?: number; date?: number; } }
```

#### Pick

The myzod.pick function takes a myzod schema and an array of keys, and generates a new schema equivalent to typescript's Pick<T, keyof T> type.

```typescript
const personSchema = myzod.object({
  name: myzod.string(),
  lastName: myzod.string(),
  email: myzod.email(),
  age: myzod.number(),
});

const nameSchema = myzod.pick(personSchema, ['name', 'lastName']);

type Named = myzod.Infer<typeof nameSchema>; // => { name: string; lastName: string; }
```

#### Omit

The myzod.pick function takes a myzod schema and an array of keys, and generates a new schema equivalent to typescript's Omit<T, keyof T> type.

```typescript
const personSchema = myzod.object({
  name: myzod.string(),
  lastName: myzod.string(),
  email: myzod.email(),
  age: myzod.number(),
});

const nameSchema = myzod.omit(personSchema, ['email', 'age']);

type Named = myzod.Infer<typeof nameSchema>; // => { name: string; lastName: string; }
```

#### Lazy

The myzod.lazy function takes a function that returns a schema and lazily evaluates it at parse. The advantage with this approach is that you can create schemas that reference themselves. Unfortunately typescript cannot resolve this type and it will be the user's responsibility to provide the corresponding myzod type. Fortunately if the user's provided type is incompatible with the given schema it will fail to compile so there is some hope.

```typescript
type Person = {
  name: string;
  friends: Person[];
};

const personSchema: z.Type<Person> = myzod.object({
  name: myzod.string(),
  friends: myzod.array(myzod.lazy(() => personSchema)),
});
```
