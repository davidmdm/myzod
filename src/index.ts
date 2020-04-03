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

type ObjectShape = Record<string, AnyType>;
type InferObjectShape<T> = {
  [key in keyof T]: T[key] extends Type<infer K> ? K : any;
};

type PathOptions = { suppressPathErrMsg?: boolean };
type ObjectOptions = { allowUnknown?: boolean };

const getKeyShapesSymbol = Symbol.for('getKeyShapes');

class ObjectType<T extends ObjectShape> extends Type<Eval<InferObjectShape<T>>> {
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
        } else if (
          this.schema instanceof ArrayType ||
          this.schema instanceof RecordType ||
          this.schema instanceof IntersectionType
        ) {
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
  constructor(private readonly left: T, private readonly right: K) {
    super();
  }

  parse(value: unknown, opts?: PathOptions): Eval<Infer<T> & Infer<K>> {
    if (this.left instanceof ObjectType && this.right instanceof ObjectType) {
      return this.parseObjectIntersection(value, opts);
    }
    if (this.left instanceof RecordType && this.right instanceof RecordType) {
      return this.parseRecordIntersection(value);
    }
    if (this.left instanceof RecordType && this.right instanceof ObjectType) {
      return this.parseRecordObjectIntersection(value, this.left, this.right);
    }
    if (this.right instanceof RecordType && this.left instanceof ObjectType) {
      return this.parseRecordObjectIntersection(value, this.right, this.left);
    }
    if (this.left instanceof PartialType) {
      return new IntersectionType((this.left as any).schema, this.right).parse(value) as any;
    }
    if (this.right instanceof PartialType) {
      return new IntersectionType(this.left, (this.right as any).schema).parse(value) as any;
    }

    this.left.parse(value);
    this.right.parse(value);
    return value as any;
  }

  private parseObjectIntersection(value: any, opts?: PathOptions): any {
    const intersectionKeys = new Set<string>([
      ...(this.left as any)[getKeyShapesSymbol](),
      ...(this.right as any)[getKeyShapesSymbol](),
    ]);
    const invalidKeys = Object.keys(value).filter(key => !intersectionKeys.has(key));
    if (invalidKeys.length > 0) {
      throw new ValidationError('unexpected keys on object ' + JSON.stringify(invalidKeys));
    }
    const parsingOptions = { ...opts, allowUnknown: true };
    return {
      ...((this.left as unknown) as ObjectType<any>).parse(value, parsingOptions),
      ...((this.right as unknown) as ObjectType<any>).parse(value, parsingOptions),
    };
  }

  private parseRecordIntersection(value: any): any {
    const leftSchema: Type<any> = (this.left as any).schema;
    const rightSchema: Type<any> = (this.right as any).schema;
    return new RecordType(leftSchema.and(rightSchema)).parse(value);
  }

  private parseRecordObjectIntersection(value: any, recordSchema: RecordType<any>, objectSchema: ObjectType<any>): any {
    objectSchema.parse(value, { allowUnknown: true });
    const objectKeys: string[] = (objectSchema as any)[getKeyShapesSymbol]();
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

function toPartialSchema(schema: AnyType): AnyType {
  if (schema instanceof ObjectType) {
    const originalShape = (schema as any).objectShape;
    const shape = Object.keys(originalShape).reduce<any>((acc, key) => {
      acc[key] = originalShape[key].optional();
      return acc;
    }, {});
    return new ObjectType(shape, (schema as any).opts);
  }
  if (schema instanceof RecordType) {
    return new RecordType((schema as any).schema.optional());
  }
  if (schema instanceof IntersectionType) {
    return new IntersectionType(toPartialSchema((schema as any).left), toPartialSchema((schema as any).right));
  }
  if (schema instanceof UnionType) {
    return new UnionType((schema as any).schemas.map(toPartialSchema));
  }
  if (schema instanceof ArrayType) {
    return new ArrayType((schema as any).schema.optional());
  }
  return schema;
}

class PartialType<T extends AnyType> extends Type<Partial<Infer<T>>> {
  private readonly schema: AnyType;
  constructor(schema: T) {
    super();
    this.schema = toPartialSchema(schema);
  }
  parse(value: unknown): Partial<Infer<T>> {
    return this.schema.parse(value);
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
  if (schema instanceof OmitType) {
    // TODO
  }
  if (schema instanceof UnionType) {
    // TODO ???
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
  }
  parse(value: unknown): Eval<Pick<Infer<T>, K>> {
    if (value === null || typeof value !== 'object') {
      throw new ValidationError('expected type to be object but got ' + typeOf(value));
    }
    const keys = Object.keys(value as any);
    const illegalKeys = keys.filter(key => !(this.pickedKeys as any[]).includes(key));
    if (illegalKeys.length > 0) {
      throw new ValidationError('unexpected keys on object: ' + JSON.stringify(illegalKeys));
    }
    // For records if the key isn't present the record won't be able to validate it.
    for (const key of this.pickedKeys) {
      if (!(value as object).hasOwnProperty(key)) {
        (value as any)[key] = undefined;
      }
    }
    return this.schema.parse(value);
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
  if (schema instanceof UnionType) {
    // TODO ???
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
  }
  parse(value: unknown): Eval<Omit<Infer<T>, K>> {
    if (value === null || typeof value !== 'object') {
      throw new ValidationError('expected type to be object but got ' + typeOf(value));
    }
    const keys = Object.keys(value as any);
    const illegalKeys = keys.filter(key => (this.omittedKeys as any[]).includes(key));
    if (illegalKeys.length > 0) {
      throw new ValidationError('unexpected keys on object: ' + JSON.stringify(illegalKeys));
    }
    return this.schema.parse(value);
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
export const partial = <T extends AnyType>(type: T) => new PartialType(type);
export const pick = <T extends AnyType, K extends keyof Infer<T>>(type: T, keys: K[]) => new PickType(type, keys);
export const omit = <T extends AnyType, K extends keyof Infer<T>>(type: T, keys: K[]) => new OmitType(type, keys);

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
  record,
  dictionary,
  partial,
  pick,
  omit,
  undefined: undefinedValue,
  null: nullValue,
  enum: enumValue,
};
