import { describe, it } from 'benchmonkey';

import * as z from '../src';

describe('Parsing Benchmarks', { tolerance: 0.25 }, () => {
  describe('String', () => {
    const schema = z.string();
    const testData = 'hello world';
    it('no validations', () => schema.parse(testData));
  });

  describe('Number', () => {
    const schema = z.number();
    const testData = 42;
    it('no validations', () => schema.parse(testData));
  });

  describe('Array', () => {
    (() => {
      const schema = z.array(z.string());
      const data = ['hello', ' ', 'world', '!'];
      it('String Array', () => schema.parse(data));
    })();

    (() => {
      const schema = z.array(z.object({ a: z.string() })).and(z.array(z.object({ b: z.string() })));
      const data = [
        { a: 'hello', b: 'world' },
        { a: 'number', b: '42' },
      ];
      it('intersection of two object arrays', () => schema.parse(data));
    })();

    (() => {
      const schema = z.intersection(z.array(z.object({ a: z.string() })), z.array(z.object({ b: z.string() })));
      const data = [
        { a: 'hello', b: 'world' },
        { a: 'number', b: '42' },
      ];
      it('generalized intersection of two object arrays', () => schema.parse(data));
    })();
  });

  describe('Object', () => {
    const testObj = {
      a: 'hello',
      b: 'world',
      c: {
        nested: 123,
      },
    };

    const schema = z.object({
      a: z.string(),
      b: z.string(),
      c: z.object({
        nested: z.number(),
      }),
    });

    it('regular object', () => schema.parse(testObj));
  });

  describe('Records', () => {
    const schema = z.record(z.record(z.number()));
    const testData = {
      a: { a: 1, b: 2 },
      b: { c: 3, d: 4 },
      c: { c: 3, d: 4 },
      d: { c: 3, d: 4 },
    };
    it('record of record', () => schema.parse(testData));
  });

  describe('Intersections', () => {
    (() => {
      const schema = z.object({ a: z.string() }).and(z.object({ b: z.number() }));
      const testData = { a: 'hello', b: 42 };
      it('Object Intersections', () => schema.parse(testData));
    })();

    (() => {
      const recordA = z.record(z.object({ a: z.string() }));
      const recordB = z.record(z.object({ b: z.number() }));
      const schema = recordA.and(recordB);
      const testData = { one: { a: 'hello', b: 1 }, two: { a: 'world', b: 2 } };
      it('object record intersections', () => schema.parse(testData));
    })();
  });
});
