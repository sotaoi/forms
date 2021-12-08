const _ = require('lodash');

const iterateAsync = async (obj, stack, transformer) => {
  if (typeof obj !== 'object') {
    return obj;
  }
  for (const prop of Object.keys(obj)) {
    obj[prop] = await transformer(obj[prop], stack, transformer, prop);
  }
  return obj;
};

const clone = (object) => {
  return _.cloneDeep(object);
};

module.exports = { iterateAsync, clone };
