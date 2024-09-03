import { getErrorHandler, getMetadataMap } from '../symbols';
import type {
    Constructor,
    Dictionary,
    MapInitializeReturn,
    MapOptions,
    Mapper,
    Mapping,
    MetadataIdentifier
} from '../types';
import { MapFnClassId, MetadataClassId, TransformationType } from '../types';
import { assertUnmappedProperties } from '../utils/assert-unmapped-properties';
import { get } from '../utils/get';
import { getMapping } from '../utils/get-mapping';
import { isDateConstructor } from '../utils/is-date-constructor';
import { isEmpty } from '../utils/is-empty';
import { isPrimitiveArrayEqual } from '../utils/is-primitive-array-equal';
import { isPrimitiveConstructor } from '../utils/is-primitive-constructor';
import { set, setMutate } from '../utils/set';
import { mapMember } from './map-member';
import { isPromise } from '../utils/is-promise';
import { asyncAware } from '../utils/async-aware';

function setMemberReturnFn<TDestination extends Dictionary<TDestination> = any>(
    destinationMemberPath: string[],
    destination: TDestination | undefined
) {
    return (value: unknown) => {
        if (destination) {
            destination = set(destination, destinationMemberPath, value);
        }
    };
}

export function mapReturn<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>,
    IsAsync extends boolean = false,
    Result = IsAsync extends true ? Promise<TDestination> : TDestination
>(
    mapping: Mapping<TSource, TDestination>,
    sourceObject: TSource,
    options: MapOptions<TSource, TDestination>,
    isMapArray = false,
    isAsync?: IsAsync
): Result {
    return map<TSource, TDestination, IsAsync, Result>({
        mapping,
        sourceObject,
        options,
        setMemberFn: setMemberReturnFn,
        isMapArray,
    }, isAsync);
}

function setMemberMutateFn(destinationObj: Record<string, unknown>) {
    return (destinationMember: string[]) => (value: unknown) => {
        if (value !== undefined) {
            setMutate(destinationObj, destinationMember, value);
        }
    };
}

function getMemberMutateFn(destinationObj: Record<string, unknown>) {
    return (memberPath: string[] | undefined) =>
        get(destinationObj, memberPath) as Record<string, unknown>;
}

export function mapMutate<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>,
    IsAsync extends boolean | undefined = undefined,
    Result = IsAsync extends true ? Promise<void> : void
>(
    mapping: Mapping<TSource, TDestination>,
    sourceObject: TSource,
    destinationObj: TDestination,
    options: MapOptions<TSource, TDestination>,
    isMapArray = false,
    isAsync?: IsAsync
): Result {
    return asyncAware(
        () => {
            return map({
                sourceObject,
                mapping,
                setMemberFn: setMemberMutateFn(destinationObj),
                getMemberFn: getMemberMutateFn(destinationObj),
                options,
                isMapArray,
            }, isAsync)
        },
        () => isAsync ? Promise.resolve() : undefined,
        isAsync
    );
}

interface MapParameter<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>
> {
    sourceObject: TSource;
    mapping: Mapping<TSource, TDestination>;
    options: MapOptions<TSource, TDestination>;
    setMemberFn: (
        destinationMemberPath: string[],
        destination?: TDestination
    ) => (value: unknown) => void;
    getMemberFn?: (
        destinationMemberPath: string[] | undefined
    ) => Record<string, unknown>;
    isMapArray?: boolean;
}

export function map<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>,
    IsAsync extends boolean = false,
    Result = IsAsync extends true ? Promise<TDestination> : TDestination
