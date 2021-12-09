const { InputValidatorContract } = require('@sotaoi/contracts/http/input-validator-contract');
const _ = require('lodash');
const { OmniBaseField } = require('@sotaoi/input/omni-base-field');
const { FileInput } = require('@sotaoi/input/file-input');
const { StringInput } = require('@sotaoi/input/string-input');
const { MultiFileInput } = require('@sotaoi/input/multi-file-input');
const { BooleanInput } = require('@sotaoi/input/boolean-input');
const { CollectionInput } = require('@sotaoi/input/collection-input');
const { RefSelectInput } = require('@sotaoi/input/ref-select-input');
const { iterateAsync, clone } = require('@sotaoi/forms/helper');

class InputValidatorService extends InputValidatorContract {
  constructor(config, mdb, requester) {
    config.t = config.t || ((key, ...args) => key);
    config.messages = {
      generic: {
        invalid: 'Field is invalid',
      },
      required: {
        isRequired: 'This field is required',
      },
      email: {
        format: 'This does not look like an email address',
      },
      ref: {
        isNot: 'Selected value is invalid',
      },
      ...config.messages,
    };
    super(config, mdb, requester);
    this.t = config.t;
    this.messages = config.messages;
  }

  getFormValidation(getInput) {
    return new InputValidatorService(
      {
        ...this.config,
        getInput,
      },
      this.mdb,
      this.requester
    );
  }

  getResult() {
    const valid = this.isValid();
    return {
      valid,
      title: valid ? 'Success' : 'Warning',
      message: valid ? 'Form validation succeeded' : 'Form validation failed',
      validations: this.errorMessages,
    };
  }

  getErrors(key) {
    return this.errorMessages[key] || [];
  }

  getApiErrors(key) {
    return this.apiErrorMessages[key] || [];
  }

  getAllApiErrors() {
    return this.apiErrorMessages || {};
  }

  async validate(key, validations) {
    this.errorMessages[key] = [];
    this.apiErrorMessages[key] = [];
    if (!this.config.getInput) {
      throw new Error('form validation is not initialized');
    }
    if (typeof key !== 'string' || !key || !(validations instanceof Array)) {
      throw new Error('bad input for form validation function');
    }
    let required = false;
    for (const validation of validations) {
      if (validation.method === 'required') {
        required = true;
        break;
      }
    }
    if ((!this.getInput(key) || this.getInput(key).isEmpty()) && !required) {
      return [];
    }
    for (const validation of validations) {
      if (typeof this[validation.method] !== 'function') {
        this.errorMessages[key].push(this.t(InputValidatorService.DEFALUT_ERROR_MSG.replace('%s', validation.method)));
        continue;
      }
      const result = await this[validation.method](key, validation.args);
      if (!result) {
        continue;
      }
      this.errorMessages[key].push(result);
    }
    return [...this.errorMessages[key]];
  }

  async validateCollection(collectionInput) {
    if (!this.config.getInput) {
      throw new Error('form validation is not initialized');
    }
    if (!(collectionInput instanceof CollectionInput)) {
      throw new Error('bad input for form collection validation function');
    }
    const errors = [];
    if (collectionInput.value.fields.length < collectionInput.value.min) {
      errors.push('Too few items');
    }
    if (collectionInput.value.fields.length > collectionInput.value.max) {
      errors.push('Too many items');
    }
    return errors;
  }

  async validatePayload(payload, form, tlPrefix, isUpdateCommand) {
    await this.validateCollections(payload, form, tlPrefix);
    await iterateAsync(clone(form), tlPrefix, async (item, prefix, transformer, prop) => {
      prefix = prefix ? `${prefix}.` : '';
      const key = prefix + prop;
      let nextKey;

      const inputPayload = _.get(payload, key);
      if (isUpdateCommand && inputPayload && inputPayload.type === 'undefined') {
        return inputPayload;
      }

      if (!(item instanceof Array)) {
        const collectionPayload = inputPayload;
        const collectionValidations = item.fields;
        switch (true) {
          // multi collection
          case collectionPayload.fields instanceof Array && collectionPayload.type === 'collection':
            await collectionPayload.fields.map(async (field, index) => {
              nextKey = `${key}.fields.${index.toString()}`;
              await this.validatePayload(payload, collectionValidations, nextKey, isUpdateCommand);
            });
            return item;
          // single collection
          case typeof collectionPayload.fields === 'object' &&
            !(collectionPayload.fields instanceof Array) &&
            collectionPayload.type === 'singleCollection':
            nextKey = `${key}.fields`;
            await this.validatePayload(payload, collectionValidations, nextKey, isUpdateCommand);
            return item;
          default:
            throw new Error('something went wrong trying to validate the form');
        }
      }

      (!isUpdateCommand || typeof inputPayload.wasTouched !== 'function' || inputPayload.wasTouched()) &&
        (await this.validate(key, item));
      if (inputPayload instanceof OmniBaseField) {
        !isUpdateCommand && inputPayload.setTouched(true);
      }

      return item;
    });
  }

