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
  ToUnion,
} from './types';

export { ValidationError, Type, Infer } from './types';

export const string = (opts?: StringOptions) => new StringType(opts);
export const boolean = () => new BooleanType();
export const number = (opts?: NumberOptions) => new NumberType(opts);
export const unknown = () => new UnknownType();
export const literal = <T extends Literal>(literal: T) => new LiteralType(literal);
export const object = <T extends ObjectShape>(shape: T, opts?: ObjectOptions) => new ObjectType(shape, opts);
export const array = <T extends AnyType>(schema: T, opts?: ArrayOptions) => new ArrayType(schema, opts);
export const union = <T extends AnyType[]>(schemas: T, opts?: UnionOptions) => new UnionType(schemas, opts);
export const intersection = <T extends AnyType, K extends AnyType>(l: T, r: K): IntersectionResult<T, K> => l.and(r);
export const record = <T extends AnyType>(schema: T) => new RecordType(schema);
export const dictionary = <T extends AnyType>(schema: T) => new RecordType(schema.optional());
export const tuple = <T extends [AnyType, ...AnyType[]] | []>(schemas: T) => new TupleType(schemas);
export const date = () => new DateType();
export const lazy = <T extends () => AnyType>(fn: T) => new LazyType(fn);

export function partial<T extends ObjectType<any>, K extends PartialOpts>(
  schema: T,
  opts?: K
): T extends ObjectType<infer Shape>
  ? ObjectType<Eval<K extends { deep: true } ? DeepPartialShape<Shape> : PartialShape<Shape>>>
  : never;
export function partial<T extends AnyType, K extends PartialOpts>(schema: T, opts?: K): PartialType<T, K>;
export function partial(schema: any, opts: any): any {
  if (schema instanceof ObjectType) {
    return schema.partial(opts) as any;
  }
  return new PartialType(schema, opts) as any;
}

export function pick<T extends ObjectType<any>, K extends T extends ObjectType<infer Shape> ? keyof Shape : never>(
  schema: T,
  keys: K[]
): T extends ObjectType<infer Shape> ? ObjectType<Eval<Pick<Shape, ToUnion<typeof keys>>>> : never;
export function pick<T extends RecordType<any>, K extends string>(
  schema: T,
  keys: K[]
): T extends RecordType<infer Schema> ? ObjectType<{ [key in ToUnion<typeof keys>]: Schema }> : never;
export function pick<T extends AnyType, K extends keyof Infer<T>>(type: T, keys: K[]): PickType<T, K>;
export function pick(schema: any, keys: any): any {
  if (schema instanceof ObjectType) {
    return schema.pick(keys);
  }
  if (schema instanceof RecordType) {
    return schema.pick(keys);
  }
  return new PickType(schema, keys);
}

export function omit<T extends ObjectType<any>, K extends T extends ObjectType<infer Shape> ? keyof Shape : never>(
  schema: T,
  keys: K[]
): T extends ObjectType<infer Shape> ? ObjectType<Eval<Omit<Shape, ToUnion<typeof keys>>>> : never;
export function omit<T extends AnyType, K extends keyof Infer<T>>(schema: T, keys: K[]): OmitType<T, K>;
export function omit(schema: any, keys: any): any {
  if (schema instanceof ObjectType) {
    return schema.omit(keys);
  }
  return new OmitType(schema, keys);
}

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
