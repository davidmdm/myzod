import assert from 'assert';
import { inspect } from 'util';

import * as z from '../src';
import { ObjectType, ObjectShape, StringType, NumberType, ArrayType, OptionalType, AnyType } from '../src/types';

type AssertEqual<T, K> = [T] extends [K] ? ([K] extends [T] ? true : false) : false;

describe('Types test', () => {
  it('string', () => {
    const schema = z.string();
    const x: AssertEqual<z.Infer<typeof schema>, string> = true;
    x;
  });

  it('number', () => {
    const schema = z.number();
    const x: AssertEqual<z.Infer<typeof schema>, number> = true;
    x;
  });

  it('boolean', () => {
    const schema = z.boolean();
    const x: AssertEqual<z.Infer<typeof schema>, boolean> = true;
    x;
  });

  it('undefined', () => {
    const schema = z.undefined();
    const x: AssertEqual<z.Infer<typeof schema>, undefined> = true;
    x;
  });

  it('null', () => {
    const schema = z.null();
    const x: AssertEqual<z.Infer<typeof schema>, null> = true;
    x;
  });

  it('literal', () => {
    const schema = z.literal('hello');
    const x: AssertEqual<z.Infer<typeof schema>, 'hello'> = true;
    x;
  });

  it('optional primitive - number', () => {
    const schema = z.number().optional();
    const x: AssertEqual<z.Infer<typeof schema>, number | undefined> = true;
    x;
  });

  it('optional primitive - string', () => {
    const schema = z.string().optional();
    const x: AssertEqual<z.Infer<typeof schema>, string | undefined> = true;
    x;
  });

  it('nullable primitive', () => {
    const schema = z.string().nullable();
    const x: AssertEqual<z.Infer<typeof schema>, string | null> = true;
    x;
  });

  it('object', () => {
    enum Color {
      red = 'red',
      blue = 'blue',
    }

    const schema = z.object({
      a: z.number(),
      b: z.string(),
      c: z.object({
        d: z.undefined(),
        e: z.unknown(),
        y: z.number().optional(),
      }),
      f: z.record(z.string()),
      g: z.dictionary(z.number()),
      h: z.array(z.boolean()),
      i: z.string().or(z.number()),
      j: z.pick(z.object({ k: z.string(), l: z.string().nullable() }), ['l']),
      m: z.omit(z.intersection(z.object({ n: z.string() }), z.object({ o: z.literal('hello') })), ['n']),
      p: z.enum(Color),
      q: z.date(),
    });

    const x: AssertEqual<
      z.Infer<typeof schema>,
      {
        a: number;
        b: string;
        c: {
          d?: undefined;
          e: unknown;
          y?: number | undefined;
        };
        f: Record<string, string>;
        g: Record<string, number | undefined>;
        h: boolean[];
        i: string | number;
        j: { l: string | null };
        m: { o: 'hello' };
        p: Color;
        q: Date;
      }
    > = true;
    x;
  });

  it('record object intersection', () => {
    const schema = z.object({ a: z.number() }).and(z.record(z.string()));
    const x: AssertEqual<z.Infer<typeof schema>, Record<string, string> & { a: number }> = true;
    x;
  });

  it('record intersection', () => {
    const schema = z.record(z.object({ a: z.string() })).and(z.record(z.object({ b: z.string() })));
    const x: AssertEqual<z.Infer<typeof schema>, Record<string, { a: string; b: string }>> = true;
    x;
  });

  it('mult dimensional array', () => {
    const schema = z.array(z.array(z.array(z.string())));
    const x: AssertEqual<z.Infer<typeof schema>, string[][][]> = true;
    x;
  });

  it('tuple type', () => {
    const schema = z.tuple([z.string(), z.object({ r: z.number() }), z.array(z.array(z.string()))]);
    const x: AssertEqual<z.Infer<typeof schema>, [string, { r: number }, string[][]]> = true;
    x;
  });

  it('object.pick', () => {
    const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() }).pick(['a', 'b']);
    const x: AssertEqual<z.Infer<typeof schema>, { a: string; b: number }> = true;
    x;
  });

  it('object.omit', () => {
    const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() }).omit(['a', 'b']);
    const x: AssertEqual<z.Infer<typeof schema>, { c: boolean }> = true;
    x;
  });

  it('object.partial', () => {
    const schema = z.object({ a: z.string(), b: z.number(), c: z.boolean() }).partial();
    const x: AssertEqual<z.Infer<typeof schema>, { a?: string; b?: number; c?: boolean }> = true;
    x;
  });

  it('object.partial deep', () => {
    const schema = z
      .object({
        a: z.string(),
        b: z.object({
          c: z.number(),
          d: z.object({
            e: z.number(),
          }),
        }),
      })
      .partial({ deep: true });

    const x: AssertEqual<z.Infer<typeof schema>, { a?: string; b?: { c?: number; d?: { e?: number } } }> = true;
    x;
  });

  it('partial', () => {
    const schema = z.partial(
      z.object({
        a: z.string(),
        b: z.object({
          c: z.number(),
          d: z.object({
            e: z.number(),
          }),
        }),
      })
    );
    const x: AssertEqual<z.Infer<typeof schema>, { a?: string; b?: { c: number; d: { e: number } } }> = true;
    x;

    const assertIsOptionalOf = (schema: any, type: any) => {
      assert.ok(schema instanceof OptionalType);
      assert.ok(schema.schema instanceof type);
    };

    assert.ok(schema instanceof ObjectType);
    const shape: ObjectShape = (schema as any).objectShape;

    assertIsOptionalOf(shape.a, StringType);
    assertIsOptionalOf(shape.b, ObjectType);
  });

  it('deep partial', () => {
    const schema = z.partial(
      z.object({
        a: z.string(),
        b: z.object({
          c: z.number(),
          d: z.object({
            e: z.number(),
          }),
        }),
      }),
      { deep: true }
    );
    const x: AssertEqual<z.Infer<typeof schema>, { a?: string; b?: { c?: number; d?: { e?: number } } }> = true;
    x;
  });

  describe('runtime shapes', () => {
    it('should return the correct shape for a dictionary', () => {
      const schema = z.dictionary(z.string());
      const x: AssertEqual<ObjectType<{ [z.keySignature]: OptionalType<StringType> }>, typeof schema> = true;
      x;

      type Schema = z.Infer<typeof schema>;
      const y: AssertEqual<{ [key: string]: string | undefined }, Schema> = true;
      y;
    });

    it('should not double wrap optional types in dictionaries', () => {
      const schema = z.dictionary(z.string().optional());
      const x: AssertEqual<ObjectType<{ [z.keySignature]: OptionalType<z.Type<string>> }>, typeof schema> = true;
      x;

      assert.ok(schema instanceof ObjectType);
      const optionalWrapper: AnyType = (schema as any).objectShape[z.keySignature];
      assert.ok(optionalWrapper instanceof OptionalType);
      const optionalType = (optionalWrapper as any).schema;
      assert.ok(optionalType instanceof StringType);
    });

    it('should create a new object type from a pick of an object', () => {
      const schema = z.pick(z.object({ a: z.string(), b: z.string() }), ['a']);
      const x: AssertEqual<ObjectType<{ a: StringType }>, typeof schema> = true;
      x;

      assert.ok(schema instanceof ObjectType);
      const shape: ObjectShape = (schema as any).objectShape;
      assert.deepEqual(Object.keys(shape), ['a']);
      assert.ok(shape.a instanceof StringType);
    });

    it('should create a new object type from a omit of an object', () => {
      const schema = z.omit(z.object({ a: z.string(), b: z.string() }), ['a']);
      const x: AssertEqual<ObjectType<{ b: StringType }>, typeof schema> = true;
      x;

      assert.ok(schema instanceof ObjectType);
      const shape: ObjectShape = (schema as any).objectShape;
      assert.deepEqual(Object.keys(shape), ['b']);
      assert.ok(shape.b instanceof StringType);
    });

    it('should create a new objectType from the pick of a record', () => {
      const schema = z.pick(z.record(z.string()), ['a', 'b']);
      const x: AssertEqual<ObjectType<{ a: StringType; b: StringType }>, typeof schema> = true;
      x;
      assert.ok(schema instanceof ObjectType);
      const shape: ObjectShape = (schema as any).objectShape;
      assert.deepEqual(Object.keys(shape), ['a', 'b']);
      assert.equal(shape[z.keySignature], undefined);
      assert.ok(shape.a instanceof StringType);
      assert.ok(shape.b instanceof StringType);
    });
  });

  describe('Recursive intersection', () => {
    const object1 = z.object({ a: z.string() });
    const record1 = z.record(object1);
    const arr1 = z.array(record1);
    const schema1 = z.object({
      o: object1,
      r: record1,
      a: arr1,
    });
    const object2 = z.object({ b: z.number() });
    const record2 = z.record(object2);
    const arr2 = z.array(record2);
    const schema2 = z.object({
      o: object2,
      r: record2,
      a: arr2,
    });
    const schema = schema1.and(schema2);

    it('typeof schema conditional inference', () => {
      const x: AssertEqual<
        typeof schema,
        ObjectType<{
          o: ObjectType<{ a: StringType; b: NumberType }>;
          r: ObjectType<{ [z.keySignature]: ObjectType<{ a: StringType; b: NumberType }> }>;
          a: ArrayType<ObjectType<{ [z.keySignature]: ObjectType<{ a: StringType; b: NumberType }> }>>;
        }>
      > = true;
      x;
    });

    it('Infered typeof schema conditional inference', () => {
      const x: AssertEqual<
        z.Infer<typeof schema>,
        {
          o: { a: string; b: number };
          r: Record<string, { a: string; b: number }>;
          a: Record<string, { a: string; b: number }>[];
        }
      > = true;
      x;
    });

    it('runtime - should recursivle create new Object Types inside object intersection', () => {
      assert.ok(schema instanceof ObjectType);
      const shape: ObjectShape = (schema as any).objectShape;

      assert.ok(shape.o instanceof ObjectType);
      const innerShape: ObjectShape = (shape.o as any).objectShape;
      assert.ok(innerShape.a instanceof StringType);
      assert.ok(innerShape.b instanceof NumberType);

      assert.ok(shape.r instanceof ObjectType);
      //@ts-ignore
      assert.equal(inspect(shape.r.objectShape[z.keySignature], true, Infinity), inspect(shape.o, true, Infinity));
      assert.ok(shape.a instanceof ArrayType);
      //@ts-ignore
      assert.equal(inspect(shape.a.schema, true, Infinity), inspect(shape.r, true, Infinity));
    });
  });
});
