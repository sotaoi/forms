type TransformerFn = (
  item: any,
  prefix: string,
  iterate: (item: any, prefix: string, transformer: TransformerFn, prop: string) => any,
  prop: string
) => any;

type TransformerAsyncFn = (
  item: any,
  prefix: string,
  iterate: (item: any, prefix: string, transformer: TransformerFn, prop: string) => any,
  prop: string
) => Promise<any>;

declare const iterateAsync: (
  obj: { [key: string]: any },
  stack: string,
  transformer: TransformerAsyncFn
) => Promise<any>;

declare const clone: <ObjectType = any>(object: ObjectType) => ObjectType;

export { iterateAsync, clone };