  async validateCollections(payload, form, tlPrefix) {
    await iterateAsync(clone(form), tlPrefix, async (item, prefix, transformer, prop) => {
      prefix = prefix ? `${prefix}.` : '';
      const key = prefix + prop;
      let nextKey;

      const inputPayload = _.get(payload, key);

      if (!(item instanceof Array)) {
        const collectionPayload = inputPayload;
        const collectionValidations = item.fields;

        if (collectionPayload.fields instanceof Array && collectionPayload.type === 'collection') {
          this.errorMessages[`${key}.size`] = await this.validateCollection(
            CollectionInput.deserialize(collectionPayload)
          );
          await collectionPayload.fields.map(async (field, index) => {
            nextKey = `${key}.fields.${index.toString()}`;
            await this.validateCollections(payload, collectionValidations, nextKey);
          });
          return item;
        }

        if (
          typeof collectionPayload.fields === 'object' &&
          !(collectionPayload.fields instanceof Array) &&
          collectionPayload.type === 'singleCollection'
        ) {
          nextKey = `${key}.fields`;
          await this.validateCollections(payload, collectionValidations, nextKey);
          return item;
        }
      }

      return item;
    });
  }

  setErrorResult(errorResult) {
    this.apiErrorMessages = errorResult.validations || {};
    this.errorTitle = errorResult.title;
    this.errorMsg = errorResult.msg;
    this.apiErrorXdata = errorResult.xdata;
  }

  getInput(key) {
    if (!this.config.getInput) {
      throw new Error('form validation is not initialized');
    }
    const input = this.config.getInput(key);
    return input || null;
  }

  async required(key) {
    const input = this.getInput(key);
    if (!input.isEmpty()) {
      return;
    }
    return this.t(
      this.messages.required.isRequired || InputValidatorService.DEFALUT_ERROR_MSG.replace('%s', 'required')
    );
  }

  async email(key) {
    const input = this.getInput(key);
    if (typeof input === 'undefined') {
      return;
    }
    const re =
      /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (!(input instanceof StringInput) || !input.value || !re.test(input.value)) {
      return this.t(this.messages.email.format);
    }
  }

  async ref(key) {
    const input = this.getInput(key);
    if (typeof input === 'undefined' || input instanceof RefSelectInput) {
      return;
    }
    return this.t(this.messages.ref.isNot);
  }

  async min(key, args = {}) {
    const input = this.getInput(key);
    if (typeof input === 'undefined') {
      return;
    }
    if (!(input instanceof StringInput) || typeof args !== 'object' || typeof args.length !== 'number') {
      return this.t(this.messages.generic.invalid);
    }
    if ((input.value.length || 0) < args.length) {
      return this.t(this.messages.generic.invalid);
    }
  }

  async boolean(key, args = {}) {
    const input = this.getInput(key);
    if (typeof input === 'undefined') {
      return;
    }
    if (!(input instanceof BooleanInput)) {
      return this.t(this.messages.generic.invalid);
    }
    if (typeof input.value !== 'boolean') {
      return this.t(this.messages.generic.invalid);
    }
  }

  async street(key, args = {}) {
    //
  }

  async title(key, args = {}) {
    //
  }

  async content(key, args = {}) {
    //
  }

  async file(fs, key, args = {}) {
    const input = this.getInput(key);
    if (!input || input.isEmpty()) {
      return;
    }
    if (!(input instanceof FileInput)) {
      return this.t(this.messages.generic.invalid);
    }

    // client (if file input has file, then execution is on the client side)
    if (input.getValue().file) {
      const file = input.getValue().file;
      if (typeof args.maxSize !== 'undefined' && file.size > args.maxSize) {
        // too large
        return this.t(this.messages.generic.invalid);
      }
      return;
    }

    // api (if file input has path, then it is an upload and execution is on the API side)
    if (input.getValue().path) {
      const file = fs.lstatSync(input.getValue().path);
      if (typeof args.maxSize !== 'undefined' && file.size > args.maxSize) {
        // too large
        return this.t(this.messages.generic.invalid);
      }
    }

    // if file input has neither file, nor path, then it's value is unchanged, or is a delete request
    // in which case we do nothing
  }

  async multiFile(fs, key, args = {}) {
    const input = this.getInput(key);
    if (!input || input.isEmpty()) {
      return;
    }
    if (!(input instanceof MultiFileInput)) {
      return this.t(this.messages.generic.invalid);
    }

    for (const _input of input.getValue()) {
      // client (if file input has file, then execution is on the client side)
      if (_input.getValue().file) {
        const file = _input.getValue().file;
        if (typeof args.maxSize !== 'undefined' && file.size > args.maxSize) {
          // too large
          return this.t(this.messages.generic.invalid);
        }
        continue;
      }

      // api (if file input has path, then it is an upload and execution is on the API side)
      if (_input.getValue().path) {
        const file = fs.lstatSync(_input.getValue().path);
        if (typeof args.maxSize !== 'undefined' && file.size > args.maxSize) {
          // too large
          return this.t(this.messages.generic.invalid);
        }
      }

      // if file input has neither file, nor path, then it's value is unchanged, or is a delete request
      // in which case we do nothing
    }
  }
}

module.exports = { InputValidatorService };
