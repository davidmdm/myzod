import * as z from '../src';

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

  it('optional primitive', () => {
    const schema = z.number().optional();
    const x: AssertEqual<z.Infer<typeof schema>, number | undefined> = true;
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
});
