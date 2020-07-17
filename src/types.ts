export abstract class Type<T> {
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
      return this;
    }
    return new OptionalType(this);
  }
  nullable(this: NullableType<any>): this;
  nullable(): NullableType<this>;
  nullable(): any {
    if (this instanceof NullableType) {
      return this;
    }
    return new NullableType(this);
  }
  try(value: unknown): T | ValidationError {
    try {
      return this.parse(value);
    } catch (err) {
      return err;
    }
  }

  // TODO This sometimes violates the type system when coercion is used
  check(value: unknown): value is T {
    try {
      this.parse(value);
      return true;
    } catch (err) {
      return false;
    }
  }
}

export class ValidationError extends Error {
  name = 'MyZodError';
  path?: (string | number)[];
  constructor(message: string, path?: (string | number)[]) {
    super(message);
    this.path = path;
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

export type Eval<T> = T extends any[] | Date ? T : { [Key in keyof T]: T[Key] } & {};
export type AnyType = Type<any>;
export type Infer<T extends AnyType> = T extends Type<infer K> ? Eval<K> : any;

const allowUnknownSymbol = Symbol.for('allowUnknown');
const shapekeysSymbol = Symbol.for('shapeKeys');
export const coercionTypeSymbol = Symbol.for('coercion');

export type IntersectionResult<T extends AnyType, K extends AnyType> =
  //
  // T extends AnyType
  //   ? K extends AnyType
  T extends ObjectType<any>
    ? K extends ObjectType<any>
      ? T extends ObjectType<infer Shape1>
        ? K extends ObjectType<infer Shape2>
          ? ObjectType<Eval<MergeShapes<Shape1, Shape2>>>
          : never
        : never
      : IntersectionType<T, K>
    : T extends ArrayType<any>
    ? K extends ArrayType<any>
      ? T extends ArrayType<infer S1>
        ? K extends ArrayType<infer S2>
          ? ArrayType<IntersectionResult<S1, S2>>
          : never
        : never
      : IntersectionType<T, K> //
    : T extends TupleType<any>
    ? K extends TupleType<any>
      ? T extends TupleType<infer S1>
        ? K extends TupleType<infer S2>
          ? TupleType<Join<S1, S2>>
          : never
        : never
      : IntersectionType<T, K>
    : IntersectionType<T, K>;
//   : never
// : never;

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

interface Defaultable<T> {
  default(value: T | (() => T)): any;
}

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
  private readonly predicates: Predicate<string>[] | null;
  private readonly defaultValue?: string | (() => string);
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
      throw new ValidationError('expected type to be string but got ' + typeOf(value));
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
    return new StringType({
      predicate: appendPredicate(this.predicates, { func: fn, errMsg }),
      default: this.defaultValue,
    });
  }
  default(value: string | (() => string)): StringType {
    return new StringType({
      predicate: this.predicates || undefined,
      default: value,
    });
  }
}

