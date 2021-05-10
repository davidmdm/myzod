import { format } from 'util';

function clone<T>(value: T): T {
  if (typeof value !== 'object' || value === null) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(elem => clone(elem)) as any;
  }
  const cpy: any = Object.create(null);
  for (const k in value) {
    cpy[k] = clone(value[k]);
  }
  for (const s of Object.getOwnPropertySymbols(value)) {
    cpy[s] = clone((value as any)[s]);
  }
  Object.setPrototypeOf(cpy, Object.getPrototypeOf(value));
  return cpy;
}

const typeErrSym = Symbol('typeError');
const coercionTypeSymbol = Symbol('coercion');

export abstract class Type<T> {
  public [typeErrSym]?: string | (() => string);
  public [coercionTypeSymbol]?: boolean;
  constructor() {}
  abstract parse(value: unknown): T;
  abstract and<K extends AnyType>(schema: K): any;
  or<K extends AnyType>(schema: K): UnionType<[this, K]> {
    return new UnionType([this, schema]);
  }

  optional(this: OptionalType<any>): this;
  optional(): OptionalType<this>;
  optional(): any {
    if (this instanceof OptionalType) {
      return clone(this);
    }
    return new OptionalType(this);
  }
  nullable(this: NullableType<any>): this;
  nullable(): NullableType<this>;
  nullable(): any {
    if (this instanceof NullableType) {
      return clone(this);
    }
    return new NullableType(this);
  }
  try(value: unknown): T | ValidationError {
    try {
      return (this as any).parse.apply(this, arguments);
    } catch (err) {
      return err;
    }
  }
  map<K>(fn: (value: T) => K): MappedType<K> {
    return new MTypeClass(this, fn) as any;
  }
  onTypeError(msg: string | (() => string)): this {
    const cpy = clone(this);
    cpy[typeErrSym] = msg;
    return cpy;
  }

  protected typeError(msg: string): ValidationError {
    const errMsg: string = (() => {
      const typErrValue = (this as any)[typeErrSym];
      if (typErrValue === undefined) {
        return msg;
      }
      if (typeof typErrValue === 'function') {
        return typErrValue();
      }
      return typErrValue;
    })();
    return new ValidationError(errMsg);
  }
}

// TODO remove once we can get mapped types inferred properly or Predicate and default funcs move to abstract class Type
type MappedType<T> = Type<T> & {
  withPredicate: (fn: Predicate<T>['func'], errMsg?: ErrMsg<T>) => Type<T> & MappedType<T>;
  default: (value: T | (() => T)) => Type<T> & MappedType<T>;
};

class MTypeClass<T extends AnyType, K> extends Type<K> implements WithPredicate<K>, Defaultable<K> {
  private predicates: Predicate<K>[] | null = null;
  private defaultValue?: K | (() => K);
  constructor(protected schema: T, protected mapFn: (value: Infer<T>) => K) {
    super();
    this[coercionTypeSymbol] = true;
  }
  parse(value: unknown): K {
    const ret =
      value === undefined && this.defaultValue
        ? typeof this.defaultValue === 'function'
          ? (this.defaultValue as any)()
          : this.defaultValue
        : this.mapFn(this.schema.parse(value));

    if (this.predicates) {
      applyPredicates(this.predicates, ret);
    }
    return ret;
  }
  and<O extends AnyType>(other: O): never {
    throw new Error('mapped types cannot be intersected');
  }
  withPredicate(fn: Predicate<K>['func'], errMsg?: ErrMsg<K>): MTypeClass<T, K> {
    return withPredicate(this, { func: fn, errMsg });
  }
  default(value: K | (() => K)): MTypeClass<T, K> {
    return withDefault(this, value);
  }
}

export class ValidationError extends Error {
  name = 'MyZodError';
  path?: (string | number)[];
  collectedErrors?: Record<string, ValidationError | undefined>;
  // @ts-ignore
  constructor(
    message: string,
    path?: (string | number)[],
    collectedErrors?: Record<string, ValidationError | undefined>
  ) {
    if (collectedErrors !== undefined) {
      message = Object.values(collectedErrors)
        .map(err => format(`error parsing object at path: "%s" - %s`, prettyPrintPath(err?.path || []), err?.message))
        .join('\n');
    }
    super(message);
    this.path = path;
    this.collectedErrors = collectedErrors;
  }
}

function typeOf(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (Array.isArray(value)) {
    return 'array';
  }
  return typeof value;
}

function prettyPrintPath(path: (number | string)[]): string {
  return path.reduce<string>((acc, elem, idx) => {
    if (typeof elem === 'number') {
      acc += `[${elem}]`;
    } else if (idx === 0) {
      acc += elem;
    } else {
      acc += '.' + elem;
    }
    return acc;
  }, '');
}

export type Eval<T> = T extends any[] | Date | unknown ? T : Flat<T>;
export type AnyType = Type<any>;
export type Infer<T> = T extends AnyType ? (T extends Type<infer K> ? K : any) : T;

const allowUnknownSymbol = Symbol('allowUnknown');
const shapekeysSymbol = Symbol('shapeKeys');

type ObjectIntersection<O1 extends ObjectType<any>, O2 extends ObjectType<any>> = O1 extends ObjectType<infer Shape1>
  ? O2 extends ObjectType<infer Shape2>
    ? ObjectType<Flat<MergeShapes<Shape1, Shape2>>>
    : never
  : never;

type ArrayIntersection<A1 extends ArrayType<any>, A2 extends ArrayType<any>> = A1 extends ArrayType<infer S1>
  ? A2 extends ArrayType<infer S2>
    ? ArrayType<IntersectionResult<S1, S2>>
    : never
  : never;

type TupleIntersection<T1 extends TupleType<any>, T2 extends TupleType<any>> = T1 extends TupleType<infer S1>
  ? T2 extends TupleType<infer S2>
    ? TupleType<Join<S1, S2>>
    : never
  : never;

export type IntersectionResult<T extends AnyType, K extends AnyType> =
  //
  T extends ObjectType<any>
    ? K extends ObjectType<any>
      ? ObjectIntersection<T, K>
      : IntersectionType<T, K>
    : T extends ArrayType<any>
    ? K extends ArrayType<any>
      ? ArrayIntersection<T, K>
      : IntersectionType<T, K>
    : T extends TupleType<any>
    ? K extends TupleType<any>
      ? TupleIntersection<T, K>
      : IntersectionType<T, K>
    : T extends MTypeClass<any, any>
    ? never
    : K extends MTypeClass<any, any>
    ? never
    : IntersectionType<T, K>;

type ErrMsg<T> = string | ((value: T) => string);
type Predicate<T> = { func: (value: T) => boolean; errMsg?: ErrMsg<T> };

const normalizePredicates = <T>(
  predicate?: Predicate<T>['func'] | Predicate<T> | Predicate<T>[]
): Predicate<T>[] | null => {
  if (!predicate) {
    return null;
  }
  if (typeof predicate === 'function') {
    return [{ func: predicate }];
  }
  if (Array.isArray(predicate)) {
    return predicate;
  }
  return [predicate];
};

