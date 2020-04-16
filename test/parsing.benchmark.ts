import { describe, it } from 'benchmonkey';

import * as z from '../src';

describe('Parsing Benchmarks', { tolerance: 0.25 }, () => {
  describe('String', () => {
    it('no validations', () => {
      const schema = z.string();
      const testData = 'hello world';
      return () => schema.parse(testData);
    });
  });

  describe('Number', () => {
    it('no validations', () => {
      const schema = z.number();
      const testData = 42;
      return () => schema.parse(testData);
    });
  });

  describe('Array', () => {
    it('String Array', () => {
      const schema = z.array(z.string());
      const data = ['hello', ' ', 'world', '!'];
      return () => schema.parse(data);
    });

    it('intersection of two object arrays', () => {
      const schema = z.array(z.object({ a: z.string() })).and(z.array(z.object({ b: z.string() })));
      const data = [
        { a: 'hello', b: 'world' },
        { a: 'number', b: '42' },
      ];
      return () => schema.parse(data);
    });

    it('generalized intersection of two object arrays', () => {
      const schema = z.intersection(z.array(z.object({ a: z.string() })), z.array(z.object({ b: z.string() })));
      const data = [
        { a: 'hello', b: 'world' },
        { a: 'number', b: '42' },
      ];
      return () => schema.parse(data);
    });
  });

  describe('Object', () => {
    it('regular object', () => {
      const testObj = {
        a: 'hello',
        b: 'world',
        c: { nested: 123 },
      };
      const schema = z.object({
        a: z.string(),
        b: z.string(),
        c: z.object({ nested: z.number() }),
      });
      return () => schema.parse(testObj);
    });
  });

  describe('Records', () => {
    it('record of record', () => {
      const schema = z.record(z.record(z.number()));
      const testData = {
        a: { a: 1, b: 2 },
        b: { c: 3, d: 4 },
        c: { c: 3, d: 4 },
        d: { c: 3, d: 4 },
      };
      return () => schema.parse(testData);
    });
  });

  describe('Intersections', () => {
    it('Object Intersections', () => {
      const schema = z.object({ a: z.string() }).and(z.object({ b: z.number() }));
      const testData = { a: 'hello', b: 42 };
      return () => schema.parse(testData);
    });

    it('Generalized Object Intersection', () => {
      const schema = z.intersection(z.object({ a: z.string() }), z.object({ b: z.number() }));
      const testData = { a: 'hello', b: 42 };
      return () => schema.parse(testData);
    });

    it('object record intersections', () => {
      const recordA = z.record(z.object({ a: z.string() }));
      const recordB = z.record(z.object({ b: z.number() }));
      const schema = recordA.and(recordB);
      const testData = { one: { a: 'hello', b: 1 }, two: { a: 'world', b: 2 } };
      return () => schema.parse(testData);
    });
  });
});
