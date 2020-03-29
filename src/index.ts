abstract class Type<T> {
  constructor() {}
  abstract parse(value: unknown): T;
}

export type Infer<T extends Type<any>> = T extends Type<infer K> ? K : any;

class StringType extends Type<string> {
  parse(value: unknown): string {
    if (typeof value !== 'string') {
      throw new Error('expected type to be string: ' + typeof value);
    }
    return value;
  }
}

class BooleanType extends Type<boolean> {
  parse(value: unknown): boolean {
    if (typeof value !== 'boolean') {
      throw new Error('expected type to be boolean: ' + typeof value);
    }
    return value;
  }
}

type InferObjectShape<T> = {
  [key in keyof T]: T[key] extends Type<infer K> ? Infer<Type<K>> : any;
};

type ObjectOptions = {
  allowUnknown?: boolean;
};

class ObjectType<T extends object> extends Type<InferObjectShape<T>> {
  constructor(private readonly objectShape: T, private readonly opts?: ObjectOptions) {
    super();
  }

  parse(value: unknown): InferObjectShape<T> {
    if (typeof value !== 'object') {
      throw new Error('expected type to be object: ' + typeof value);
    }
    if (value === null) {
      throw new Error('expected object but got null');
    }
    if (Array.isArray(value)) {
      throw new Error('expected type to be regular object but got array');
    }

    const keys = Object.keys(this.objectShape);

    if (!this.opts?.allowUnknown) {
      const illegalKeys = Object.keys(value).filter(x => !keys.includes(x));
      if (illegalKeys.length > 0) {
        throw new Error('unexpected keys on object: ' + illegalKeys.join(', '));
      }
    }

    const acc: any = {};
    for (const key of keys) {
      acc[key] = (this.objectShape as any)[key].parse((value as any)[key]);
    }
    return acc;
  }
}

class UnionType<T, K> extends Type<T | K> {}

export const string = () => new StringType();
export const boolean = () => new BooleanType();
export const object = <T extends object>(shape: T, opts?: ObjectOptions) => new ObjectType(shape, opts);

const schema = object({
  a: string(),
  b: boolean(),
});

type R = Infer<typeof schema>;
