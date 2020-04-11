//@ts-nocheck

import * as z from '../src';

const iter = 1_000_000;

(function () {
  const schema = z.string();
  const testData = 'hello world';

  console.time('StringType');
  for (let i = 0; i < iter; i++) {
    schema.parse(testData);
  }
  console.timeEnd('StringType');
})();

(function () {
  const schema = z.number();
  const testData = 42;

  console.time('numberType');
  for (let i = 0; i < iter; i++) {
    schema.parse(testData);
  }
  console.timeEnd('numberType');
})();

(function () {
  const schema = z.array(z.string());
  const testData = ['hello', ' ', 'world', '!'];

  console.time('ArrayType');
  for (let i = 0; i < iter; i++) {
    schema.parse(testData);
  }
  console.timeEnd('ArrayType');
})();

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

(function () {
  const schema = z.object({ a: z.string() }).and(z.object({ b: z.number() }));
  const testData = { a: 'hello', b: 42 };
  console.time('object intersection type');
  for (let i = 0; i < iter; i++) {
    schema.parse(testData);
  }
  console.timeEnd('object intersection type');
})();

(function () {
  const recordA = z.record(z.object({ a: z.string() }));
  const recordB = z.record(z.object({ b: z.number() }));
  const schema = recordA.and(recordB);
  const testData = { one: { a: 'hello', b: 1 }, two: { a: 'world', b: 2 } };
  console.time('record intersection type');
  for (let i = 0; i < iter; i++) {
    schema.parse(testData);
  }
  console.timeEnd('record intersection type');
})();
