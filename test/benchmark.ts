//@ts-nocheck

import * as z from '../src';

const iter = 1_000_000;

(function () {
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

  console.time('simple object parse');
  for (let i = 0; i < iter; i++) {
    schema.parse(testObj);
  }
  console.timeEnd('simple object parse');
})();

(function () {
  const schema = z.record(z.record(z.number()));

  const testData = {
    a: { a: 1, b: 2 },
    b: { c: 3, d: 4 },
    c: { c: 3, d: 4 },
    d: { c: 3, d: 4 },
  };

  console.time('record of record type');
  for (let i = 0; i < iter; i++) {
    schema.parse(testData);
  }
  console.timeEnd('record of record type');
})();
