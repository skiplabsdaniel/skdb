export type IntValue = { intValue: string };
export type StringValue = { stringValue: string };
export type DoubleValue = { doubleValue: number };
export type BoolValue = { boolValue: boolean };

export type ScalarValue = IntValue | StringValue | DoubleValue | BoolValue;

export type ArrayValue = {
  arrayValue: {
    values: ScalarValue[];
  };
};

export type AttributeValue = ScalarValue | ArrayValue;

export type Attribute = { key: string; value: AttributeValue };

export type ScopeInfo = {
  name: string;
  version: string;
  attributes: Attribute[];
};

export interface Headers {
  [attributeKey: string]: string;
}

const hasProp = Object.prototype.hasOwnProperty;

export function deepEquals<T>(a: T, b: T): boolean {
  if (a === b) {
    return true;
  }

  if (a && b && typeof a === "object" && typeof b === "object") {
    const arrA = Array.isArray(a),
      arrB = Array.isArray(b);
    let i, length: number;

    if (arrA && arrB) {
      length = a.length;
      if (length !== b.length) {
        return false;
      }
      for (i = length; i-- !== 0; ) {
        if (!deepEquals(a[i], b[i])) {
          return false;
        }
      }
      return true;
    }

    if (arrA !== arrB) {
      return false;
    }

    const keys = Object.keys(a);
    length = keys.length;

    if (length !== Object.keys(b).length) {
      return false;
    }

    let key: string;

    for (key in keys) {
      if (!hasProp.call(b, key)) {
        return false;
      }
    }

    for (key in keys) {
      // @ts-ignore
      if (!deepEquals(a[key], b[key])) {
        return false;
      }
    }

    return true;
  }

  return a !== a && b !== b;
}