>({
    mapping,
    sourceObject,
    options,
    setMemberFn,
    getMemberFn,
    isMapArray = false,
}: MapParameter<TSource, TDestination>, isAsync?: IsAsync): Result {
    // destructure mapping
    const [
        [sourceIdentifier, destinationIdentifier],
        [, destinationWithMetadata],
        propsToMap,
        ,
        mapper,
        destinationConstructor,
        ,
        [mappingBeforeCallback, mappingAfterCallback] = [],
    ] = mapping;

    // deconstruct MapOptions
    const {
        beforeMap: mapBeforeCallback,
        afterMap: mapAfterCallback,
        destinationConstructor:
            mapDestinationConstructor = destinationConstructor,
        extraArgs,
    } = options ?? {};

    const errorHandler = getErrorHandler(mapper);
    const metadataMap = getMetadataMap(mapper);

    const destination: TDestination | Promise<TDestination> = mapDestinationConstructor(
        sourceObject,
        destinationIdentifier
    );

    // initialize an array of keys that have already been configured
    const configuredKeys: string[] = [];

    if (isAsync) {
        return Promise.all([
            sourceObject,
            destination,
        ]).then(async ([sourceObject, destination]) => {
              const extraArguments = extraArgs?.(mapping, destination);

              if (!isMapArray) {
                  const beforeMap = mapBeforeCallback ?? mappingBeforeCallback;
                  if (beforeMap) {
                      await beforeMap(sourceObject, destination, extraArguments);
                  }
              }

              await Promise.all(_mapInternalLogic<TSource, TDestination, true>({
                  propsToMap,
                  destination,
                  mapper,
                  setMemberFn,
                  getMemberFn,
                  sourceObject,
                  destinationIdentifier,
                  extraArguments,
                  configuredKeys,
                  errorHandler,
                  extraArgs,
                  metadataMap,
                  isAsync
              }));

              if (!isMapArray) {
                  const afterMap = mapAfterCallback ?? mappingAfterCallback;
                  if (afterMap) {
                      await afterMap(sourceObject, destination, extraArguments);
                  }
              }

              // Check unmapped properties
              assertUnmappedProperties(
                  destination,
                  destinationWithMetadata,
                  configuredKeys,
                  sourceIdentifier,
                  destinationIdentifier,
                  errorHandler
              );

              return destination;
          }) as Result;
    }

    const extraArguments = extraArgs?.(mapping, destination as TDestination)

    if (!isMapArray) {
        const beforeMap = mapBeforeCallback ?? mappingBeforeCallback;
        if (beforeMap) {
            beforeMap(sourceObject, destination as TDestination, extraArguments);
        }
    }

    // map
    _mapInternalLogic({
        propsToMap,
        destination: destination as TDestination,
        mapper,
        setMemberFn,
        getMemberFn,
        sourceObject,
        destinationIdentifier,
        extraArguments,
        configuredKeys,
        errorHandler,
        extraArgs,
        metadataMap,
    });

    if (!isMapArray) {
        const afterMap = mapAfterCallback ?? mappingAfterCallback;
        if (afterMap) {
            afterMap(sourceObject, destination as TDestination, extraArguments);
        }
    }

    // Check unmapped properties
    assertUnmappedProperties(
        destination,
        destinationWithMetadata,
        configuredKeys,
        sourceIdentifier,
        destinationIdentifier,
        errorHandler
    );

    return destination as unknown as Result;
}

function _mapInternalLogic<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>,
    IsAsync extends boolean = false
