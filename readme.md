# myzod

The original intent was to create a fork of [zod](https://www.npmjs.com/package/zod), however as I played with it and changed the inference mechanism and started writing tests it became clear to me that it would never be merged into zod, thus `myzod` is born.

The resulting package has a similar api to `zod` with a little bit of inspiration from [joi](https://www.npmjs.com/package/@hapi/joi). The goal is to write schemas from which the _type_ of a successfully parsed value can be inferred.

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

- [type class](#myzod.type<t>)

Primitive Types

- [string](#string)
- [number](#number)
- [boolean](#boolean)
- [undefined](#undefined)
- [null](#null)
- [literal](#literal)
- [unknown](#unknown)

Reference Types

- [object](#object)
- [array](#array)
- [record](#record)
- [enum](#enum)

Logical Types

- [union](#union)
- [intersection](#intersection)
- [partial](#partial)
- [pick](#pick)

### myzod.Type<T>

All myzod schemas extend the generic myzod.Type class, and as such inherit these methods:

#### `parse`

Takes an unknown value, and returns it typed if passed validation. Otherwise throws a myzod.ValidationError

```typescript
parse(value: unknown): T
```

##### `optional`

Returns a new schema which is the union of the current schema and the UndefinedType schema.

```typescript
const optionalStringSchema = myzod.string().optional(); // => UnionType<[Type<string>, UndefinedType]>

type StringOrUndefined = Infer<typeof optionalStringSchema>; // => string | undefined
```

##### `nullable`

Returns a new schema which is the union of the current schema and the NullableType schema.

```typescript
const nullableStringSchema = myzod.string().nullable();

type StringOrUndefined = Infer<typeof nullableStringSchema>; // => string | null
```

##### `or`

Shorthand for creating union types of two schemas.

```typescript
const stringOrBoolSchema = myzod.string().or(myzod.boolean());

type StringOrUndefined = Infer<typeof stringOrBoolSchema>; // => string | boolean
```

##### and

Shorthand for creating intersection types of two schemas.

```typescript
const nameSchema = myzod.object({ name: myzod.string() });
const ageSchema = myzod.object({ name: myzod.number() });

const personSchema = nameSchema.and(ageSchema); // Same as ageSchema.and(nameSchema);

type Person = Infer<typeof personSchema>; // => { name: string; age: number; }
```

#### String

options:

- min: `number` - sets the minimum length for the string
- max: `number` - sets the maximum length for the string
- pattern: `RegExp` - expression string must match
- predicate: `(val: string) => boolean` - predicate function to extend string validation.
- predicateErrMsg: `string` - error message to throw in ValidationError should predicate fail

options can be passed as an option object or chained from schema.

```typescript
myzod.string({ min: 3, max: 10, patten: /^hey/ });
// Same as:
myzod
  .string()
  .min(3)
  .max(10)
  .pattern(/^hey/);
```

Myzod is not interested in reimplementing all possible string validations, ie isUUID, isEmail, isAlphaNumeric, etc. The myzod string validation can be easily extended using the predicate and predicateErrMsg options

```typescript
const uuidSchema = myzod.string().predicate(validator.isUUID, 'expected string to be uuid');

type UUID = Infer<typeof uuidSchema>; // => string

uuidSchema.parse('hello world'); // Throws ValidationError with message 'expected string to be uuid'
// note that if predicate function throws an error that message will be used instead
```

#### Number

options:

- min: `number` - min value for number
- max: `number` - max value for number

options can be passed as an option object or chained from schema.

```typescript
myzod.number({ min: 0, max: 10 });
// Same as:
myzod
  .number()
  .min(0)
  .max(10);
```

#### Boolean

```typescript
myzod.boolean();
```

#### Undefined

```typescript
myzod.undefined();
```

#### Null

```typescript
myzod.null();
```

#### Literal

Just as in typescript we can type things using literals

```typescript
const schema = myzod.literal('Value');
type Val = Infer<typeof schema>; // => 'Value'
```

#### Unknown

```typescript
myzod.unknown();
```

The unknown schema does nothing when parsing by itself. However it is useful to require a key to be required inside an object schema when we don't know or don't care about the type.

```typescript
const schema = myzod.object({ unknownYetRequiredField: myzod.unknown() });
type Schema = Infer<typeof schema>; // => { unknownYetRequiredField: unknown }

schema.parse({}); // throws a ValidationError
schema.parse({ unkownYetRequiredField: 'hello' }); // succeeds
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
  name: myzod.string().min(2),
  age: myzod.number({ min: 0 }).nullable(),
});

type Person = Infer<typeof personSchema>; // => { name: string; age: number | null }
```

#### Array

options:

- length: `number` - the expected length of the array
- min: `number` - the minimum length of the array
- max: `number` - the maximum length of the array
- unique: `boolean` - should the array be unique. default `false`

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

#### Record

The record type emulates as the equivalent typescript type: `Record<string, T>`.

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

As a utility for creating records whose values are by default optional, you can use the myzod.dictionary function.

```typescript
const schema = myzod.dictionary(myzod.string());
// same as
const schema = myzod.record(myzod.string().optional());

type Schema = Infer<typeof schema>; // => { [key: string]: string | undefined }

// Note I have experienced issues with vscode type hints omitting the undefined union
// however when running tsc it evaluates Schema as the type above.
```

#### Enum

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
