export abstract class Type<T> {
  constructor() {}
  abstract parse(value: unknown): T;
  abstract and<K extends AnyType>(schema: K): any;
  or<K extends AnyType>(schema: K): UnionType<[Type<T>, K]> {
    return new UnionType([this, schema]);
  }
  optional(): OptionalType<Type<T>> {
    return new OptionalType(this);
  }
  nullable(): NullableType<Type<T>> {
    return new NullableType(this);
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

type AnyType = Type<any>;
type Eval<T> = T extends any[] | Date ? T : { [Key in keyof T]: T[Key] } & {};
export type Infer<T extends AnyType> = T extends Type<infer K> ? Eval<K> : any;

const allowUnknownSymbol = Symbol.for('allowUnknown');
const shapekeysSymbol = Symbol.for('shapeKeys');
const coercionTypeSybol = Symbol.for('coersion');

// Primitives

type StringOptions = Partial<{
  pattern: RegExp;
  min: number;
  max: number;
  predicate: (value: string) => boolean;
  predicateErrMsg: string;
}>;

class StringType extends Type<string> {
  constructor(private opts: StringOptions = {}) {
    super();
  }
  parse(value: unknown): string {
    if (typeof value !== 'string') {
      throw new ValidationError('expected type to be string but got ' + typeOf(value));
    }
    if (typeof this.opts.min === 'number' && value.length < this.opts.min) {
      throw new ValidationError(
        `expected string to have length greater than or equal to ${this.opts.min} but had length ${value.length}`
      );
    }
    if (typeof this.opts.max === 'number' && value.length > this.opts.max) {
      throw new ValidationError(
        `expected string to have length less than or equal to ${this.opts.max} but had length ${value.length}`
      );
    }
    if (this.opts.pattern instanceof RegExp && !this.opts.pattern.test(value)) {
      throw new ValidationError(`expected string to match pattern ${this.opts.pattern} but did not`);
    }
    if (this.opts.predicate) {
      try {
        if (this.opts.predicate(value) === false) {
          throw new ValidationError(this.opts.predicateErrMsg || 'expected string to pass predicate function');
        }
      } catch (err) {
        if (err instanceof ValidationError) {
          throw err;
        }
        throw new ValidationError(err.message);
      }
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  pattern(regexp: RegExp): this {
    this.opts.pattern = regexp;
    return this;
  }
  min(x: number): this {
    this.opts.min = x;
    return this;
  }
  max(x: number): this {
    this.opts.max = x;
    return this;
  }
  predicate(fn: StringOptions['predicate'], errMsg?: string): this {
    this.opts.predicate = fn;
    if (errMsg) {
      this.opts.predicateErrMsg = errMsg;
    }
    return this;
  }
}

class BooleanType extends Type<boolean> {
  parse(value: unknown): boolean {
    if (typeof value !== 'boolean') {
      throw new ValidationError('expected type to be boolean but got ' + typeOf(value));
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

type NumberOptions = Partial<{ min: number; max: number; coerce: boolean }>;

class NumberType extends Type<number> {
  constructor(private opts: NumberOptions = {}) {
    super();
    (this as any)[coercionTypeSybol] = false;
  }
  parse(value: unknown): number {
    if (this.opts.coerce && typeof value === 'string') {
      const number = parseFloat(value);
      if (isNaN(number)) {
        throw new ValidationError('expected type to be number but got string');
      }
      return this.parse(number);
    }

    if (typeof value !== 'number') {
      throw new ValidationError('expected type to be number but got ' + typeOf(value));
    }
    if (typeof this.opts.min === 'number' && value < this.opts.min) {
      throw new ValidationError(`expected number to be greater than or equal to ${this.opts.min} but got ${value}`);
    }
    if (typeof this.opts.max === 'number' && value > this.opts.max) {
      throw new ValidationError(`expected number to be less than or equal to ${this.opts.max} but got ${value}`);
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
  min(x: number): this {
    this.opts.min = x;
    return this;
  }
  max(x: number): this {
    this.opts.max = x;
    return this;
  }
  coerce(value?: boolean): this {
    this.opts.coerce = typeof value === 'undefined' ? true : value;
    (this as any)[coercionTypeSybol] = this.opts.coerce;
    return this;
  }
}

class UndefinedType extends Type<undefined> {
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

class NullType extends Type<null> {
  parse(value: unknown): null {
    if (value !== null) {
      throw new ValidationError('expected type to be null but got ' + typeOf(value));
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

type Literal = string | number | boolean | undefined | null;

class LiteralType<T extends Literal> extends Type<T> {
  constructor(private readonly literal: T) {
    super();
  }
  parse(value: unknown): T {
    if (value !== this.literal) {
      const typeofValue = typeof value !== 'object' ? JSON.stringify(value) : typeOf(value);
      throw new ValidationError(`expected value to be literal ${JSON.stringify(this.literal)} but got ${typeofValue}`);
    }
    return value as T;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

class UnknownType extends Type<unknown> {
  parse(value: unknown): unknown {
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

class OptionalType<T extends AnyType> extends Type<Infer<T> | undefined> {
  constructor(private readonly schema: T) {
    super();
    (this as any)[coercionTypeSybol] = (this.schema as any)[coercionTypeSybol];
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

class NullableType<T extends AnyType> extends Type<Infer<T> | null> {
  constructor(private readonly schema: T) {
    super();
    (this as any)[coercionTypeSybol] = (this.schema as any)[coercionTypeSybol];
    (this as any)[shapekeysSymbol] = (this.schema as any)[shapekeysSymbol];
    (this as any)[allowUnknownSymbol] = (this.schema as any)[allowUnknownSymbol];
  }
  parse(value: unknown): Infer<T> | null {
    if (value === null) {
      return null;
    }
    return this.schema.parse(value);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

// Non Primitive types

class DateType extends Type<Date> {
  constructor() {
    super();
    (this as any)[coercionTypeSybol] = true;
  }
  parse(value: unknown): Date {
    if (typeof value === 'string') {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        throw new ValidationError(`expected date string to be valid date`);
      }
      return date;
    }
    if (!(value instanceof Date)) {
      throw new ValidationError('expected type Date but got ' + typeOf(value));
    }
    return value;
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

type ObjectShape = Record<string, AnyType>;

type OptionalKeys<T extends ObjectShape> = {
  [key in keyof T]: undefined extends Infer<T[key]> ? key : never;
}[keyof T];

type RequiredKeys<T extends ObjectShape> = Exclude<keyof T, OptionalKeys<T>>;

// Infer object used to be this:
// { [key in keyof T]: T[key] extends Type<infer K> ? K : any };
// VSCode seems to have issues and shows errors but typescript compiles correctly so going to put it in
// for now and hope for the best.
type InferObjectShape<T extends ObjectShape> = { [key in OptionalKeys<T>]?: T[key] extends Type<infer K> ? K : any } &
  { [key in RequiredKeys<T>]: T[key] extends Type<infer K> ? K : any };

type PathOptions = { suppressPathErrMsg?: boolean };
type ObjectOptions = { allowUnknown?: boolean };
type ToUnion<T extends any[]> = T[number];
type PartialShape<T extends ObjectShape> = { [key in keyof T]: UnionType<[T[key], UndefinedType]> };
type DeepPartialShape<T extends ObjectShape> = {
  [key in keyof T]: T[key] extends ObjectType<infer K>
    ? OptionalType<ObjectType<DeepPartialShape<K>>>
    : OptionalType<T[key]>;
};

type MergeShapes<T extends ObjectShape, K extends ObjectShape> = {
  [key in keyof (T & K)]: key extends keyof T
    ? key extends keyof K
      ? IntersectionType<T[key], K[key]>
      : T[key]
    : key extends keyof K
    ? K[key]
    : never;
};

class ObjectType<T extends ObjectShape> extends Type<Eval<InferObjectShape<T>>> {
  constructor(private readonly objectShape: T, private readonly opts?: ObjectOptions) {
    super();
    const keys = Object.keys(this.objectShape);
    (this as any)[allowUnknownSymbol] = !!opts?.allowUnknown;
    (this as any)[shapekeysSymbol] = keys;
    (this as any)[coercionTypeSybol] = Object.values(this.objectShape).some(
      schema => (schema as any)[coercionTypeSybol]
    );
  }
  parse(value: unknown, parseOpts: ObjectOptions & PathOptions = {}): Eval<InferObjectShape<T>> {
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
    const allowUnknown = typeof parseOpts.allowUnknown === 'boolean' ? parseOpts.allowUnknown : this.opts?.allowUnknown;

    if (!allowUnknown) {
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

    const convVal: any = (this as any)[coercionTypeSybol] ? (allowUnknown ? { ...value } : {}) : undefined;

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
    return convVal || (value as any);
  }

  and<K extends AnyType>(
    schema: K
  ): K extends ObjectType<any> // If I infer in the first clause it create instantiatore errors with DeepPartialShape in typescript versions <= 3.8
    ? K extends ObjectType<infer L>
      ? ObjectType<Eval<MergeShapes<T, L>>>
      : IntersectionType<this, K>
    : IntersectionType<this, K> {
    if (schema instanceof ObjectType) {
      const keySet = new Set<string>([...(this as any)[shapekeysSymbol], ...(schema as any)[shapekeysSymbol]]);
      const intersectShape = Array.from(keySet).reduce<Record<string, AnyType>>((acc, key) => {
        if (this.objectShape[key] && schema.objectShape[key]) {
          acc[key] = new IntersectionType(this.objectShape[key], schema.objectShape[key]);
        } else if (this.objectShape[key]) {
          acc[key] = this.objectShape[key];
        } else {
          acc[key] = schema.objectShape[key];
        }
        return acc;
      }, {});
      return new ObjectType(intersectShape) as any;
    }
    return new IntersectionType(this, schema) as any;
  }

  pick<K extends keyof T>(keys: K[], opts?: ObjectOptions): ObjectType<Eval<Pick<T, ToUnion<typeof keys>>>> {
    const pickedShape = keys.reduce<any>((acc, key) => {
      acc[key] = this.objectShape[key];
      return acc;
    }, {});
    return new ObjectType(pickedShape, opts);
  }

  omit<K extends keyof T>(keys: K[], opts?: ObjectOptions): ObjectType<Eval<Omit<T, ToUnion<typeof keys>>>> {
    const pickedKeys: K[] = ((this as any)[shapekeysSymbol] as K[]).filter((x: K) => !keys.includes(x));
    return this.pick(pickedKeys, opts) as any;
  }

  partial<K extends ObjectOptions & PartialOpts>(
    opts?: K
  ): ObjectType<Eval<K extends { deep: true } ? DeepPartialShape<T> : PartialShape<T>>> {
    const schema = (toPartialSchema(this, { deep: opts?.deep || false }) as any).objectShape;
    return new ObjectType(schema, { allowUnknown: opts?.allowUnknown });
  }
}

class RecordType<T extends AnyType> extends Type<Record<string, Infer<T>>> {
  private _parse: (value: unknown, opts?: PathOptions & ObjectOptions) => any;
  constructor(private readonly schema: T) {
    super();
    (this as any)[coercionTypeSybol] = (schema as any)[coercionTypeSybol];

    this._parse = (() => {
      if (this.schema instanceof ObjectType) {
        return (value: unknown, opts?: PathOptions & ObjectOptions) =>
          //@ts-ignore
          this.schema.parse(value, { allowUnknown: opts?.allowUnknown, suppressPathErrMsg: true });
      } else if (
        this.schema instanceof ArrayType ||
        this.schema instanceof RecordType ||
        this.schema instanceof IntersectionType
      ) {
        //@ts-ignore
        return (value: unknown) => this.schema.parse(value, { suppressPathErrMsg: true });
      }
      return (value: unknown) => this.schema.parse(value);
    })();
  }
  parse(value: unknown, opts?: PathOptions & ObjectOptions): Record<string, Infer<T>> {
    if (typeof value !== 'object') {
      throw new ValidationError('expected type to be object but got ' + typeOf(value));
    }
    const convValue: any = (this as any)[coercionTypeSybol] ? {} : undefined;
    for (const key in value) {
      try {
        if (convValue) {
          convValue[key] = this._parse((value as any)[key], opts);
        } else {
          this._parse((value as any)[key], opts);
        }
      } catch (err) {
        const path = err.path ? [key, ...err.path] : [key];
        const msg = opts?.suppressPathErrMsg
          ? err.message
          : `error parsing record at path "${prettyPrintPath(path)}" - ${err.message}`;
        throw new ValidationError(msg, path);
      }
    }
    return convValue || (value as any);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

type ArrayOptions = Partial<{
  length: number;
  min: number;
  max: number;
  unique: boolean;
}>;

class ArrayType<T extends AnyType> extends Type<Infer<T>[]> {
  private readonly _parse: (value: unknown, parseOptions?: PathOptions & ObjectOptions) => any;
  constructor(private readonly schema: T, private readonly opts: ArrayOptions = {}) {
    super();
    (this as any)[coercionTypeSybol] = (this.schema as any)[coercionTypeSybol];
    this._parse =
      this.schema instanceof ObjectType || this.schema instanceof ArrayType || this.schema instanceof LazyType
        ? (elem: unknown, parseOptions?: ObjectOptions) =>
            (this.schema.parse as any)(elem, { allowUnknown: parseOptions?.allowUnknown, suppressPathErrMsg: true })
        : (elem: unknown) => this.schema.parse(elem);
  }
  parse(value: unknown, parseOptions?: PathOptions & ObjectOptions): Infer<T>[] {
    if (!Array.isArray(value)) {
      throw new ValidationError('expected an array but got ' + typeOf(value));
    }
    if (typeof this.opts.length === 'number' && this.opts.length >= 0 && value.length !== this.opts.length) {
      throw new ValidationError(`expected array to have length ${this.opts.length} but got ${value.length}`);
    }
    if (typeof this.opts.min === 'number' && value.length < this.opts.min) {
      throw new ValidationError(
        `expected array to have length greater than or equal to ${this.opts.min} but got ${value.length}`
      );
    }
    if (typeof this.opts.max === 'number' && value.length > this.opts.max) {
      throw new ValidationError(
        `expected array to have length less than or equal to ${this.opts.max} but got ${value.length}`
      );
    }
    if (this.opts.unique === true && new Set(value).size !== value.length) {
      const seenMap = new Map<any, number[]>();
      value.forEach((elem, idx) => {
        const seenAt = seenMap.get(elem);
        if (!seenAt) {
          seenMap.set(elem, [idx]);
        } else {
          throw new ValidationError(
            `expected array to be unique but found same element at indexes ${seenAt[0]} and ${idx}`
          );
        }
      });
    }
    const convValue: any = (this as any)[coercionTypeSybol] ? [] : undefined;
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
    return convValue || value;
  }
  length(value: number): this {
    this.opts.length = value;
    return this;
  }
  min(value: number): this {
    this.opts.min = value;
    return this;
  }
  max(value: number): this {
    this.opts.max = value;
    return this;
  }
  unique(value: boolean = true): this {
    this.opts.unique = value;
    return this;
  }
  and<K extends AnyType>(
    schema: K
  ): K extends ArrayType<any>
    ? K extends ArrayType<infer L>
      ? L extends ObjectType<infer O1>
        ? T extends ObjectType<infer O2>
          ? ArrayType<ObjectType<MergeShapes<O1, O2>>>
          : ArrayType<IntersectionType<T, L>>
        : ArrayType<IntersectionType<T, L>>
      : IntersectionType<this, K>
    : IntersectionType<this, K> {
    if (schema instanceof ArrayType) {
      return new ArrayType(this.schema.and(schema.schema)) as any;
    }
    return new IntersectionType(this, schema) as any;
  }
}

type InferTuple<T extends [AnyType, ...AnyType[]] | []> = {
  [key in keyof T]: T[key] extends Type<infer K> ? K : never;
};

class TupleType<T extends [AnyType, ...AnyType[]] | []> extends Type<InferTuple<T>> {
  constructor(private readonly schemas: T) {
    super();
    (this as any)[coercionTypeSybol] = schemas.some(schema => (schema as any)[coercionTypeSybol]);
  }
  parse(value: unknown): InferTuple<T> {
    if (!Array.isArray(value)) {
      throw new ValidationError('expected tuple value to be type array but got ' + typeOf(value));
    }
    if (value.length !== this.schemas.length) {
      throw new ValidationError(`expected tuple length to be ${this.schemas.length} but got ${value.length}`);
    }
    const convValue: any = (this as any)[coercionTypeSybol] ? [] : undefined;
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
    return convValue || (value as any);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

type InferTupleUnion<T extends any[]> = Infer<T[number]>;
type UnionOptions = { strict?: boolean };

class UnionType<T extends AnyType[]> extends Type<InferTupleUnion<T>> {
  constructor(private readonly schemas: T, private readonly opts?: UnionOptions) {
    super();
  }
  parse(value: unknown): InferTupleUnion<T> {
    const errors: string[] = [];
    for (const schema of this.schemas) {
      try {
        if (this.opts?.strict === false && schema instanceof ObjectType) {
          return schema.parse(value, { allowUnknown: true }) as any;
        }
        return schema.parse(value);
      } catch (err) {
        errors.push(err.message);
      }
    }
    throw new ValidationError('No union satisfied:\n  ' + errors.join('\n  '));
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

const isPickOrOmitType = (schema: AnyType): boolean => schema instanceof PickType || schema instanceof OmitType;

class IntersectionType<T extends AnyType, K extends AnyType> extends Type<Eval<Infer<T> & Infer<K>>> {
  private readonly _parse: (value: unknown, opts?: PathOptions) => any;

  constructor(private readonly left: T, private readonly right: K) {
    super();
    (this as any)[coercionTypeSybol] = (this.left as any)[coercionTypeSybol] || (this.right as any)[coercionTypeSybol];
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
      if (this.left instanceof TupleType || this.right instanceof TupleType) {
        throw new Error('tuple intersection not supported');
      }
      if (this.left instanceof ObjectType && this.right instanceof ObjectType) {
        return (value: unknown, opts?: PathOptions) => this.parseObjectIntersection(value, opts);
      }
      if (this.left instanceof RecordType && this.right instanceof RecordType) {
        const leftSchema: Type<any> = (this.left as any).schema;
        const rightSchema: Type<any> = (this.right as any).schema;
        const record = new RecordType(leftSchema.and(rightSchema));
        return (value: unknown) => record.parse(value);
      }
      if (this.left instanceof RecordType && this.right instanceof ObjectType) {
        //@ts-ignore
        return (value: unknown) => this.parseRecordObjectIntersection(value, this.left, this.right);
      }
      if (this.right instanceof RecordType && this.left instanceof ObjectType) {
        //@ts-ignore
        return (value: unknown) => this.parseRecordObjectIntersection(value, this.right, this.left);
      }
      // TODO Investigate why I unwrap partials in a new intersection again
      if (this.left instanceof PartialType) {
        return (value: unknown) => new IntersectionType((this.left as any).schema, this.right).parse(value) as any;
      }
      if (this.right instanceof PartialType) {
        return (value: unknown) => new IntersectionType(this.left, (this.right as any).schema).parse(value) as any;
      }
      if (isPickOrOmitType(this.left) || isPickOrOmitType(this.right)) {
        return (value: unknown) => {
          if ((this as any)[coercionTypeSybol]) {
            return {
              //@ts-ignore
              ...this.left.parse(value, { allowUnknown: true }),
              //@ts-ignore
              ...this.right.parse(value, { allowUnknown: true }),
            };
          }
          //@ts-ignore
          this.left.parse(value, { allowUnknown: true });
          //@ts-ignore
          this.right.parse(value, { allowUnknown: true });
          return value as any;
        };
      }
      if (
        this.left instanceof ArrayType &&
        this.right instanceof ArrayType &&
        (this.left as any).schema instanceof ObjectType &&
        (this.right as any).schema instanceof ObjectType
      ) {
        if ((this as any)[coercionTypeSybol]) {
          // todo best effort? Can figure something out if only one subschema is coerced. seems annoying though.
          throw new Error(
            'cannot create generic intersection of two object arrays containing coerced values. Try creating intersection via "and"'
          );
        }
        return (value: unknown) => {
          //@ts-ignore
          this.left.parse(value, { allowUnknown: true });
          //@ts-ignore
          this.right.parse(value, { allowUnknown: true });
          return value as any;
        };
      }
      return (value: unknown) => {
        this.left.parse(value);
        this.right.parse(value);
        return value as any;
      };
    })();
  }

  parse(value: unknown, opts?: PathOptions & ObjectOptions): Eval<Infer<T> & Infer<K>> {
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

  private parseObjectIntersection(value: any, opts?: PathOptions): any {
    const parsingOptions = { suppressPathErrMsg: opts?.suppressPathErrMsg, allowUnknown: true };
    if ((this as any)[coercionTypeSybol]) {
      return {
        ...((this.left as unknown) as ObjectType<any>).parse(value, parsingOptions),
        ...((this.right as unknown) as ObjectType<any>).parse(value, parsingOptions),
      };
    }
    ((this.left as unknown) as ObjectType<any>).parse(value, parsingOptions);
    ((this.right as unknown) as ObjectType<any>).parse(value, parsingOptions);
    return value;
  }

  private parseRecordObjectIntersection(value: any, recordSchema: RecordType<any>, objectSchema: ObjectType<any>): any {
    if ((this as any)[coercionTypeSybol]) {
      const convObj = objectSchema.parse(value, { allowUnknown: true });
      const proxy = Object.keys(value).reduce<any>((acc, key) => {
        if (!objectKeys.includes(key)) {
          acc[key] = value[key];
        }
        return acc;
      }, {});
      const convRecord = recordSchema.parse(proxy);
      return { ...convObj, ...convRecord };
    }

    objectSchema.parse(value, { allowUnknown: true });
    const objectKeys: string[] = (objectSchema as any)[shapekeysSymbol];
    const proxy = Object.keys(value).reduce<any>((acc, key) => {
      if (!objectKeys.includes(key)) {
        acc[key] = value[key];
      }
      return acc;
    }, {});
    recordSchema.parse(proxy);
    return value;
  }
}

type ValueOf<T> = T[keyof T];

class EnumType<T> extends Type<ValueOf<T>> {
  private values: any[];
  constructor(enumeration: T) {
    super();
    this.values = Object.values(enumeration);
  }
  parse(value: unknown): ValueOf<T> {
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
}

type DeepPartial<T> = { [key in keyof T]?: T[key] extends Object ? Eval<DeepPartial<T[key]>> : T[key] };
type PartialOpts = { deep: boolean };

function toPartialSchema(schema: AnyType, opts?: PartialOpts): AnyType {
  if (schema instanceof ObjectType) {
    const originalShape = (schema as any).objectShape;
    const shape = Object.keys(originalShape).reduce<any>((acc, key) => {
      if (opts?.deep) {
        acc[key] = toPartialSchema(originalShape[key], opts).optional();
      } else {
        acc[key] = originalShape[key].optional();
      }
      return acc;
    }, {});
    return new ObjectType(shape, (schema as any).opts);
  }
  if (schema instanceof RecordType) {
    if (opts?.deep) {
      return new RecordType(toPartialSchema((schema as any).schema, opts).optional());
    }
    return new RecordType((schema as any).schema.optional());
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

class PartialType<T extends AnyType, K extends PartialOpts> extends Type<
  K extends { deep: true } ? Eval<DeepPartial<Infer<T>>> : Partial<Infer<T>>
> {
  private readonly schema: AnyType;
  constructor(schema: T, opts?: K) {
    super();
    this.schema = toPartialSchema(schema, opts);
    (this as any)[coercionTypeSybol] = (this.schema as any)[coercionTypeSybol];
  }
  parse(value: unknown): K extends { deep: true } ? Eval<DeepPartial<Infer<T>>> : Partial<Infer<T>> {
    return this.schema.parse(value);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

const primitiveTypes = [NumberType, StringType, UnknownType, BooleanType, UndefinedType, NullType, LiteralType];

function isPrimitiveSchema(schema: AnyType): boolean {
  if (primitiveTypes.some(primitiveType => schema instanceof primitiveType)) {
    return true;
  }
  if (schema instanceof IntersectionType) {
    return isPrimitiveSchema((schema as any).left) || isPrimitiveSchema((schema as any).right);
  }
  if (schema instanceof UnionType) {
    return (schema as any).schemas.every(isPrimitiveSchema);
  }
  return false;
}

function createPickedSchema(schema: AnyType, pickedKeys: any[]): AnyType {
  if (schema instanceof ObjectType) {
    const shape = (schema as any).objectShape;
    const pickedShape = pickedKeys.reduce<any>((acc, key) => {
      if (shape[key]) {
        acc[key] = shape[key];
      }
      return acc;
    }, {});
    return new ObjectType(pickedShape, { allowUnknown: true });
  }
  if (schema instanceof IntersectionType) {
    const newLeft = createPickedSchema((schema as any).left, pickedKeys);
    const newRight = createPickedSchema((schema as any).right, pickedKeys);
    return new IntersectionType(newLeft, newRight);
  }
  if (schema instanceof PickType || schema instanceof OmitType) {
    // This might not hold true at runtime in a JS environment but typescript
    // will not allow you to pick keys you've previously omitted, or keys that
    // you have not picked. Since this is a TS package lets depend on it a little.
    return new PickType((schema as any).schema, pickedKeys);
  }
  if (schema instanceof UnionType) {
    // TODO ???
    throw new Error('pick of union types not supported');
  }
  return schema;
}

class PickType<T extends AnyType, K extends keyof Infer<T>> extends Type<Pick<Infer<T>, K>> {
  private readonly schema: AnyType;
  constructor(rootSchema: T, private readonly pickedKeys: K[]) {
    super();
    if (isPrimitiveSchema(rootSchema)) {
      throw new Error('cannot instantiate a PickType with a primitive schema');
    }
    this.schema = createPickedSchema(rootSchema, pickedKeys);
    const rootShapeKeys = (rootSchema as any)[shapekeysSymbol];
    (this as any)[shapekeysSymbol] = rootShapeKeys && rootShapeKeys.filter((key: any) => pickedKeys.includes(key));
    (this as any)[coercionTypeSybol] = (this.schema as any)[coercionTypeSybol];
  }
  parse(value: unknown, parseOptions?: ObjectOptions): Eval<Pick<Infer<T>, K>> {
    if (value === null || typeof value !== 'object') {
      throw new ValidationError('expected type to be object but got ' + typeOf(value));
    }
    if (!parseOptions?.allowUnknown) {
      const keys = Object.keys(value as any);
      const illegalKeys = keys.filter(key => !(this.pickedKeys as any[]).includes(key));
      if (illegalKeys.length > 0) {
        throw new ValidationError('unexpected keys on object: ' + JSON.stringify(illegalKeys));
      }
    }
    // For records if the key isn't present the record won't be able to validate it.
    if (this.schema instanceof RecordType) {
      for (const key of this.pickedKeys) {
        if (!(value as object).hasOwnProperty(key)) {
          (value as any)[key] = undefined;
        }
      }
    }
    return this.schema.parse(value);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

function createOmittedSchema(schema: AnyType, omittedKeys: any[]): AnyType {
  if (schema instanceof ObjectType) {
    const shape = (schema as any).objectShape;
    const omittedShape = Object.keys(shape).reduce<any>((acc, key) => {
      if (!omittedKeys.includes(key)) {
        acc[key] = shape[key];
      }
      return acc;
    }, {});
    return new ObjectType(omittedShape, { allowUnknown: true });
  }
  if (schema instanceof IntersectionType) {
    const newLeft = createOmittedSchema((schema as any).left, omittedKeys);
    const newRight = createOmittedSchema((schema as any).right, omittedKeys);
    return new IntersectionType(newLeft, newRight);
  }
  if (schema instanceof PickType) {
    const pickedKeys = (schema as any).pickedKeys.filter((key: any) => !omittedKeys.includes(key));
    return new PickType((schema as any).schema, pickedKeys);
  }
  if (schema instanceof OmitType) {
    return new OmitType((schema as any).schema, omittedKeys.concat((schema as any).omittedKeys));
  }
  if (schema instanceof UnionType) {
    // TODO ???
    throw new Error('omit of union types not supported');
  }
  return schema;
}

class OmitType<T extends AnyType, K extends keyof Infer<T>> extends Type<Omit<Infer<T>, K>> {
  private readonly schema: AnyType;
  constructor(rootSchema: T, private readonly omittedKeys: K[]) {
    super();
    if (isPrimitiveSchema(rootSchema)) {
      throw new Error('cannot instantiate a OmitType with a primitive schema');
    }
    this.schema = createOmittedSchema(rootSchema, omittedKeys);
    const rootShapeKeys = (rootSchema as any)[shapekeysSymbol];
    (this as any)[shapekeysSymbol] = rootShapeKeys && rootShapeKeys.filter((key: any) => !omittedKeys.includes(key));
    (this as any)[coercionTypeSybol] = (this.schema as any)[coercionTypeSybol];
  }
  parse(value: unknown, opts?: ObjectOptions): Eval<Omit<Infer<T>, K>> {
    if (value === null || typeof value !== 'object') {
      throw new ValidationError('expected type to be object but got ' + typeOf(value));
    }
    if (!opts?.allowUnknown) {
      const keys = Object.keys(value as any);
      const illegalKeys = keys.filter(key => (this.omittedKeys as any[]).includes(key));
      if (illegalKeys.length > 0) {
        throw new ValidationError('unexpected keys on object: ' + JSON.stringify(illegalKeys));
      }
    }
    return this.schema.parse(value);
  }
  and<K extends AnyType>(schema: K): IntersectionType<this, K> {
    return new IntersectionType(this, schema);
  }
}

class LazyType<T extends () => AnyType> extends Type<Infer<ReturnType<T>>> {
  constructor(private readonly fn: T) {
    super();
    // Since we can't know what the schema is we can't assume its not a coersionType and we need to disable the optimization
    (this as any)[coercionTypeSybol] = true;
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

export const string = (opts?: StringOptions) => new StringType(opts);
export const boolean = () => new BooleanType();
export const number = (opts?: NumberOptions) => new NumberType(opts);
export const unknown = () => new UnknownType();
export const literal = <T extends Literal>(literal: T) => new LiteralType(literal);
export const object = <T extends ObjectShape>(shape: T, opts?: ObjectOptions) => new ObjectType(shape, opts);
export const array = <T extends AnyType>(type: T, opts?: ArrayOptions) => new ArrayType(type, opts);
export const union = <T extends AnyType[]>(schemas: T, opts?: UnionOptions) => new UnionType(schemas, opts);
export const intersection = <T extends AnyType, K extends AnyType>(l: T, r: K) => new IntersectionType(l, r);
export const record = <T extends AnyType>(type: T) => new RecordType(type);
export const dictionary = <T extends AnyType>(type: T) => new RecordType(union([type, undefinedValue()]));
export const partial = <T extends AnyType, K extends PartialOpts>(type: T, opts?: K) => new PartialType(type, opts);
export const pick = <T extends AnyType, K extends keyof Infer<T>>(type: T, keys: K[]) => new PickType(type, keys);
export const omit = <T extends AnyType, K extends keyof Infer<T>>(type: T, keys: K[]) => new OmitType(type, keys);
export const tuple = <T extends [AnyType, ...AnyType[]] | []>(schemas: T) => new TupleType(schemas);
export const date = () => new DateType();
export const lazy = <T extends () => AnyType>(fn: T) => new LazyType(fn);

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