>({
    propsToMap,
    destination,
    mapper,
    setMemberFn,
    getMemberFn,
    sourceObject,
    destinationIdentifier,
    extraArguments,
    configuredKeys,
    errorHandler,
    extraArgs,
    metadataMap,
    isAsync,
}: {
    propsToMap: Mapping<TSource, TDestination>[2],
    destination: TDestination,
    mapper: Mapper,
    setMemberFn: MapParameter<TSource, TDestination>['setMemberFn'],
    getMemberFn: MapParameter<TSource, TDestination>['getMemberFn'],
    sourceObject: TSource,
    destinationIdentifier: MetadataIdentifier<TDestination>,
    extraArguments?: Record<string, any>,
    configuredKeys: string[],
    errorHandler: ReturnType<typeof getErrorHandler>,
    extraArgs: MapOptions<TSource, TDestination>['extraArgs'],
    metadataMap: ReturnType<typeof getMetadataMap>,
    isAsync?: IsAsync
}): (IsAsync extends true ? any[] : undefined) {
  const resolvables: any[] = [];
  const pushResolvable = (resolvable: any) => {
      if (isAsync !== true && isPromise(resolvable)) throw new Error('TODO');
      if (isAsync) resolvables.push(resolvable);
      return resolvable;
  }

  for (let i = 0, length = propsToMap.length; i < length; i++) {
    // destructure mapping property
    const [
        destinationMemberPath,
        [
            ,
            [
                transformationMapFn,
                [
                    transformationPreConditionPredicate,
                    transformationPreConditionDefaultValue = undefined,
                ] = [],
            ],
        ],
        [destinationMemberIdentifier, sourceMemberIdentifier] = [],
    ] = propsToMap[i];

    let hasSameIdentifier =
        !isPrimitiveConstructor(destinationMemberIdentifier) &&
        !isDateConstructor(destinationMemberIdentifier) &&
        !isPrimitiveConstructor(sourceMemberIdentifier) &&
        !isDateConstructor(sourceMemberIdentifier) &&
        sourceMemberIdentifier === destinationMemberIdentifier;

    if (hasSameIdentifier) {
        // at this point, we have a same identifier that aren't primitive or date
        // we then check if there is a mapping created for this identifier
        hasSameIdentifier = !getMapping(
            mapper,
            sourceMemberIdentifier as MetadataIdentifier,
            destinationMemberIdentifier as MetadataIdentifier,
            true
        );
    }

    // Set up a shortcut function to set destinationMemberPath on destination with value as argument
    const setMember = (valFn: () => unknown): any => {
        try {
            pushResolvable(asyncAware(() => valFn(), (value) => {
                return setMemberFn(destinationMemberPath, destination)(value)
            }, isAsync));
        } catch (originalError) {
            const errorMessage = `
Error at "${destinationMemberPath}" on ${
                (destinationIdentifier as Constructor)['prototype']
                    ?.constructor?.name || destinationIdentifier.toString()
            } (${JSON.stringify(destination)})
---------------------------------------------------------------------
Original error: ${originalError}`;
            errorHandler.handle(errorMessage);
            throw new Error(errorMessage);
        }
    };

    // This destination key is being configured. Push to configuredKeys array
    configuredKeys.push(destinationMemberPath[0]);

    // Pre Condition check
    if (
        transformationPreConditionPredicate &&
        !transformationPreConditionPredicate(sourceObject)
    ) {
        setMember(() => transformationPreConditionDefaultValue);
        continue;
    }

    // Start with all the mapInitialize
    if (
        transformationMapFn[MapFnClassId.type] ===
        TransformationType.MapInitialize
    ) {
        // check if metadata as destinationMemberPath is null
        const destinationMetadata = metadataMap.get(destinationIdentifier);
        const hasNullMetadata =
            destinationMetadata &&
            destinationMetadata.find((metadata) =>
                isPrimitiveArrayEqual(
                    metadata[MetadataClassId.propertyKeys],
                    destinationMemberPath
                )
            ) === null;

        const mapInitializedValue = (
            transformationMapFn[MapFnClassId.fn] as MapInitializeReturn<
                TSource,
                TDestination
            >[MapFnClassId.fn]
        )(sourceObject);
        const isTypedConverted =
            transformationMapFn[MapFnClassId.isConverted];

        // if null/undefined
        // if isDate, isFile
        // if metadata is null, treat as-is
        // if it has same identifier that are not primitives or Date
        // if the initialized value was converted with typeConverter
        if (
            mapInitializedValue == null ||
            mapInitializedValue instanceof Date ||
            Object.prototype.toString
                .call(mapInitializedValue)
                .slice(8, -1) === 'File' ||
            hasNullMetadata ||
            hasSameIdentifier ||
            isTypedConverted
        ) {
            setMember(() => mapInitializedValue);
            continue;
        }

        // if isArray
        if (Array.isArray(mapInitializedValue)) {
            const [first] = mapInitializedValue;
            // if first item is a primitive
            if (
                typeof first !== 'object' ||
                first instanceof Date ||
                Object.prototype.toString.call(first).slice(8, -1) ===
                    'File'
            ) {
                setMember(() => mapInitializedValue.slice());
                continue;
            }

            // if first is empty
            if (isEmpty(first)) {
                setMember(() => []);
                continue;
            }

            // if first is object but the destination identifier is a primitive
            // then skip completely
            if (isPrimitiveConstructor(destinationMemberIdentifier)) {
                continue;
            }

            setMember(() =>
                mapInitializedValue.map((each) =>
                    mapReturn(
                        getMapping(
                            mapper,
                            sourceMemberIdentifier as MetadataIdentifier,
                            destinationMemberIdentifier as MetadataIdentifier
                        ),
                        each,
                        { extraArgs }
                    )
                )
            );
            continue;
        }

        if (typeof mapInitializedValue === 'object') {
            const nestedMapping = getMapping(
                mapper,
                sourceMemberIdentifier as MetadataIdentifier,
                destinationMemberIdentifier as MetadataIdentifier
            );

            // nested mutate
            if (getMemberFn) {
                const memberValue = getMemberFn(destinationMemberPath);
                if (memberValue !== undefined) {
                    map({
                        sourceObject: mapInitializedValue as TSource,
                        mapping: nestedMapping,
                        options: { extraArgs },
                        setMemberFn: setMemberMutateFn(memberValue),
                        getMemberFn: getMemberMutateFn(memberValue),
                    });
                }
                continue;
            }

            setMember(() =>
                map({
                    mapping: nestedMapping,
                    sourceObject: mapInitializedValue as TSource,
                    options: { extraArgs },
                    setMemberFn: setMemberReturnFn,
                }, isAsync)
            );
            continue;
        }

        // if is primitive
        setMember(() => mapInitializedValue);
        continue;
    }

    setMember(() =>
        mapMember(
            transformationMapFn,
            sourceObject,
            destination,
            destinationMemberPath,
            extraArguments,
            mapper,
            sourceMemberIdentifier,
            destinationMemberIdentifier,
            isAsync,
        )
    );
  }

  return (isAsync === true ? resolvables : undefined) as IsAsync extends true ? any[] : undefined;
}