const applyPredicates = (predicates: Predicate<any>[], value: any) => {
  try {
    for (const predicate of predicates) {
      if (!predicate.func(value)) {
        throw new ValidationError(
          predicate.errMsg
            ? typeof predicate.errMsg === 'function'
              ? predicate.errMsg(value)
              : predicate.errMsg
            : 'failed anonymous predicate function'
        );
      }
    }
  } catch (err) {
    if (err instanceof ValidationError) {
      throw err;
    }
    throw new ValidationError(err.message);
  }
};

const appendPredicate = <T>(
  predicates: Predicate<T>[] | null | undefined,
  pred: {
    func: (value: T) => boolean;
    errMsg?: string | ((value: T) => string);
  }
): Predicate<T>[] => {
  if (!predicates) {
    return [pred];
  }
  return [...predicates, pred];
};

interface WithPredicate<T> {
  withPredicate(fn: Predicate<T>['func'], errMsg?: ErrMsg<T>): any;
}

const withPredicate = (schema: any, predicate: any) => {
  const cpy = clone(schema);
  cpy.predicates = appendPredicate(cpy.predicates, predicate);
  return cpy;
};

interface Defaultable<T> {
  default(value: T | (() => T)): any;
}

const withDefault = (schema: any, value: any) => {
  const cpy = clone(schema);
  (cpy as any)[coercionTypeSymbol] = true;
  cpy.defaultValue = value;
  return cpy;
};

// Primitives

export type StringOptions = {
  min?: number;
  max?: number;
  pattern?: RegExp;
  valid?: string[];
  predicate?: Predicate<string>['func'] | Predicate<string> | Predicate<string>[];
  default?: string | (() => string);
};

