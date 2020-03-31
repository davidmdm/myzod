abstract class Type<T> {
  constructor() {}
  abstract parse(value: unknown): T;
  optional(): UnionType<[Type<T>, UndefinedType]> {
    return new UnionType([this, new UndefinedType()]);
  }
  nullable(): UnionType<[Type<T>, NullType]> {
    return new UnionType([this, new NullType()]);
  }
  and<K extends AnyType>(schema: K): IntersectionType<Type<T>, K> {
    return new IntersectionType(this, schema);
  }
  or<K extends AnyType>(schema: K): UnionType<[Type<T>, K]> {
    return new UnionType([this, schema]);
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
type Eval<T> = { [Key in keyof T]: T[Key] } & {};
export type Infer<T extends AnyType> = T extends Type<infer K> ? Eval<K> : any;

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
    this.opts.predicateErrMsg = errMsg;
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
}

type NumberOptions = Partial<{ min: number; max: number }>;
class NumberType extends Type<number> {
  constructor(private opts: NumberOptions = {}) {
    super();
  }
  parse(value: unknown): number {
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
  min(x: number): this {
    this.opts.min = x;
    return this;
  }
  max(x: number): this {
    this.opts.max = x;
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
}

class NullType extends Type<null> {
  parse(value: unknown): null {
    if (value !== null) {
      throw new ValidationError('expected type to be null but got ' + typeOf(value));
    }
    return value;
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
}

class UnknownType extends Type<unknown> {
  parse(value: unknown): unknown {
    return value;
  }
}

// Non Primitive types

type InferObjectShape<T> = {
  [key in keyof T]: T[key] extends Type<infer K> ? K : any;
};

type PathOptions = { suppressPathErrMsg?: boolean };
type ObjectOptions = { allowUnknown?: boolean };

const getKeyShapesSymbol = Symbol.for('getKeyShapes');

class ObjectType<T extends object> extends Type<InferObjectShape<T>> {
  constructor(private readonly objectShape: T, private readonly opts?: ObjectOptions) {
    super();
    //@ts-ignore
    this[getKeyShapesSymbol] = (): string[] => Object.keys(this.objectShape);
  }
  parse(value: unknown, optOverrides: ObjectOptions & PathOptions = {}): Eval<InferObjectShape<T>> {
    if (typeof value !== 'object') {
      throw new ValidationError('expected type to be object but got ' + typeOf(value));
    }
    if (value === null) {
      throw new ValidationError('expected object but got null');
    }
    if (Array.isArray(value)) {
      throw new ValidationError('expected type to be regular object but got array');
    }
    const keys = Object.keys(this.objectShape);
    const opts = { ...this.opts, ...optOverrides };
    if (!opts.allowUnknown) {
      const illegalKeys = Object.keys(value).filter(x => !keys.includes(x));
      if (illegalKeys.length > 0) {
        throw new ValidationError('unexpected keys on object: ' + JSON.stringify(illegalKeys));
      }
    }
    const acc: any = { ...value };
    for (const key of keys) {
      try {
        const keySchema = (this.objectShape as any)[key];
        if (keySchema instanceof UnknownType && !(value as any).hasOwnProperty(key)) {
          throw new ValidationError(`expected key "${key}" of unknown type to be present on object`);
        }
        if (keySchema instanceof ObjectType || keySchema instanceof ArrayType || keySchema instanceof RecordType) {
          acc[key] = keySchema.parse((value as any)[key], { suppressPathErrMsg: true });
        } else {
          acc[key] = keySchema.parse((value as any)[key]);
        }
      } catch (err) {
        const path = err.path ? [key, ...err.path] : [key];
        const msg = opts?.suppressPathErrMsg
          ? err.message
          : `error parsing object at path: "${prettyPrintPath(path)}" - ${err.message}`;
        throw new ValidationError(msg, path);
      }
    }
    return acc;
  }
}

class RecordType<T extends AnyType> extends Type<Record<string, Infer<T>>> {
  constructor(private readonly schema: T) {
    super();
  }
  parse(value: unknown, opts?: PathOptions & ObjectOptions): Record<string, Infer<T>> {
    if (typeof value !== 'object') {
      throw new ValidationError('expected type to be object but got ' + typeOf(value));
    }
    for (const key in value) {
      try {
        if (this.schema instanceof ObjectType) {
          this.schema.parse((value as any)[key], { allowUnknown: opts?.allowUnknown, suppressPathErrMsg: true });
        } else if (this.schema instanceof ArrayType || this.schema instanceof RecordType) {
          this.schema.parse((value as any)[key], { suppressPathErrMsg: true });
        } else {
          this.schema.parse((value as any)[key]);
        }
      } catch (err) {
        const path = err.path ? [key, ...err.path] : [key];
        const msg = opts?.suppressPathErrMsg
          ? err.message
          : `error parsing record at path "${prettyPrintPath(path)}" - ${err.message}`;
        throw new ValidationError(msg, path);
      }
    }
    return value as any;
  }
}

type ArrayOptions = Partial<{
  length: number;
  min: number;
  max: number;
  unique: boolean;
}>;

class ArrayType<T extends AnyType> extends Type<Infer<T>[]> {
  constructor(private readonly schema: T, private readonly opts: ArrayOptions = {}) {
    super();
  }
  parse(value: unknown, parseOptions?: PathOptions): Infer<T>[] {
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
    value.forEach((elem, idx) => {
      try {
        if (this.schema instanceof ObjectType || this.schema instanceof ArrayType) {
          this.schema.parse(elem, { suppressPathErrMsg: true });
        } else {
          this.schema.parse(elem);
        }
      } catch (err) {
        const path = err.path ? [idx, ...err.path] : [idx];
        const msg = parseOptions?.suppressPathErrMsg
          ? err.message
          : `error at ${prettyPrintPath(path)} - ${err.message}`;
        throw new ValidationError(msg, path);
      }
    });
    return value;
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
}

type TupleToUnion<T extends any[]> = T[number];
type InferTupleUnion<T extends AnyType[]> = TupleToUnion<{ [P in keyof T]: T[P] extends Type<infer K> ? K : any }>;
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
}

class IntersectionType<T extends AnyType, K extends AnyType> extends Type<Eval<Infer<T> & Infer<K>>> {
  private readonly schemas: AnyType[];
  constructor(left: T, right: K) {
    super();
    this.schemas = [left, right];
  }

  // TODO If One is record and other is Object than remove object keys before parsing it as record
  // TODO if both are Object records we got to allowUnknown.
  parse(value: unknown): Eval<Infer<T> & Infer<K>> {
    for (const schema of this.schemas) {
      // Todo What about unknowns keys of object intersections?
      if (schema instanceof ObjectType) {
        schema.parse(value, { allowUnknown: true });
      } else if (this.schemas.every(schema => schema instanceof RecordType)) {
        (schema as RecordType<any>).parse(value, { allowUnknown: true });
      } else if (schema instanceof RecordType && typeOf(value) === 'object') {
        const objectSchema = this.schemas.find(x => x instanceof ObjectType);
        if (!objectSchema) {
          schema.parse(value);
        }
        const objectKeys: string[] = (objectSchema as any)[getKeyShapesSymbol]();
        const proxy = Object.keys(value as any).reduce<any>((acc, key) => {
          if (objectKeys.includes(key)) {
            return acc;
          }
          acc[key] = (value as any)[key];
          return acc;
        }, {});
        schema.parse(proxy);
      } else {
        schema.parse(value);
      }
    }
    return value as any;
  }
}

type ValueOf<T> = T[keyof T];

class EnumType<T> extends Type<ValueOf<T>> {
  private values: any[];
  constructor(enumeration: T) {
    super();
    this.values = Object.values(enumeration);
  }
  parse(x: unknown): ValueOf<T> {
    if (!this.values.includes(x)) {
      throw new ValidationError(`error ${JSON.stringify(x)} not part of enum values`);
    }
    return x as ValueOf<T>;
  }
  check(value: unknown): value is ValueOf<T> {
    try {
      this.parse(value);
      return true;
    } catch {
      return false;
    }
  }
}

export const string = (opts?: StringOptions) => new StringType(opts);
export const boolean = () => new BooleanType();
export const number = (opts?: NumberOptions) => new NumberType(opts);
export const unknown = () => new UnknownType();
export const literal = <T extends Literal>(literal: T) => new LiteralType(literal);
export const object = <T extends object>(shape: T, opts?: ObjectOptions) => new ObjectType(shape, opts);
export const array = <T extends AnyType>(type: T, opts?: ArrayOptions) => new ArrayType(type, opts);
export const union = <T extends AnyType[]>(schemas: T, opts?: UnionOptions) => new UnionType(schemas, opts);
export const intersection = <T extends AnyType, K extends AnyType>(l: T, r: K) => new IntersectionType(l, r);
export const record = <T extends AnyType>(type: T) => new RecordType(type);
export const dictionary = <T extends AnyType>(type: T) => new RecordType(union([type, undefinedValue()]));

const undefinedValue = () => new UndefinedType();
const nullValue = () => new NullType();
const enumValue = <T>(e: T) => new EnumType(e);

export { undefinedValue as undefined, nullValue as null, enumValue as enum };

// Support default imports
export default {
  string,
  boolean,
  number,
  unknown,
  literal,
  object,
  array,
  union,
  intersection,
  undefined: undefinedValue,
  null: nullValue,
  enum: enumValue,
};
