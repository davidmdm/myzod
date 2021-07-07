import { NullableType } from './types';
import {
  ValidationError,
  Type,
  StringType,
  NumberType,
  LiteralType,
  ObjectType,
  ArrayType,
  UnionType,
  PartialType,
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
  ArrayOptions,
  UnionOptions,
  PartialOpts,
  IntersectionResult,
  DeepPartialShape,
  PartialShape,
  Eval,
  ToUnion,
  keySignature,
  StringTypes,
  OptionalType,
  BigIntOptions,
  BigIntType,
  StringOptions,
  EnumOptions,
} from './types';

export { ValidationError, Type, Infer, keySignature, AnyType, ObjectShape } from './types';

export const string = (opts?: StringOptions) => new StringType(opts);
export const boolean = () => new BooleanType();
export const number = (opts?: NumberOptions) => new NumberType(opts);
export const bigint = (opts?: BigIntOptions) => new BigIntType(opts);
export const unknown = () => new UnknownType();
export const literal = <T extends Literal>(literal: T) => new LiteralType(literal);
export const object = <T extends ObjectShape>(shape: T, opts?: ObjectOptions<T>) => new ObjectType(shape, opts);
export const array = <T extends AnyType>(schema: T, opts?: ArrayOptions<T>) => new ArrayType(schema, opts);
export const union = <T extends AnyType[]>(schemas: T, opts?: UnionOptions<T>) => new UnionType(schemas, opts);
export const intersection = <T extends AnyType, K extends AnyType>(l: T, r: K): IntersectionResult<T, K> => l.and(r);

type LiteralWrapper<T extends any> = T extends Literal ? LiteralType<T> : never;
type ToLiteralUnion<T extends Literal[]> = { [key in keyof T]: LiteralWrapper<T[key]> };
export const literals = <T extends Literal[]>(...args: T): UnionType<ToLiteralUnion<T>> =>
  new UnionType(args.map(literal)) as any;

export const record = <T extends AnyType>(schema: T) => new ObjectType({ [keySignature]: schema });
export const dictionary = <T extends AnyType>(
  schema: T
): ObjectType<{
  [keySignature]: T extends OptionalType<any> ? T : OptionalType<T>;
}> => {
  if (schema instanceof OptionalType) {
    return new ObjectType({ [keySignature]: schema }) as any;
  }
  return new ObjectType({ [keySignature]: new OptionalType(schema) }) as any;
};
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

export function pick<
  T extends ObjectType<any>,
  K extends T extends ObjectType<infer Shape>
    ? Shape extends { [keySignature]: AnyType }
      ? string
      : StringTypes<keyof Shape>
    : never
>(
  schema: T,
  keys: K[]
): T extends ObjectType<infer Shape>
  ? ObjectType<
      Eval<
        Pick<Shape, Extract<StringTypes<keyof Shape>, ToUnion<typeof keys>>> &
          (Shape extends { [keySignature]: AnyType }
            ? Shape extends { [keySignature]: infer KeySig }
              ? { [key in Exclude<ToUnion<typeof keys>, keyof Shape>]: KeySig }
              : {}
            : {})
      >
    >
  : never {
  return schema.pick(keys) as any;
}

export function omit<
  T extends ObjectType<any>,
  K extends T extends ObjectType<infer Shape> ? StringTypes<keyof Shape> : never
>(
  schema: T,
  keys: K[]
): T extends ObjectType<infer Shape> ? ObjectType<Eval<Omit<Shape, ToUnion<typeof keys>>>> : never {
  return schema.omit(keys) as any;
}

const undefinedValue = () => new UndefinedType();
const nullValue = () => new NullType();
const enumValue = <T>(e: T, opts?: EnumOptions<T>) => new EnumType(e, opts);

export { undefinedValue as undefined, nullValue as null, enumValue as enum };

// Support default imports
export default {
  Type,
  string,
  boolean,
  number,
  bigint,
  unknown,
  literal,
  literals,
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
  required,
  lazy,
  undefined: undefinedValue,
  null: nullValue,
  enum: enumValue,
  ValidationError,
  keySignature: keySignature as typeof keySignature,
};

type Require<T extends AnyType> = T extends NullableType<infer S>
  ? Require<S>
  : T extends OptionalType<infer S>
  ? Require<S>
  : T;

export function required<T extends AnyType>(schema: T): Require<T> {
  if (schema instanceof NullableType) {
    return required(schema.required());
  }
  if (schema instanceof OptionalType) {
    return required(schema.required());
  }
  return schema as any;
}
