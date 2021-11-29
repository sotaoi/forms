import type {
  InputValidatorConfig,
  InputValidationResult,
  RequesterFn,
  InputValidator,
} from '@sotaoi/contracts/http/input-validator-contract';
import type { ErrorResult } from '@sotaoi/contracts/transactions';
import type { BaseInput, FieldValidation, FormValidations } from '@sotaoi/input/base-input';
import type { DatabaseConnection } from '@sotaoi/contracts/definitions/mdriver';

import { CollectionInput } from '@sotaoi/input/collection-input';

declare class InputValidatorService extends InputValidator {
  protected t: (key: string, ...args: any[]) => string;
  protected messages: { [key: string]: { [key: string]: string } };

  constructor(
    config: InputValidatorConfig,
    mdb: () => null | ((repository: string) => DatabaseConnection.QueryBuilder),
    requester: null | RequesterFn
  );

  public getFormValidation(getInput: (key: string) => void | null | BaseInput<any, any>): InputValidatorService;

  public getResult(): InputValidationResult;

  public getErrors(key: string): string[];

  public getApiErrors(key: string): string[];

  public getAllApiErrors(): { [key: string]: string[] };

  public validate(key: string, validations: FieldValidation[]): Promise<string[]>;

  public validateCollection(collectionInput: CollectionInput): Promise<string[]>;

  public validatePayload(
    payload: { [key: string]: any },
    form: FormValidations,
    tlPrefix: string,
    isUpdateCommand: boolean
  ): Promise<void>;

  public validateCollections(payload: { [key: string]: any }, form: FormValidations, tlPrefix: string): Promise<void>;

  public setErrorResult(errorResult: ErrorResult): void;

  protected getInput(key: string): null | BaseInput<any, any>;

  protected required(key: string): Promise<void | string>;

  protected email(key: string): Promise<void | string>;

  protected ref(key: string): Promise<void | string>;

  protected min(key: string, args?: { [key: string]: any }): Promise<void | string>;

  protected boolean(key: string, args?: { [key: string]: any }): Promise<void | string>;

  protected street(key: string, args?: { [key: string]: any }): Promise<void | string>;

  protected title(key: string, args?: { [key: string]: any }): Promise<void | string>;

  protected content(key: string, args?: { [key: string]: any }): Promise<void | string>;

  protected file(fs: any, key: string, args?: { [key: string]: any }): Promise<void | string>;

  protected multiFile(fs: any, key: string, args?: { [key: string]: any }): Promise<void | string>;
}

export { InputValidatorService };
