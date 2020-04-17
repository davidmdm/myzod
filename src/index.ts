import {
  ValidationError,
  Type,
  StringType,
  NumberType,
  LiteralType,
  ObjectType,
  ArrayType,
  UnionType,
  RecordType,
  PartialType,
  PickType,
  OmitType,
  TupleType,
  DateType,
  LazyType,
  UndefinedType,
  NullType,
  EnumType,
  BooleanType,
  UnknownType,
  NumberOptions,
  Literal,
  ObjectShape,
  ObjectOptions,
  AnyType,
  StringOptions,
  ArrayOptions,
  UnionOptions,
  Infer,
  PartialOpts,
  IntersectionResult,
  DeepPartialShape,
  PartialShape,
  Eval,
} from './types';

export { ValidationError, Type, Infer } from './types';

export const string = (opts?: StringOptions) => new StringType(opts);
export const boolean = () => new BooleanType();
export const number = (opts?: NumberOptions) => new NumberType(opts);
export const unknown = () => new UnknownType();
export const literal = <T extends Literal>(literal: T) => new LiteralType(literal);
export const object = <T extends ObjectShape>(shape: T, opts?: ObjectOptions) => new ObjectType(shape, opts);
export const array = <T extends AnyType>(type: T, opts?: ArrayOptions) => new ArrayType(type, opts);
export const union = <T extends AnyType[]>(schemas: T, opts?: UnionOptions) => new UnionType(schemas, opts);
export const intersection = <T extends AnyType, K extends AnyType>(l: T, r: K): IntersectionResult<T, K> => l.and(r);
export const record = <T extends AnyType>(type: T) => new RecordType(type);
export const dictionary = <T extends AnyType>(type: T) => new RecordType(union([type, undefinedValue()]));
export const pick = <T extends AnyType, K extends keyof Infer<T>>(type: T, keys: K[]) => new PickType(type, keys);
export const omit = <T extends AnyType, K extends keyof Infer<T>>(type: T, keys: K[]) => new OmitType(type, keys);
export const tuple = <T extends [AnyType, ...AnyType[]] | []>(schemas: T) => new TupleType(schemas);
export const date = () => new DateType();
export const lazy = <T extends () => AnyType>(fn: T) => new LazyType(fn);

export const partial = <T extends AnyType, K extends PartialOpts>(
  schema: T,
  opts?: K
): T extends ObjectType<any>
  ? T extends ObjectType<infer Shape>
    ? ObjectType<Eval<K extends { deep: true } ? DeepPartialShape<Shape> : PartialShape<Shape>>>
    : never
  : PartialType<T, K> => {
  if (schema instanceof ObjectType) {
    return schema.partial(opts) as any;
  }
  return new PartialType(schema, opts) as any;
};

const undefinedValue = () => new UndefinedType();
const nullValue = () => new NullType();
const enumValue = <T>(e: T) => new EnumType(e);

export { undefinedValue as undefined, nullValue as null, enumValue as enum };

// Support default imports
export default {
  Type,
  string,
  boolean,
  number,
  unknown,
  literal,
  date,
  object,
  array,
  union,
  intersection,
  record,
  dictionary,
  tuple,
  partial,
  pick,
  omit,
  undefined: undefinedValue,
  null: nullValue,
  enum: enumValue,
  ValidationError,
};
