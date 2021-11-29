declare const iterateAsync: (
  obj: { [key: string]: any },
  stack: string,
  transformer: TransformerAsyncFn
) => Promise<any>;

declare const clone: <ObjectType = any>(object: ObjectType) => ObjectType;

export { iterateAsync, clone };
