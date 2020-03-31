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

- [string](#string)

### myzod.Type<T>

All myzod schemas extend the generic myzod.Type class, and as such inherit these methods:

#### Parse

Takes an unknown value, and returns it typed if passed validation. Otherwise throws a myzod.ValidationError

```typescript
parse(value: unknown): T
```

##### optional

Returns a new schema which is the union of the current schema and the UndefinedType schema.

```typescript
const optionalStringSchema = myzod.string().optional(); // => UnionType<[Type<string>, UndefinedType]>

type StringOrUndefined = Infer<typeof optionalStringSchema>; // => string | undefined
```

##### nullable

Returns a new schema which is the union of the current schema and the NullableType schema.

```typescript
const nullableStringSchema = myzod.string().nullable(); // => UnionType<[Type<string>, NullableType]>

type StringOrUndefined = Infer<typeof nullableStringSchema>; // => string | null
```

##### or

Shorthand for creating union types of two schemas.

```typescript
const stringOrBoolSchema = myzod.string().or(myzod.boolean()); // => UnionType<[StringType, BooleanType]>

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