export class StringType extends Type<string> implements WithPredicate<string>, Defaultable<string> {
  private predicates: Predicate<string>[] | null;
  private defaultValue?: string | (() => string);
  constructor(opts?: StringOptions) {
    super();
    this.predicates = normalizePredicates(opts?.predicate);
    this.defaultValue = opts?.default;
    (this as any)[coercionTypeSymbol] = opts?.default !== undefined;
    let self: StringType = this;
    if (typeof opts?.min !== 'undefined') {
      self = self.min(opts.min);
    }
    if (typeof opts?.max !== 'undefined') {
      self = self.max(opts.max);
    }
    if (typeof opts?.pattern !== 'undefined') {
      self = self.pattern(opts.pattern);
    }
    if (opts?.valid) {
      self = self.valid(opts.valid);
    }
    return self;
  }
  parse(value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue): string {
    if (typeof value !== 'string') {
      throw this.typeError('expected type to be string but got ' + typeOf(value));
    }
    if (this.predicates) {
      applyPredicates(this.predicates, value);
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  pattern(regexp: RegExp, errMsg?: ErrMsg<string>): StringType {
    return this.withPredicate(
      value => regexp.test(value),
      errMsg || `expected string to match pattern ${regexp} but did not`
    );
  }
  min(x: number, errMsg?: ErrMsg<string>): StringType {
    return this.withPredicate(
      (value: string) => value.length >= x,
      errMsg ||
        ((value: string) =>
          `expected string to have length greater than or equal to ${x} but had length ${value.length}`)
    );
  }
  max(x: number, errMsg?: ErrMsg<string>): StringType {
    return this.withPredicate(
      (value: string) => value.length <= x,
      errMsg ||
        ((value: string) => `expected string to have length less than or equal to ${x} but had length ${value.length}`)
    );
  }
  valid(list: string[], errMsg?: ErrMsg<string>): StringType {
    return this.withPredicate(
      (value: string) => list.includes(value),
      errMsg || `expected string to be one of: ${JSON.stringify(list)}`
    );
  }
  withPredicate(fn: Predicate<string>['func'], errMsg?: ErrMsg<string>): StringType {
    return withPredicate(this, { func: fn, errMsg });
  }
  default(value: string | (() => string)): StringType {
    return withDefault(this, value);
  }
}

export class BooleanType extends Type<boolean> implements Defaultable<boolean> {
  constructor(private defaultValue?: boolean | (() => boolean)) {
    super();
    (this as any)[coercionTypeSymbol] = defaultValue !== undefined;
  }
  parse(value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue): boolean {
    if (typeof value !== 'boolean') {
      throw this.typeError('expected type to be boolean but got ' + typeOf(value));
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(value: boolean | (() => boolean)): BooleanType {
    return withDefault(this, value);
  }
}

export type NumberOptions = {
  min?: number;
  max?: number;
  coerce?: boolean;
  predicate?: Predicate<number>['func'] | Predicate<number> | Predicate<number>[];
  default?: number | (() => number);
};

export class NumberType extends Type<number> implements WithPredicate<number>, Defaultable<number> {
  private predicates: Predicate<number>[] | null;
  private defaultValue?: number | (() => number);
  private coerceFlag?: boolean;
  constructor(opts: NumberOptions = {}) {
    super();
    this.coerceFlag = opts.coerce;
    this.predicates = normalizePredicates(opts.predicate);
    this.defaultValue = opts.default;
    (this as any)[coercionTypeSymbol] = !!opts.coerce || opts.default !== undefined;
    let self: NumberType = this;
    if (typeof opts.max !== 'undefined') {
      self = self.max(opts.max);
    }
    if (typeof opts.min !== 'undefined') {
      self = self.min(opts.min);
    }
    return self;
  }
  parse(value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue): number {
    if (this.coerceFlag && typeof value === 'string') {
      const number = parseFloat(value);
      if (isNaN(number)) {
        throw this.typeError('expected type to be number but got string');
      }
      return this.parse(number);
    }
    if (typeof value !== 'number') {
      throw this.typeError('expected type to be number but got ' + typeOf(value));
    }
    if (this.predicates) {
      applyPredicates(this.predicates, value);
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  min(x: number, errMsg?: ErrMsg<number>): NumberType {
    return this.withPredicate(
      value => value >= x,
      errMsg || (value => `expected number to be greater than or equal to ${x} but got ${value}`)
    );
  }
  max(x: number, errMsg?: ErrMsg<number>): NumberType {
    return this.withPredicate(
      value => value <= x,
      errMsg || (value => `expected number to be less than or equal to ${x} but got ${value}`)
    );
  }
  coerce(value?: boolean): NumberType {
    return new NumberType({
      predicate: this.predicates || undefined,
      coerce: value !== undefined ? value : true,
      default: this.defaultValue,
    });
  }
  withPredicate(fn: Predicate<number>['func'], errMsg?: ErrMsg<number>): NumberType {
    return withPredicate(this, { func: fn, errMsg });
  }
  default(value: number | (() => number)): NumberType {
    return withDefault(this, value);
  }
}

export type BigIntOptions = {
  min?: number | bigint;
  max?: number | bigint;
  predicate?: Predicate<bigint>['func'] | Predicate<bigint> | Predicate<bigint>[];
  default?: bigint | (() => bigint);
};

export class BigIntType extends Type<bigint> implements WithPredicate<bigint>, Defaultable<bigint> {
  private readonly predicates: Predicate<bigint>[] | null;
  private readonly defaultValue?: bigint | (() => bigint);
  constructor(opts: BigIntOptions = {}) {
    super();
    this[coercionTypeSymbol] = true;
    this.predicates = normalizePredicates(opts.predicate);
    this.defaultValue = opts.default;
  }
  parse(value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue): bigint {
    try {
      const int = BigInt(value as any);
      if (this.predicates) {
        applyPredicates(this.predicates, int);
      }
      return int;
    } catch (err) {
      if (err instanceof ValidationError) {
        throw err;
      }
      throw this.typeError('expected type to be bigint interpretable - ' + err.message.toLowerCase());
    }
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  min(x: number | bigint, errMsg?: ErrMsg<bigint>): BigIntType {
    return this.withPredicate(
      value => value >= x,
      errMsg || (value => `expected bigint to be greater than or equal to ${x} but got ${value}`)
    );
  }
  max(x: number | bigint, errMsg?: ErrMsg<bigint>): BigIntType {
    return this.withPredicate(
      value => value <= x,
      errMsg || (value => `expected bigint to be less than or equal to ${x} but got ${value}`)
    );
  }
  withPredicate(fn: Predicate<bigint>['func'], errMsg?: ErrMsg<bigint>): BigIntType {
    return withPredicate(this, { func: fn, errMsg });
  }
  default(value: bigint | (() => bigint)): BigIntType {
    return withDefault(this, value);
  }
}

export class UndefinedType extends Type<undefined> {
  parse(value: unknown): undefined {
    if (value !== undefined) {
      throw this.typeError('expected type to be undefined but got ' + typeOf(value));
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

export class NullType extends Type<null> implements Defaultable<null> {
  private defaultValue: null | undefined;
  constructor() {
    super();
  }
  parse(value: unknown = this.defaultValue): null {
    if (value !== null) {
      throw this.typeError('expected type to be null but got ' + typeOf(value));
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(): NullType {
    return withDefault(this, null);
  }
}

export type Literal = string | number | boolean | undefined | null;

export class LiteralType<T extends Literal> extends Type<T> implements Defaultable<T> {
  private readonly defaultValue?: T;
  constructor(private readonly literal: T) {
    super();
  }
  parse(value: unknown = this.defaultValue): T {
    if (value !== this.literal) {
      const typeofValue = typeof value !== 'object' ? JSON.stringify(value) : typeOf(value);
      throw this.typeError(`expected value to be literal ${JSON.stringify(this.literal)} but got ${typeofValue}`);
    }
    return value as T;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(): LiteralType<T> {
    return withDefault(this, this.literal);
  }
}

export class UnknownType extends Type<unknown> implements Defaultable<unknown> {
  private readonly defaultValue?: any;
  constructor() {
    super();
  }
  parse(value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue): unknown {
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(value: any | (() => any)) {
    return withDefault(this, value);
  }
}

export class OptionalType<T extends AnyType> extends Type<Infer<T> | undefined> {
  constructor(readonly schema: T) {
    super();
    this[coercionTypeSymbol] = (this.schema as any)[coercionTypeSymbol];
    (this as any)[shapekeysSymbol] = (this.schema as any)[shapekeysSymbol];
    (this as any)[allowUnknownSymbol] = (this.schema as any)[allowUnknownSymbol];
  }
  parse(value: unknown, opts?: any): Infer<T> | undefined {
    if (value === undefined) {
      return undefined;
    }
    //@ts-ignore
    return this.schema.parse(value, opts);
  }
  required(): T {
    return clone(this.schema);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

type Nullable<T> = T | null;
export class NullableType<T extends AnyType> extends Type<Infer<T> | null> implements Defaultable<Infer<T> | null> {
  private readonly defaultValue?: Nullable<Infer<T>> | (() => Nullable<Infer<T>>);
  constructor(readonly schema: T) {
    super();
    (this as any)[coercionTypeSymbol] = (this.schema as any)[coercionTypeSymbol];
    (this as any)[shapekeysSymbol] = (this.schema as any)[shapekeysSymbol];
    (this as any)[allowUnknownSymbol] = (this.schema as any)[allowUnknownSymbol];
  }
  parse(
    //@ts-ignore
    value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue
  ): Infer<T> | null {
    if (value === null) {
      return null;
    }
    return this.schema.parse(value);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  required(): T {
    return clone(this.schema);
  }
  default(value: Nullable<Infer<T>> | (() => Nullable<Infer<T>>)) {
    return withDefault(this, value);
  }
}

// Non Primitive types

export type DateOptions = {
  predicate?: Predicate<Date>['func'] | Predicate<Date> | Predicate<Date>[];
  default?: Date | (() => Date);
};

export class DateType extends Type<Date> implements WithPredicate<Date>, Defaultable<Date> {
  private readonly predicates: Predicate<Date>[] | null;
  private readonly defaultValue?: Date | (() => Date);
  constructor(opts?: DateOptions) {
    super();
    (this as any)[coercionTypeSymbol] = true;
    this.predicates = normalizePredicates(opts?.predicate);
    this.defaultValue = opts?.default;
  }
  parse(value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue): Date {
    const date = typeof value === 'string' ? this.stringToDate(value) : this.assertDate(value);
    if (this.predicates) {
      applyPredicates(this.predicates, date);
    }
    return date;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  withPredicate(fn: Predicate<Date>['func'], errMsg?: ErrMsg<Date>): DateType {
    return withPredicate(this, { func: fn, errMsg });
  }
  default(value: Date | (() => Date)): DateType {
    return withDefault(this, value);
  }

  private stringToDate(str: string): Date {
    const date = new Date(str);
    if (isNaN(date.getTime())) {
      throw this.typeError(`expected date string to be valid date`);
    }
    return date;
  }

  private assertDate(date: any): Date {
    if (!(date instanceof Date)) {
      throw this.typeError('expected type Date but got ' + typeOf(date));
    }
    return date;
  }
}

export const keySignature = Symbol('keySignature');
export type ObjectShape = { [key: string]: AnyType; [keySignature]?: AnyType };

type OptionalKeys<T extends ObjectShape> = {
  [key in keyof T]: undefined extends Infer<T[key]> ? (key extends symbol ? never : key) : never;
}[keyof T];

type RequiredKeys<T extends ObjectShape> = Exclude<string & keyof T, OptionalKeys<T>>;

type InferKeySignature<T extends ObjectShape> = T extends { [keySignature]: AnyType }
  ? T extends { [keySignature]: infer KeySig }
    ? KeySig extends AnyType
      ? { [key: string]: Infer<KeySig> }
      : {}
    : {}
  : {};

type Flat<T> = T extends {} ? (T extends Date ? T : { [key in keyof T]: T[key] }) : T;

type InferObjectShape<T extends ObjectShape> = Flat<
  Eval<
    InferKeySignature<T> &
      { [key in OptionalKeys<T>]?: T[key] extends Type<infer K> ? K : any } &
      { [key in RequiredKeys<T>]: T[key] extends Type<infer K> ? K : any }
  >
>;

export type ToUnion<T extends any[]> = T[number];
export type PartialShape<T extends ObjectShape> = {
  [key in keyof T]: T[key] extends OptionalType<any> ? T[key] : OptionalType<T[key]>;
};
export type DeepPartialShape<T extends ObjectShape> = {
  [key in keyof T]: T[key] extends ObjectType<infer K>
    ? OptionalType<ObjectType<DeepPartialShape<K>>>
    : T[key] extends OptionalType<any>
    ? T[key]
    : OptionalType<T[key]>;
};

type MergeShapes<T extends ObjectShape, K extends ObjectShape> = {
  [key in keyof (T & K)]: key extends keyof T
    ? key extends keyof K
      ? IntersectionResult<T[key], K[key]>
      : T[key]
    : key extends keyof K
    ? K[key]
    : never;
};

export type StringTypes<T> = T extends string ? T : never;

export type PathOptions = { suppressPathErrMsg?: boolean };
export type ObjectOptions<T extends ObjectShape> = {
  allowUnknown?: boolean;
  predicate?:
    | Predicate<InferObjectShape<T>>['func']
    | Predicate<InferObjectShape<T>>
    | Predicate<InferObjectShape<T>>[];
  default?: InferObjectShape<T> | (() => InferObjectShape<T>);
  collectErrors?: boolean;
};

export class ObjectType<T extends ObjectShape>
  extends Type<InferObjectShape<T>>
  implements WithPredicate<InferObjectShape<T>>, Defaultable<InferObjectShape<T>> {
  private readonly predicates: Predicate<InferObjectShape<T>>[] | null;
  private readonly defaultValue?: InferObjectShape<T> | (() => InferObjectShape<T>);
  public [allowUnknownSymbol]: boolean;
  public [shapekeysSymbol]: string[];
  public [coercionTypeSymbol]: boolean;
  public [keySignature]: AnyType | undefined;
  private shouldCollectErrors: boolean;

  private _parse: (value: any, parseOpts: ObjectOptions<any> & PathOptions) => InferObjectShape<T>;

  constructor(private readonly objectShape: T, opts?: ObjectOptions<T>) {
    super();
    this.predicates = normalizePredicates(opts?.predicate);
    this.defaultValue = opts?.default;
    this.shouldCollectErrors = opts?.collectErrors === true;
    const keys = Object.keys(this.objectShape);
    this[keySignature] = this.objectShape[keySignature];
    this[allowUnknownSymbol] = opts?.allowUnknown === true;
    this[shapekeysSymbol] = keys;
    this[coercionTypeSymbol] =
      this.defaultValue !== undefined ||
      this[allowUnknownSymbol] ||
      Object.values(this.objectShape).some(schema => (schema as any)[coercionTypeSymbol]) ||
      !!(this.objectShape[keySignature] && (this.objectShape[keySignature] as any)[coercionTypeSymbol]);

    this._parse = this.selectParser();
  }

  parse(
    value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue,
    parseOpts: ObjectOptions<any> & PathOptions = {}
  ): InferObjectShape<T> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw this.typeError('expected type to be object but got ' + typeOf(value));
    }

    const keys: string[] = this[shapekeysSymbol];
    const allowUnknown = parseOpts.allowUnknown || this[allowUnknownSymbol];

    if (!allowUnknown && !this.objectShape[keySignature]) {
      const illegalKeys: string[] = [];
      for (const k in value) {
        if (!keys.includes(k)) {
          illegalKeys.push(k);
        }
      }
      if (illegalKeys.length > 0) {
        throw this.typeError('unexpected keys on object: ' + JSON.stringify(illegalKeys));
      }
    }

    return this._parse(value, parseOpts);
  }

  private buildPathError(err: ValidationError, key: string, parseOpts: PathOptions): ValidationError {
    const path = err.path ? [key, ...err.path] : [key];
    const msg = parseOpts.suppressPathErrMsg
      ? err.message
      : `error parsing object at path: "${prettyPrintPath(path)}" - ${err.message}`;
    return new ValidationError(msg, path);
  }

  private selectParser(): (value: any, parseOpts: ObjectOptions<any> & PathOptions) => InferObjectShape<T> {
    if (this[shapekeysSymbol].length === 0 && this[keySignature]) {
      if (this[coercionTypeSymbol] && this.shouldCollectErrors) {
        return this.parseRecordConvCollect;
      }
      if (this[coercionTypeSymbol]) {
        return this.parseRecordConv;
      }
      if (this.shouldCollectErrors) {
        return this.parseRecordCollect;
      }
      return this.parseRecord;
    }

    if (this[keySignature]) {
      if (this[coercionTypeSymbol] && this.shouldCollectErrors) {
        return this.parseMixRecordConvCollect;
      }
      if (this[coercionTypeSymbol]) {
        return this.parseMixRecordConv;
      }
      if (this.shouldCollectErrors) {
        return this.parseMixRecordCollect;
      }
      return this.parseMixRecord;
    }

    if (this[coercionTypeSymbol] && this.shouldCollectErrors) {
      return this.parseObjectConvCollect;
    }
    if (this[coercionTypeSymbol]) {
      return this.parseObjectConv;
    }
    if (this.shouldCollectErrors) {
      return this.parseObjectCollect;
    }
    return this.parseObject;
  }

  private parseObject(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    for (const key of this[shapekeysSymbol]) {
      try {
        const schema = (this.objectShape as any)[key];
        if (schema instanceof UnknownType && !(value as any).hasOwnProperty(key)) {
          throw (schema as any).typeError(`expected key "${key}" of unknown type to be present on object`);
        }
        schema.parse((value as any)[key], { suppressPathErrMsg: true });
      } catch (err) {
        throw this.buildPathError(err, key, parseOpts);
      }
    }
    if (this.predicates) {
      applyPredicates(this.predicates, value);
    }
    return value as any;
  }

  private parseObjectCollect(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    let hasError = false;
    const errs: Record<string, ValidationError> = {};
    for (const key of this[shapekeysSymbol]) {
      const schema = (this.objectShape as any)[key];
      if (schema instanceof UnknownType && !(value as any).hasOwnProperty(key)) {
        hasError = true;
        errs[key] = this.buildPathError(
          (schema as any).typeError(`expected key "${key}" of unknown type to be present on object`),
          key,
          { suppressPathErrMsg: true }
        );
        continue;
      }
      const result = (schema as any).try((value as any)[key], { suppressPathErrMsg: true });
      if (result instanceof ValidationError) {
        hasError = true;
        errs[key] = this.buildPathError(result, key, { suppressPathErrMsg: true });
      }
    }
    if (hasError) {
      throw new ValidationError('', undefined, errs);
    }
    if (this.predicates) {
      applyPredicates(this.predicates, value);
    }
    return value as any;
  }

  private parseObjectConv(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    const convVal: any = {};
    for (const key of this[shapekeysSymbol]) {
      try {
        const schema = (this.objectShape as any)[key];
        if (schema instanceof UnknownType && !(value as any).hasOwnProperty(key)) {
          throw (schema as any).typeError(`expected key "${key}" of unknown type to be present on object`);
        }
        convVal[key] = (schema as any).parse((value as any)[key], { suppressPathErrMsg: true });
      } catch (err) {
        throw this.buildPathError(err, key, parseOpts);
      }
    }
    if (this.predicates) {
      applyPredicates(this.predicates, convVal);
    }
    return convVal;
  }

  private parseObjectConvCollect(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    const convVal: any = {};
    const errs: any = {};
    let hasError = false;
    for (const key of this[shapekeysSymbol]) {
      const schema = (this.objectShape as any)[key];
      if (schema instanceof UnknownType && !(value as any).hasOwnProperty(key)) {
        hasError = true;
        errs[key] = this.buildPathError(
          (schema as any).typeError(`expected key "${key}" of unknown type to be present on object`),
          key,
          { suppressPathErrMsg: true }
        );
        continue;
      }
      const result = (schema as any).try((value as any)[key], { suppressPathErrMsg: true });
      if (result instanceof ValidationError) {
        hasError = true;
        errs[key] = this.buildPathError(result, key, { suppressPathErrMsg: true });
      } else {
        convVal[key] = result;
      }
    }
    if (hasError) {
      throw new ValidationError('', undefined, errs);
    }
    if (this.predicates) {
      applyPredicates(this.predicates, convVal);
    }
    return convVal;
  }

  private parseRecord(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    for (const key in value) {
      try {
        (this[keySignature] as any).parse((value as any)[key], { suppressPathErrMsg: true });
      } catch (err) {
        throw this.buildPathError(err, key, parseOpts);
      }
    }
    if (this.predicates) {
      applyPredicates(this.predicates, value);
    }
    return value as any;
  }

  private parseRecordCollect(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    let hasError = false;
    const errs: Record<string, ValidationError> = {};
    for (const key in value) {
      const result = (this[keySignature] as any).try((value as any)[key], { suppressPathErrMsg: true });
      if (result instanceof ValidationError) {
        hasError = true;
        errs[key] = this.buildPathError(result, key, { suppressPathErrMsg: true });
      }
    }
    if (hasError) {
      throw new ValidationError('', undefined, errs);
    }
    if (this.predicates) {
      applyPredicates(this.predicates, value);
    }
    return value as any;
  }

  private parseRecordConv(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    const convVal: any = {};
    for (const key in value) {
      try {
        convVal[key] = (this[keySignature] as any).parse((value as any)[key], { suppressPathErrMsg: true });
      } catch (err) {
        throw this.buildPathError(err, key, parseOpts);
      }
    }
    if (this.predicates) {
      applyPredicates(this.predicates, convVal);
    }
    return convVal;
  }

  private parseRecordConvCollect(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    const convVal: any = {};
    const errs: any = {};
    let hasError = false;
    for (const key in value) {
      const result = (this[keySignature] as any).try((value as any)[key], { suppressPathErrMsg: true });
      if (result instanceof ValidationError) {
        hasError = true;
        errs[key] = this.buildPathError(result, key, { suppressPathErrMsg: true });
      } else {
        convVal[key] = result;
      }
    }
    if (hasError) {
      throw new ValidationError('', undefined, errs);
    }
    if (this.predicates) {
      applyPredicates(this.predicates, convVal);
    }
    return convVal;
  }

  private parseMixRecord(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    for (const key of new Set(Object.keys(value).concat(this[shapekeysSymbol]))) {
      try {
        ((this.objectShape[key] || this[keySignature]) as any).parse((value as any)[key], { suppressPathErrMsg: true });
      } catch (err) {
        throw this.buildPathError(err, key, parseOpts);
      }
    }
    if (this.predicates) {
      applyPredicates(this.predicates, value);
    }
    return value as any;
  }

  private parseMixRecordCollect(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    let hasError = false;
    const errs: Record<string, ValidationError> = {};
    for (const key of new Set(Object.keys(value).concat(this[shapekeysSymbol]))) {
      const result = (((this.objectShape[key] || this[keySignature]) as any) as any).try((value as any)[key], {
        suppressPathErrMsg: true,
      });
      if (result instanceof ValidationError) {
        hasError = true;
        errs[key] = this.buildPathError(result, key, { suppressPathErrMsg: true });
      }
    }
    if (hasError) {
      throw new ValidationError('', undefined, errs);
    }
    if (this.predicates) {
      applyPredicates(this.predicates, value);
    }
    return value as any;
  }

  private parseMixRecordConv(
    value: Object,

    parseOpts: ObjectOptions<any> & PathOptions
  ): InferObjectShape<T> {
    const convVal: any = {};
    for (const key of new Set(Object.keys(value).concat(this[shapekeysSymbol]))) {
      try {
        convVal[key] = (((this.objectShape[key] || this[keySignature]) as any) as any).parse((value as any)[key], {
          suppressPathErrMsg: true,
        });
      } catch (err) {
        throw this.buildPathError(err, key, parseOpts);
      }
    }
    if (this.predicates) {
      applyPredicates(this.predicates, convVal);
    }
    return convVal;
  }

  private parseMixRecordConvCollect(value: Object, parseOpts: ObjectOptions<any> & PathOptions): InferObjectShape<T> {
    const convVal: any = {};
    const errs: any = {};
    let hasError = false;
    for (const key of new Set(Object.keys(value).concat(this[shapekeysSymbol]))) {
      const result = (((this.objectShape[key] || this[keySignature]) as any) as any).try((value as any)[key], {
        suppressPathErrMsg: true,
      });
      if (result instanceof ValidationError) {
        hasError = true;
        errs[key] = this.buildPathError(result, key, { suppressPathErrMsg: true });
      } else {
        convVal[key] = result;
      }
    }
    if (hasError) {
      throw new ValidationError('', undefined, errs);
    }
    if (this.predicates) {
      applyPredicates(this.predicates, convVal);
    }
    return convVal;
  }

  and<K extends AnyType>(schema: K): IntersectionResult<this, K> {
    if (schema instanceof ObjectType) {
      const keySet = new Set<string>([...(this as any)[shapekeysSymbol], ...(schema as any)[shapekeysSymbol]]);
      const intersectShape = Array.from(keySet).reduce<ObjectShape>((acc, key) => {
        if (this.objectShape[key] && schema.objectShape[key]) {
          acc[key] = this.objectShape[key].and(schema.objectShape[key]);
        } else if (this.objectShape[key]) {
          acc[key] = this.objectShape[key];
        } else {
          acc[key] = schema.objectShape[key];
        }
        return acc;
      }, {});
      const selfKeySig = this.objectShape[keySignature];
      const targetKeySig: AnyType | undefined = (schema as any)[keySignature];
      if (selfKeySig && targetKeySig) {
        intersectShape[keySignature] = selfKeySig.and(targetKeySig);
      } else if (selfKeySig || targetKeySig) {
        intersectShape[keySignature] = selfKeySig || targetKeySig;
      }
      return new ObjectType(intersectShape) as any;
    }

    return new IntersectionType(this, schema) as any;
  }

  pick<K extends T extends { [keySignature]: AnyType } ? string : StringTypes<keyof T>>(
    keys: K[],
    opts?: ObjectOptions<
      Flat<
        Pick<T, Extract<StringTypes<keyof T>, ToUnion<typeof keys>>> &
          (T extends { [keySignature]: AnyType }
            ? T extends { [keySignature]: infer KeySig }
              ? { [key in Exclude<ToUnion<typeof keys>, keyof T>]: KeySig }
              : {}
            : {})
      >
    >
  ): ObjectType<
    Flat<
      Pick<T, Extract<StringTypes<keyof T>, ToUnion<typeof keys>>> &
        (T extends { [keySignature]: AnyType }
          ? T extends { [keySignature]: infer KeySig }
            ? {
                [key in Exclude<ToUnion<typeof keys>, keyof T>]: KeySig;
              }
            : {}
          : {})
    >
  > {
    const pickedShape = keys.reduce<any>((acc, key) => {
      if (this.objectShape[key] || this.objectShape[keySignature]) {
        acc[key] = this.objectShape[key] || this.objectShape[keySignature];
      }
      return acc;
    }, {});

    return new ObjectType(pickedShape, opts);
  }

  omit<K extends StringTypes<keyof T>>(
    keys: K[],
    opts?: ObjectOptions<Eval<Omit<T, ToUnion<typeof keys>>>>
  ): ObjectType<Flat<Omit<T, ToUnion<typeof keys>>>> {
    const pickedKeys: K[] = ((this as any)[shapekeysSymbol] as K[]).filter((x: K) => !keys.includes(x));
    if (!(this as any)[keySignature]) {
      return this.pick(pickedKeys as any, opts as any) as any;
    }
    return (this.pick(pickedKeys as any, opts as any) as AnyType).and(
      new ObjectType({ [keySignature]: (this as any)[keySignature] })
    );
  }

  partial<K extends ObjectOptions<Eval<DeepPartialShape<T>>> & { deep: true }>(
    opts: K
  ): ObjectType<Flat<DeepPartialShape<T>>>;
  partial<K extends ObjectOptions<Eval<PartialShape<T>>> & PartialOpts>(opts?: K): ObjectType<Eval<PartialShape<T>>>;
  partial(opts?: any): any {
    const originalShape: ObjectShape = this.objectShape;
    const shape = Object.keys(originalShape).reduce<ObjectShape>((acc, key) => {
      if (opts?.deep) {
        acc[key] = toPartialSchema(originalShape[key], opts).optional();
      } else {
        acc[key] = originalShape[key].optional();
      }
      return acc;
    }, {});
    const keysig = originalShape[keySignature];
    if (keysig) {
      if (opts?.deep) {
        shape[keySignature] = toPartialSchema(keysig, opts).optional();
      } else {
        shape[keySignature] = keysig.optional();
      }
    }
    // Do not transfer predicates or default value to new object shape as this would not be type-safe
    return new ObjectType(shape as any, { allowUnknown: this[allowUnknownSymbol] });
  }

  shape(): T {
    return Object.assign({}, this.objectShape);
  }

  withPredicate(fn: Predicate<InferObjectShape<T>>['func'], errMsg?: ErrMsg<InferObjectShape<T>>): ObjectType<T> {
    return withPredicate(this, { func: fn, errMsg });
  }

  default(value: InferObjectShape<T> | (() => InferObjectShape<T>)): ObjectType<T> {
    const cpy: this = withDefault(this, value);
    cpy._parse = cpy.selectParser();
    return cpy;
  }

  collectErrors(value: boolean = true): ObjectType<T> {
    const cpy = clone(this);
    cpy.shouldCollectErrors = value;
    cpy._parse = cpy.selectParser();
    return cpy;
  }

  allowUnknownKeys(value: boolean = true): ObjectType<T> {
    const cpy = clone(this);
    cpy[allowUnknownSymbol] = value;
    cpy[coercionTypeSymbol] = cpy[coercionTypeSymbol] || value;
    cpy._parse = cpy.selectParser();
    return cpy;
  }
}

export type ArrayOptions<T extends AnyType> = {
  length?: number;
  min?: number;
  max?: number;
  unique?: boolean;
  predicate?: Predicate<Infer<T>[]>['func'] | Predicate<Infer<T>[]> | Predicate<Infer<T>[]>[];
  default?: Infer<T>[] | (() => Infer<T>[]);
  coerce?: (value: string) => Infer<T>[];
};

export class ArrayType<T extends AnyType>
  extends Type<Infer<T>[]>
  implements WithPredicate<Infer<T>[]>, Defaultable<Infer<T>[]> {
  private readonly predicates: Predicate<Infer<T>[]>[] | null;
  private readonly defaultValue?: Infer<T>[] | (() => Infer<T>[]);
  private readonly coerceFn?: (v: any) => Infer<T>[];
  private readonly _parse: (value: unknown, parseOptions?: PathOptions & ObjectOptions<any>) => any;
  constructor(readonly schema: T, opts: ArrayOptions<T> = {}) {
    super();
    this.predicates = normalizePredicates(opts.predicate);
    this.defaultValue = opts.default;
    this.coerceFn = opts.coerce;

    (this as any)[coercionTypeSymbol] =
      typeof this.coerceFn === 'function' ||
      this.defaultValue !== undefined ||
      (this.schema as any)[coercionTypeSymbol];

    this._parse =
      this.schema instanceof ObjectType || this.schema instanceof ArrayType || this.schema instanceof LazyType
        ? (elem: unknown, parseOptions?: ObjectOptions<any>) =>
            (this.schema.parse as any)(elem, {
              allowUnknown: parseOptions?.allowUnknown,
              suppressPathErrMsg: true,
            })
        : (elem: unknown) => this.schema.parse(elem);

    let self: ArrayType<T> = this;
    if (typeof opts.length !== 'undefined') {
      self = self.length(opts.length);
    }
    if (typeof opts.min !== 'undefined') {
      self = self.min(opts.min);
    }
    if (typeof opts.max !== 'undefined') {
      self = self.max(opts.max);
    }
    if (opts.unique === true) {
      self = self.unique();
    }
    return self;
  }
  parse(
    value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue,
    parseOptions?: PathOptions & ObjectOptions<any> & { coerced?: boolean }
  ): Infer<T>[] {
    if (typeof value === 'string' && typeof this.coerceFn === 'function' && !parseOptions?.coerced) {
      try {
        return this.parse(this.coerceFn(value), { ...parseOptions, coerced: true });
      } catch (e) {
        if (e instanceof ValidationError) {
          throw e;
        }
        throw new ValidationError('error coercing string value to array - ' + e.message);
      }
    }
    if (!Array.isArray(value)) {
      throw this.typeError('expected an array but got ' + typeOf(value));
    }
    const convValue: any = (this as any)[coercionTypeSymbol] ? [] : undefined;
    for (let i = 0; i < value.length; i++) {
      try {
        if (convValue) {
          convValue[i] = this._parse(value[i]);
        } else {
          this._parse(value[i], parseOptions);
        }
      } catch (err) {
        const path = err.path ? [i, ...err.path] : [i];
        const msg = parseOptions?.suppressPathErrMsg
          ? err.message
          : `error at ${prettyPrintPath(path)} - ${err.message}`;
        throw new ValidationError(msg, path);
      }
    }
    if (this.predicates) {
      applyPredicates(this.predicates, convValue || value);
    }
    return convValue || value;
  }
  length(value: number, errMsg?: ErrMsg<Infer<T>[]>): ArrayType<T> {
    return this.withPredicate(
      arr => arr.length === value,
      errMsg || (arr => `expected array to have length ${value} but got ${arr.length}`)
    );
  }
  min(value: number, errMsg?: ErrMsg<Infer<T>[]>): ArrayType<T> {
    return this.withPredicate(
      arr => arr.length >= value,
      errMsg || (arr => `expected array to have length greater than or equal to ${value} but got ${arr.length}`)
    );
  }
  max(value: number, errMsg?: ErrMsg<Infer<T>[]>): ArrayType<T> {
    return this.withPredicate(
      arr => arr.length <= value,
      errMsg || (arr => `expected array to have length less than or equal to ${value} but got ${arr.length}`)
    );
  }
  unique(): ArrayType<T> {
    return this.withPredicate(arr => {
      const seenMap = new Map<any, number[]>();
      arr.forEach((elem, idx) => {
        const seenAt = seenMap.get(elem);
        if (seenAt) {
          throw new ValidationError(
            `expected array to be unique but found same element at indexes ${seenAt[0]} and ${idx}`
          );
        }
        seenMap.set(elem, [idx]);
      });
      return true;
    });
  }
  and<K extends AnyType>(schema: K): IntersectionResult<this, K> {
    if (schema instanceof ArrayType) {
      return new ArrayType(this.schema.and(schema.schema)) as any;
    }
    return new IntersectionType(this, schema) as any;
  }
  coerce(fn: (value: string) => Infer<T>[]): ArrayType<T> {
    return new ArrayType(this.schema, {
      default: this.defaultValue,
      coerce: fn,
      predicate: this.predicates || undefined,
    });
  }
  withPredicate(fn: Predicate<Infer<T>[]>['func'], errMsg?: ErrMsg<Infer<T>[]>): ArrayType<T> {
    return withPredicate(this, { func: fn, errMsg });
  }
  default(value: Infer<T>[] | (() => Infer<T>[])): ArrayType<T> {
    return withDefault(this, value);
  }
}

type IntersecWrapper<A extends any, B extends any> = A extends AnyType
  ? B extends AnyType
    ? IntersectionResult<A, B>
    : never
  : never;

type JoinLeft<A extends AnyType[], B extends AnyType[]> = {
  [idx in keyof A]: idx extends keyof B ? IntersecWrapper<A[idx], B[idx]> : A[idx];
};
type JoinRight<A extends AnyType[], B extends AnyType[]> = {
  [idx in keyof B]: idx extends keyof A ? IntersecWrapper<A[idx], B[idx]> : B[idx];
};
type Join<A extends AnyType[], B extends AnyType[]> = JoinLeft<A, B> & JoinRight<A, B>;

type InferTuple<T extends AnyType[]> = {
  [key in keyof T]: T[key] extends Type<infer K> ? K : never;
};

type TupleOptions<T extends any[]> = {
  predicate?: Predicate<InferTuple<T>>['func'] | Predicate<InferTuple<T>> | Predicate<InferTuple<T>>[];
  default?: InferTuple<T> | (() => InferTuple<T>);
};

export class TupleType<T extends AnyType[]>
  extends Type<InferTuple<T>>
  implements WithPredicate<InferTuple<T>>, Defaultable<InferTuple<T>> {
  private readonly predicates: Predicate<InferTuple<T>>[] | null;
  private readonly defaultValue?: InferTuple<T> | (() => InferTuple<T>);
  constructor(private readonly schemas: T, opts?: TupleOptions<T>) {
    super();
    this.predicates = normalizePredicates(opts?.predicate);
    this.defaultValue = opts?.default;
    (this as any)[coercionTypeSymbol] =
      this.defaultValue !== undefined || schemas.some(schema => (schema as any)[coercionTypeSymbol]);
  }
  parse(
    value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue
  ): InferTuple<T> {
    if (!Array.isArray(value)) {
      throw this.typeError('expected tuple value to be type array but got ' + typeOf(value));
    }
    if (value.length !== this.schemas.length) {
      throw this.typeError(`expected tuple length to be ${this.schemas.length} but got ${value.length}`);
    }
    const convValue: any = (this as any)[coercionTypeSymbol] ? [] : undefined;
    for (let i = 0; i < this.schemas.length; i++) {
      try {
        if (convValue) {
          convValue.push(this.schemas[i].parse(value[i]));
        } else {
          this.schemas[i].parse(value[i]);
        }
      } catch (err) {
        throw new ValidationError(`error parsing tuple at index ${i}: ${err.message}`);
      }
    }
    if (this.predicates) {
      applyPredicates(this.predicates, convValue || value);
    }
    return convValue || (value as any);
  }
  and<K extends AnyType>(
    schema: K
  ): K extends TupleType<any>
    ? K extends TupleType<infer Arr>
      ? TupleType<Join<T, Arr>>
      : never
    : IntersectionType<this, K> {
    if (schema instanceof TupleType) {
      const otherSchemaArray = (schema as any).schemas;
      const nextSchemasArray: AnyType[] = [];
      for (let i = 0; i < Math.max(this.schemas.length, otherSchemaArray.length); i++) {
        const current = this.schemas[i];
        const other = otherSchemaArray[i];
        if (current && other) {
          nextSchemasArray.push(current.and(other));
        } else if (current) {
          nextSchemasArray.push(current);
        } else {
          nextSchemasArray.push(other);
        }
      }
      return new TupleType(nextSchemasArray) as any;
    }
    return new IntersectionType(this, schema) as any;
  }
  withPredicate(fn: Predicate<InferTuple<T>>['func'], errMsg?: ErrMsg<InferTuple<T>>): TupleType<T> {
    return withPredicate(this, { func: fn, errMsg });
  }
  default(value: InferTuple<T> | (() => InferTuple<T>)): TupleType<T> {
    return withDefault(this, value);
  }
}

type InferTupleUnion<T extends any[]> = Infer<T[number]>;
export type UnionOptions<T extends any[]> = {
  strict?: boolean;
  default?: InferTupleUnion<T> | (() => InferTupleUnion<T>);
};

type UnionIntersection<U extends UnionType<any>, T extends AnyType> = U extends UnionType<infer Schemas>
  ? UnionType<
      { [key in keyof Schemas]: Schemas[key] extends AnyType ? IntersectionResult<Schemas[key], T> : Schemas[key] }
    >
  : never;

export class UnionType<T extends AnyType[]>
  extends Type<InferTupleUnion<T>>
  implements Defaultable<InferTupleUnion<T>> {
  private readonly strict: boolean;
  private readonly defaultValue?: InferTupleUnion<T> | (() => InferTupleUnion<T>);
  constructor(private readonly schemas: T, opts?: UnionOptions<T>) {
    super();
    this.strict = opts?.strict !== false;
    this.defaultValue = opts?.default;
    (this as any)[coercionTypeSymbol] =
      opts?.default !== undefined || schemas.some(schema => (schema as any)[coercionTypeSymbol]);
  }
  parse(
    //@ts-ignore
    value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue
  ): InferTupleUnion<T> {
    const errors = new Set<string>();
    for (const schema of this.schemas) {
      try {
        if (this.strict === false && schema instanceof ObjectType) {
          return schema.parse(value, { allowUnknown: true }) as any;
        }
        return schema.parse(value);
      } catch (err) {
        errors.add(err.message);
      }
    }
    const messages = Array.from(errors);
    if (messages.length === 1) {
      throw this.typeError(messages[0]);
    }
    throw this.typeError('No union satisfied:\n  ' + messages.join('\n  '));
  }
  and<K extends AnyType>(schema: K): UnionIntersection<UnionType<T>, K> {
    const schemaIntersections: any = this.schemas.map(x => x.and(schema));
    return new UnionType(schemaIntersections, { strict: this.strict }) as any;
  }
  default(value: InferTupleUnion<T> | (() => InferTupleUnion<T>)): UnionType<T> {
    return withDefault(this, value);
  }
}

function asUnionType(schema: AnyType): UnionType<any> | null {
  if (schema instanceof UnionType) {
    return schema;
  }
  if (schema instanceof IntersectionType && (schema as any)._schema instanceof UnionType) {
    return (schema as any)._schema;
  }
  return null;
}

export class IntersectionType<T extends AnyType, K extends AnyType> extends Type<Flat<Infer<T> & Infer<K>>> {
  private _schema: AnyType | null;

  constructor(private readonly left: T, private readonly right: K) {
    super();

    this[coercionTypeSymbol] = (this.left as any)[coercionTypeSymbol] && (this.right as any)[coercionTypeSymbol];

    // if (this[coercionTypeSymbol] && Object.getPrototypeOf(this.left) !== Object.getPrototypeOf(this.right)) {
    // }

    (this as any)[allowUnknownSymbol] = !!(
      (this.left as any)[allowUnknownSymbol] || (this.right as any)[allowUnknownSymbol]
    );

    if ((this.left as any)[shapekeysSymbol] && (this.right as any)[shapekeysSymbol]) {
      //@ts-ignore
      this[shapekeysSymbol] = Array.from(
        new Set<string>([...(this.left as any)[shapekeysSymbol], ...(this.right as any)[shapekeysSymbol]])
      );
    }

    this._schema = (() => {
      if (this.left instanceof MTypeClass) {
        this.left.and(this.right); // throw error
      }
      if (this.right instanceof MTypeClass) {
        this.right.and(this.left); // throw err
      }

      const leftUnion = asUnionType(this.left);
      if (leftUnion) {
        return leftUnion.and(this.right);
      }
      const rightUnion = asUnionType(this.right);
      if (rightUnion) {
        return rightUnion.and(this.left);
      }
      if (this.left instanceof PartialType) {
        return new IntersectionType((this.left as any).schema, this.right);
      }
      if (this.right instanceof PartialType) {
        return new IntersectionType(this.left, (this.right as any).schema);
      }
      return null;
    })();
  }

  parse(value: unknown, opts?: PathOptions & ObjectOptions<any>): Flat<Infer<T> & Infer<K>> {
    const allowUnknown = opts?.allowUnknown || (this as any)[allowUnknownSymbol];
    if (!allowUnknown && (this as any)[shapekeysSymbol]) {
      const expectedShapeKeys: string[] = (this as any)[shapekeysSymbol];
      const invalidKeys = Object.keys(value as any).filter((key: string) => !expectedShapeKeys.includes(key));
      if (invalidKeys.length > 0) {
        throw this.typeError('unexpected keys on object ' + JSON.stringify(invalidKeys));
      }
    }

    if (this._schema) {
      // @ts-ignore
      return this._schema.parse(value, opts);
    }

    this.left.parse(value);
    this.right.parse(value);
    return value as any;
  }

  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

type ValueOf<T> = T[keyof T];
type EnumCoerceOptions = 'upper' | 'lower';
export type EnumOptions<T> = {
  coerce?: EnumCoerceOptions;
  defaultValue?: ValueOf<T> | (() => ValueOf<T>);
};

export class EnumType<T> extends Type<ValueOf<T>> implements Defaultable<ValueOf<T>> {
  private values: any[];
  private readonly defaultValue?: ValueOf<T> | (() => ValueOf<T>);
  private readonly coerceOpt?: EnumCoerceOptions;
  constructor(private readonly enumeration: T, opts: EnumOptions<T> = {}) {
    super();
    this.values = Object.values(enumeration);
    this.coerceOpt = opts.coerce;
    this.defaultValue = opts.defaultValue;
    (this as any)[coercionTypeSymbol] = this.defaultValue !== undefined;
  }
  parse(
    //@ts-ignore
    value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue
  ): ValueOf<T> {
    let coercedValue = value;
    if (typeof value === 'string' && this.coerceOpt === 'lower') {
      coercedValue = value.toLowerCase();
    } else if (typeof value === 'string' && this.coerceOpt === 'upper') {
      coercedValue = value.toUpperCase();
    }
    if (!this.values.includes(coercedValue)) {
      throw this.typeError(`error ${JSON.stringify(value)} not part of enum values`);
    }
    return coercedValue as ValueOf<T>;
  }
  check(value: unknown): value is ValueOf<T> {
    return this.values.includes(value);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(value: ValueOf<T> | (() => ValueOf<T>)): EnumType<T> {
    return withDefault(this, value);
  }
  coerce(opt: EnumCoerceOptions): EnumType<T> {
    return new EnumType(this.enumeration, { defaultValue: this.defaultValue, coerce: opt });
  }
}

type DeepPartial<T> = {
  [key in keyof T]?: T[key] extends Object ? Eval<DeepPartial<T[key]>> : T[key];
};
export type PartialOpts = { deep: boolean };

function toPartialSchema(schema: AnyType, opts?: PartialOpts): AnyType {
  if (schema instanceof ObjectType) {
    return schema.partial({ deep: opts?.deep || false });
  }
  if (schema instanceof IntersectionType) {
    return new IntersectionType(
      toPartialSchema((schema as any).left, opts),
      toPartialSchema((schema as any).right, opts)
    );
  }
  if (schema instanceof UnionType) {
    return new UnionType((schema as any).schemas.map((schema: AnyType) => toPartialSchema(schema, opts)));
  }
  if (schema instanceof ArrayType) {
    if (opts?.deep) {
      return new ArrayType(toPartialSchema((schema as any).schema, opts).optional());
    }
    return new ArrayType((schema as any).schema.optional());
  }
  return schema;
}

export class PartialType<T extends AnyType, K extends PartialOpts> extends Type<
  K extends { deep: true } ? Eval<DeepPartial<Infer<T>>> : Partial<Infer<T>>
> {
  private readonly schema: AnyType;
  constructor(schema: T, opts?: K) {
    super();
    this.schema = toPartialSchema(schema, opts);
    (this as any)[coercionTypeSymbol] = (this.schema as any)[coercionTypeSymbol];
  }
  parse(value: unknown): K extends { deep: true } ? Eval<DeepPartial<Infer<T>>> : Partial<Infer<T>> {
    return this.schema.parse(value);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

export class LazyType<T extends () => AnyType> extends Type<Infer<ReturnType<T>>> {
  constructor(private readonly fn: T) {
    super();
    // Since we can't know what the schema is we can't assume its not a coercionType and we need to disable the optimization
    (this as any)[coercionTypeSymbol] = true;
  }
  parse(value: unknown, opts?: PathOptions): Infer<ReturnType<T>> {
    const schema = this.fn();
    if (opts?.suppressPathErrMsg && schema instanceof ObjectType) {
      return schema.parse(value, opts) as any;
    }
    return schema.parse(value);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}
