import { ObjectId } from 'mongodb';
import type { AnyBulkWriteOperation, OptionalId, UpdateFilter } from 'mongodb';
import { Hooks } from './hooks';

export enum VALIDATION_ACTIONS {
  ERROR = 'error',
  WARN = 'warn',
}

export enum VALIDATION_LEVEL {
  MODERATE = 'moderate',
  OFF = 'off',
  STRICT = 'strict',
}

export interface BaseSchema {
  _id: ObjectId;
}

export interface TimestampSchema {
  createdAt: Date;
  updatedAt: Date;
}

export interface ModelOptions {
  hooks?: Hooks;
  maxTime?: number;
}

export type DocumentForInsertWithoutDefaults<TSchema, TDefaults extends Partial<TSchema>> =
  // @ts-expect-error: This works, but TS complains that we can't use `keyof TDefaults` to index `TSchema`
  Omit<OptionalId<TSchema>, keyof TDefaults> & Partial<Pick<TSchema, keyof TDefaults>>;

export type DocumentForInsert<TSchema, TDefaults extends Partial<TSchema>> = Extract<
  keyof TSchema,
  'createdAt'
> extends 'createdAt'
  ? Omit<DocumentForInsertWithoutDefaults<TSchema, TDefaults>, 'createdAt' | 'updatedAt'> &
      Partial<TimestampSchema>
  : DocumentForInsertWithoutDefaults<TSchema, TDefaults>;

export type ProjectionType<
  TSchema,
  Projection extends Partial<Record<keyof TSchema, number>> | undefined
> = undefined extends Projection
  ? TSchema
  : // @ts-expect-error: This works, but TS complains that we can't use `keyof Projection` to index `TSchema`
    BaseSchema & Pick<TSchema, keyof Projection>;

export function getIds(ids: (string | ObjectId)[] | Set<string>): ObjectId[] {
  return [...ids].map((id) => new ObjectId(id));
}

/**
 * Creates new update object so the original doesn't get mutated
 */
export function timestampUpdateFilter<TSchema>(
  update: UpdateFilter<TSchema>
): UpdateFilter<TSchema> {
  const $currentDate = {
    ...update.$currentDate,
    ...(!update.$set?.updatedAt &&
      !update.$unset?.updatedAt && {
        updatedAt: true,
      }),
  };

  // @ts-expect-error We can't let TS know that the current schema has timestamps attributes
  return {
    ...update,
    ...(Object.keys($currentDate).length > 0 && { $currentDate }),
  };
}

/**
 * Creates new operation objects so the original operations don't get mutated
 */
export function timestampBulkWriteOperation<TSchema>(
  operation: AnyBulkWriteOperation<TSchema>
): AnyBulkWriteOperation<TSchema> {
  if ('insertOne' in operation) {
    return {
      insertOne: {
        document: {
          createdAt: new Date(),
          updatedAt: new Date(),
          ...operation.insertOne.document,
        },
      },
    };
  }

  if ('updateOne' in operation) {
    const { update } = operation.updateOne;

    // Skip aggregation pipeline updates
    if (Array.isArray(update)) {
      return operation;
    }

    const $currentDate = {
      ...update.$currentDate,
      ...(!update.$set?.updatedAt &&
        !update.$unset?.updatedAt && {
          updatedAt: true,
        }),
    };
    const $setOnInsert = {
      ...update.$setOnInsert,
      ...(!update.$set?.createdAt &&
        !update.$unset?.createdAt && {
          createdAt: new Date(),
        }),
    };

    return {
      updateOne: {
        ...operation.updateOne,
        // @ts-expect-error We can't let TS know that the current schema has timestamps attributes
        update: {
          ...update,
          ...(Object.keys($currentDate).length > 0 && { $currentDate }),
          ...(Object.keys($setOnInsert).length > 0 && { $setOnInsert }),
        },
      },
    };
  }

  if ('updateMany' in operation) {
    const { update } = operation.updateMany;

    // Skip aggregation pipeline updates
    if (Array.isArray(update)) {
      return operation;
    }

    const $currentDate = {
      ...update.$currentDate,
      ...(!update.$set?.updatedAt &&
        !update.$unset?.updatedAt && {
          updatedAt: true,
        }),
    };
    const $setOnInsert = {
      ...update.$setOnInsert,
      ...(!update.$set?.createdAt &&
        !update.$unset?.createdAt && {
          createdAt: new Date(),
        }),
    };

    return {
      updateMany: {
        ...operation.updateMany,
        // @ts-expect-error We can't let TS know that the current schema has timestamps attributes
        update: {
          ...update,
          ...(Object.keys($currentDate).length > 0 && { $currentDate }),
          ...(Object.keys($setOnInsert).length > 0 && { $setOnInsert }),
        },
      },
    };
  }

  if ('replaceOne' in operation) {
    return {
      replaceOne: {
        ...operation.replaceOne,
        replacement: {
          createdAt: new Date(),
          updatedAt: new Date(),
          ...operation.replaceOne.replacement,
        },
      },
    };
  }

  return operation;
}