export class BooleanType extends Type<boolean> implements Defaultable<boolean> {
  constructor(private readonly defaultValue?: boolean | (() => boolean)) {
    super();
    (this as any)[coercionTypeSymbol] = defaultValue !== undefined;
  }
  parse(value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue): boolean {
    if (typeof value !== 'boolean') {
      throw new ValidationError('expected type to be boolean but got ' + typeOf(value));
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(value: boolean | (() => boolean)): BooleanType {
    return new BooleanType(value);
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
  private readonly predicates: Predicate<number>[] | null;
  private readonly defaultValue?: number | (() => number);
  private readonly coerceFlag?: boolean;
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
        throw new ValidationError('expected type to be number but got string');
      }
      return this.parse(number);
    }
    if (typeof value !== 'number') {
      throw new ValidationError('expected type to be number but got ' + typeOf(value));
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
    return new NumberType({
      coerce: this.coerceFlag,
      default: this.defaultValue,
      predicate: appendPredicate(this.predicates, { func: fn, errMsg }),
    });
  }
  default(value: number | (() => number)): NumberType {
    return new NumberType({
      coerce: this.coerceFlag,
      default: value,
      predicate: this.predicates || undefined,
    });
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
    (this as any)[coercionTypeSymbol] = true;
    this.predicates = normalizePredicates(opts.predicate);
    this.defaultValue = opts.default;
  }
  parse(value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue): bigint {
    try {
      const int = BigInt(value);
      if (this.predicates) {
        applyPredicates(this.predicates, int);
      }
      return int;
    } catch (err) {
      if (err instanceof ValidationError) {
        throw err;
      }
      throw new ValidationError('expected type to be bigint interpretable - ' + err.message.toLowerCase());
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
    return new BigIntType({
      default: this.defaultValue,
      predicate: appendPredicate(this.predicates, { func: fn, errMsg }),
    });
  }
  default(value: bigint | (() => bigint)): BigIntType {
    return new BigIntType({ predicate: this.predicates || undefined, default: value });
  }
}

export class UndefinedType extends Type<undefined> {
  parse(value: unknown): undefined {
    if (value !== undefined) {
      throw new ValidationError('expected type to be undefined but got ' + typeOf(value));
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

export class NullType extends Type<null> implements Defaultable<null> {
  constructor(private readonly defaulted?: boolean) {
    super();
    (this as any)[coercionTypeSymbol] = !!defaulted;
  }
  parse(value: unknown = this.defaulted ? null : undefined): null {
    if (value !== null) {
      throw new ValidationError('expected type to be null but got ' + typeOf(value));
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(): NullType {
    return new NullType(true);
  }
}

export type Literal = string | number | boolean | undefined | null;

export class LiteralType<T extends Literal> extends Type<T> implements Defaultable<T> {
  private readonly defaultValue?: T;
  constructor(private readonly literal: T, defaulted?: boolean) {
    super();
    this.defaultValue = defaulted ? this.literal : undefined;
    (this as any)[coercionTypeSymbol] = !!defaulted;
  }
  parse(value: unknown = this.defaultValue): T {
    if (value !== this.literal) {
      const typeofValue = typeof value !== 'object' ? JSON.stringify(value) : typeOf(value);
      throw new ValidationError(`expected value to be literal ${JSON.stringify(this.literal)} but got ${typeofValue}`);
    }
    return value as T;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(): LiteralType<T> {
    return new LiteralType(this.literal, true);
  }
}

export class UnknownType extends Type<unknown> implements Defaultable<unknown> {
  constructor(private readonly defaultValue?: any) {
    super();
    (this as any)[coercionTypeSymbol] = defaultValue !== undefined;
  }
  parse(value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue): unknown {
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(value: any | (() => any)) {
    return new UnknownType(value);
  }
}

export class OptionalType<T extends AnyType> extends Type<Infer<T> | undefined> {
  constructor(private readonly schema: T) {
    super();
    (this as any)[coercionTypeSymbol] = (this.schema as any)[coercionTypeSymbol];
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
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

type Nullable<T> = T | null;
export class NullableType<T extends AnyType> extends Type<Infer<T> | null> implements Defaultable<Infer<T> | null> {
  constructor(
    private readonly schema: T,
    private readonly defaultValue?: Nullable<Infer<T>> | (() => Nullable<Infer<T>>)
  ) {
    super();
    (this as any)[coercionTypeSymbol] = this.defaultValue !== undefined || (this.schema as any)[coercionTypeSymbol];
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
  default(value: Nullable<Infer<T>> | (() => Nullable<Infer<T>>)) {
    return new NullableType(this.schema, value);
  }
}

// Non Primitive types

export type DateOptions = {
  predicate?: Predicate<Date>['func'] | Predicate<Date> | Predicate<Date>[];
  default?: Date | (() => Date);
};

const stringToDate = (str: string): Date => {
  const date = new Date(str);
  if (isNaN(date.getTime())) {
    throw new ValidationError(`expected date string to be valid date`);
  }
  return date;
};

const assertDate = (date: any): Date => {
  if (!(date instanceof Date)) {
    throw new ValidationError('expected type Date but got ' + typeOf(date));
  }
  return date;
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
    const date = typeof value === 'string' ? stringToDate(value) : assertDate(value);
    if (this.predicates) {
      applyPredicates(this.predicates, date);
    }
    return date;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  withPredicate(fn: Predicate<Date>['func'], errMsg?: ErrMsg<Date>): DateType {
    return new DateType({
      default: this.defaultValue,
      predicate: appendPredicate(this.predicates, { func: fn, errMsg }),
    });
  }
  default(value: Date | (() => Date)): DateType {
    return new DateType({ default: value, predicate: this.predicates || undefined });
  }
}

export const keySignature = Symbol.for('keySignature');
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

type InferObjectShape<T extends ObjectShape> = Eval<
  InferKeySignature<T> &
    { [key in OptionalKeys<T>]?: T[key] extends Type<infer K> ? K : any } &
    { [key in RequiredKeys<T>]: T[key] extends Type<infer K> ? K : any }
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
};

export class ObjectType<T extends ObjectShape> extends Type<InferObjectShape<T>>
  implements WithPredicate<InferObjectShape<T>>, Defaultable<InferObjectShape<T>> {
  private readonly predicates: Predicate<InferObjectShape<T>>[] | null;
  private readonly defaultValue?: InferObjectShape<T> | (() => InferObjectShape<T>);
  private readonly allowUnknown: boolean;
  constructor(private readonly objectShape: T, opts?: ObjectOptions<T>) {
    super();
    this.predicates = normalizePredicates(opts?.predicate);
    this.defaultValue = opts?.default;
    this.allowUnknown = opts?.allowUnknown === true;
    const keys = Object.keys(this.objectShape);
    (this as any)[keySignature] = this.objectShape[keySignature];
    (this as any)[allowUnknownSymbol] = this.allowUnknown;
    (this as any)[shapekeysSymbol] = keys;
    (this as any)[coercionTypeSymbol] =
      this.defaultValue !== undefined ||
      Object.values(this.objectShape).some(schema => (schema as any)[coercionTypeSymbol]) ||
      !!(this.objectShape[keySignature] && (this.objectShape[keySignature] as any)[coercionTypeSymbol]);
  }
  parse(
    value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue,
    parseOpts: ObjectOptions<any> & PathOptions = {}
  ): InferObjectShape<T> {
    if (typeof value !== 'object') {
      throw new ValidationError('expected type to be object but got ' + typeOf(value));
    }
    if (value === null) {
      throw new ValidationError('expected object but got null');
    }
    if (Array.isArray(value)) {
      throw new ValidationError('expected type to be regular object but got array');
    }

    const keys: string[] = (this as any)[shapekeysSymbol];
    const allowUnknown = typeof parseOpts.allowUnknown === 'boolean' ? parseOpts.allowUnknown : this.allowUnknown;
    const keySig = this.objectShape[keySignature];

    if (!allowUnknown && !keySig) {
      const illegalKeys: string[] = [];
      for (const k in value) {
        if (!keys.includes(k)) {
          illegalKeys.push(k);
        }
      }
      if (illegalKeys.length > 0) {
        throw new ValidationError('unexpected keys on object: ' + JSON.stringify(illegalKeys));
      }
    }

    if (keys.length === 0 && keySig) {
      const convVal: any = (this as any)[coercionTypeSymbol] ? {} : undefined;
      for (const key in value) {
        try {
          if (convVal) {
            convVal[key] = (keySig as any).parse((value as any)[key], { suppressPathErrMsg: true });
          } else {
            (keySig as any).parse((value as any)[key], { suppressPathErrMsg: true });
          }
        } catch (err) {
          const path = err.path ? [key, ...err.path] : [key];
          const msg = parseOpts.suppressPathErrMsg
            ? err.message
            : `error parsing object at path: "${prettyPrintPath(path)}" - ${err.message}`;
          throw new ValidationError(msg, path);
        }
      }
      if (this.predicates) {
        applyPredicates(this.predicates, convVal || value);
      }
      return convVal || value;
    }

    if (keySig) {
      const convVal: any = (this as any)[coercionTypeSymbol] ? {} : undefined;
      for (const key in value) {
        try {
          if (convVal) {
            // @ts-ignore
            convVal[key] = (this.objectShape[key] || keySig).parse((value as any)[key], { suppressPathErrMsg: true });
          } else {
            // @ts-ignore
            (this.objectShape[key] || keySig).parse((value as any)[key], { suppressPathErrMsg: true });
          }
        } catch (err) {
          const path = err.path ? [key, ...err.path] : [key];
          const msg = parseOpts.suppressPathErrMsg
            ? err.message
            : `error parsing object at path: "${prettyPrintPath(path)}" - ${err.message}`;
          throw new ValidationError(msg, path);
        }
      }
      if (this.predicates) {
        applyPredicates(this.predicates, convVal || value);
      }
      return convVal || value;
    }

    const convVal: any = (this as any)[coercionTypeSymbol] ? (allowUnknown ? { ...value } : {}) : undefined;

    for (const key of keys) {
      try {
        const schema = (this.objectShape as any)[key];
        if (schema instanceof UnknownType && !(value as any).hasOwnProperty(key)) {
          throw new ValidationError(`expected key "${key}" of unknown type to be present on object`);
        }
        if (convVal) {
          convVal[key] = schema.parse((value as any)[key], { suppressPathErrMsg: true });
        } else {
          schema.parse((value as any)[key], { suppressPathErrMsg: true });
        }
      } catch (err) {
        const path = err.path ? [key, ...err.path] : [key];
        const msg = parseOpts.suppressPathErrMsg
          ? err.message
          : `error parsing object at path: "${prettyPrintPath(path)}" - ${err.message}`;
        throw new ValidationError(msg, path);
      }
    }
    if (this.predicates) {
      applyPredicates(this.predicates, convVal || value);
    }
    return convVal || value;
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
      Eval<
        Pick<T, Extract<StringTypes<keyof T>, ToUnion<typeof keys>>> &
          (T extends { [keySignature]: AnyType }
            ? T extends { [keySignature]: infer KeySig }
              ? { [key in Exclude<ToUnion<typeof keys>, keyof T>]: KeySig }
              : {}
            : {})
      >
    >
  ): ObjectType<
    Eval<
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
  ): ObjectType<Eval<Omit<T, ToUnion<typeof keys>>>> {
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
  ): ObjectType<Eval<DeepPartialShape<T>>>;
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
    return new ObjectType(shape as any, { allowUnknown: this.allowUnknown });
  }

  shape(): T {
    return Object.assign({}, this.objectShape);
  }

  withPredicate(fn: Predicate<InferObjectShape<T>>['func'], errMsg?: ErrMsg<InferObjectShape<T>>): ObjectType<T> {
    return new ObjectType(this.objectShape, {
      default: this.defaultValue,
      allowUnknown: this.allowUnknown,
      predicate: appendPredicate(this.predicates, { func: fn, errMsg }),
    });
  }

  default(value: InferObjectShape<T> | (() => InferObjectShape<T>)): ObjectType<T> {
    return new ObjectType(this.objectShape, {
      default: value,
      allowUnknown: this.allowUnknown,
      predicate: this.predicates || undefined,
    });
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

export class ArrayType<T extends AnyType> extends Type<Infer<T>[]>
  implements WithPredicate<Infer<T>[]>, Defaultable<Infer<T>[]> {
  private readonly predicates: Predicate<Infer<T>[]>[] | null;
  private readonly defaultValue?: Infer<T>[] | (() => Infer<T>[]);
  private readonly coerceFn?: (v: any) => Infer<T>[];
  private readonly _parse: (value: unknown, parseOptions?: PathOptions & ObjectOptions<any>) => any;

  constructor(private readonly schema: T, opts: ArrayOptions<T> = {}) {
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
      self = this.length(opts.length);
    }
    if (typeof opts.min !== 'undefined') {
      self = this.min(opts.min);
    }
    if (typeof opts.max !== 'undefined') {
      self = this.max(opts.max);
    }
    if (opts.unique === true) {
      self = this.unique();
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
      throw new ValidationError('expected an array but got ' + typeOf(value));
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
    return new ArrayType(this.schema, {
      default: this.defaultValue,
      coerce: this.coerceFn,
      predicate: appendPredicate(this.predicates, { func: fn, errMsg }),
    });
  }
  default(value: Infer<T>[] | (() => Infer<T>[])): ArrayType<T> {
    return new ArrayType(this.schema, {
      default: value,
      predicate: this.predicates || undefined,
    });
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

export class TupleType<T extends AnyType[]> extends Type<InferTuple<T>>
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
      throw new ValidationError('expected tuple value to be type array but got ' + typeOf(value));
    }
    if (value.length !== this.schemas.length) {
      throw new ValidationError(`expected tuple length to be ${this.schemas.length} but got ${value.length}`);
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
    return new TupleType(this.schemas, {
      default: this.defaultValue,
      predicate: appendPredicate(this.predicates, { func: fn, errMsg }),
    });
  }
  default(value: InferTuple<T> | (() => InferTuple<T>)): TupleType<T> {
    return new TupleType(this.schemas, {
      default: value,
      predicate: this.predicates || undefined,
    });
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

export class UnionType<T extends AnyType[]> extends Type<InferTupleUnion<T>>
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
      throw new ValidationError(messages[0]);
    }
    throw new ValidationError('No union satisfied:\n  ' + messages.join('\n  '));
  }
  and<K extends AnyType>(schema: K): UnionIntersection<UnionType<T>, K> {
    const schemaIntersections: any = this.schemas.map(x => x.and(schema));
    return new UnionType(schemaIntersections, { strict: this.strict }) as any;
  }
  default(value: InferTupleUnion<T> | (() => InferTupleUnion<T>)): UnionType<T> {
    return new UnionType(this.schemas, { strict: this.strict, default: value });
  }
}

export class IntersectionType<T extends AnyType, K extends AnyType> extends Type<Eval<Infer<T> & Infer<K>>> {
  private readonly _parse: (value: unknown, opts?: PathOptions) => any;

  constructor(private readonly left: T, private readonly right: K) {
    super();
    (this as any)[coercionTypeSymbol] =
      (this.left as any)[coercionTypeSymbol] || (this.right as any)[coercionTypeSymbol];
    (this as any)[allowUnknownSymbol] = !!(
      (this.left as any)[allowUnknownSymbol] || (this.right as any)[allowUnknownSymbol]
    );
    if ((this.left as any)[shapekeysSymbol] && (this.right as any)[shapekeysSymbol]) {
      //@ts-ignore
      this[shapekeysSymbol] = Array.from(
        new Set<string>([...(this.left as any)[shapekeysSymbol], ...(this.right as any)[shapekeysSymbol]])
      );
    }

    this._parse = (() => {
      // TODO Investigate why I unwrap partials in a new intersection again
      if (this.left instanceof UnionType) {
        const _schema = this.left.and(this.right);
        return (value: unknown) => _schema.parse(value);
      }
      if (this.right instanceof UnionType) {
        const _schema = this.right.and(this.left);
        return (value: unknown) => _schema.parse(value);
      }
      if (this.left instanceof PartialType) {
        const _schema = new IntersectionType((this.left as any).schema, this.right);
        return (value: unknown) => _schema.parse(value) as any;
      }
      if (this.right instanceof PartialType) {
        const _schema = new IntersectionType(this.left, (this.right as any).schema);
        return (value: unknown) => _schema.parse(value) as any;
      }
      return (value: unknown) => {
        this.left.parse(value);
        this.right.parse(value);
        return value as any;
      };
    })();
  }

  parse(value: unknown, opts?: PathOptions & ObjectOptions<any>): Eval<Infer<T> & Infer<K>> {
    const allowUnknown = opts?.allowUnknown || (this as any)[allowUnknownSymbol];
    if (!allowUnknown && (this as any)[shapekeysSymbol]) {
      const expectedShapeKeys: string[] = (this as any)[shapekeysSymbol];
      const invalidKeys = Object.keys(value as any).filter((key: string) => !expectedShapeKeys.includes(key));
      if (invalidKeys.length > 0) {
        throw new ValidationError('unexpected keys on object ' + JSON.stringify(invalidKeys));
      }
    }
    return this._parse(value, opts);
  }

  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

type ValueOf<T> = T[keyof T];

export class EnumType<T> extends Type<ValueOf<T>> implements Defaultable<ValueOf<T>> {
  private values: any[];
  private readonly defaultValue?: ValueOf<T> | (() => ValueOf<T>);
  constructor(private readonly enumeration: T, defaultValue?: ValueOf<T> | (() => ValueOf<T>)) {
    super();
    this.values = Object.values(enumeration);
    this.defaultValue = defaultValue;
    (this as any)[coercionTypeSymbol] = this.defaultValue !== undefined;
  }
  parse(
    //@ts-ignore
    value: unknown = typeof this.defaultValue === 'function' ? this.defaultValue() : this.defaultValue
  ): ValueOf<T> {
    if (!this.values.includes(value)) {
      throw new ValidationError(`error ${JSON.stringify(value)} not part of enum values`);
    }
    return value as ValueOf<T>;
  }
  check(value: unknown): value is ValueOf<T> {
    return this.values.includes(value);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  default(value: ValueOf<T> | (() => ValueOf<T>)): EnumType<T> {
    return new EnumType(this.enumeration, value);
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
