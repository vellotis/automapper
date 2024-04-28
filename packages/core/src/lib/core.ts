import { mapMutate, mapReturn } from './mappings/map';
import {
    CUSTOM_NODE_INSPECT,
    ERROR_HANDLER,
    MAPPINGS,
    METADATA_MAP,
    METADATA_OBJECT_MAP,
    NAMING_CONVENTIONS,
    PROFILE_CONFIGURATION_CONTEXT,
    RECURSIVE_COUNT,
    RECURSIVE_DEPTH,
    STRATEGY,
} from './symbols';
import type {
    ArrayKeyedMap,
    Dictionary,
    ErrorHandler,
    MapOptions,
    Mapper,
    Mapping,
    MappingConfiguration,
    MappingStrategy,
    MappingStrategyInitializer,
    Metadata,
    MetadataIdentifier,
    ModelIdentifier,
    NamingConventionInput,
} from './types';
import { getMapping } from './utils/get-mapping';
import { AutoMapperLogger } from './utils/logger';

export interface CreateMapperOptions {
    strategyInitializer: MappingStrategyInitializer<MetadataIdentifier>;
    errorHandler?: ErrorHandler;
    namingConventions?: NamingConventionInput;
}

/**
 * Creates and returns a Mapper {} as a Proxy. The following methods are available to use with a Mapper:
 *  ```
 *  - Mapper#map(Array)(Async), Mapper#mutate(Array)(Async)
 *  - createMap()
 *  - addProfile()
 *  - getMapping()
 *  - getMappings()
 *  ```
 * @param {CreateMapperOptions} options
 */
export function createMapper({
    strategyInitializer,
    errorHandler,
    namingConventions,
}: CreateMapperOptions): Mapper {
    let strategy: MappingStrategy<MetadataIdentifier>;

    // this mapper is responsible for all mappings
    let mappings: Map<MetadataIdentifier, Map<MetadataIdentifier, Mapping>>;

    // this mapper is responsible for all metadata
    let metadataMap: Map<MetadataIdentifier, Array<Metadata>>;
    let metadataObjectMap: Map<
        MetadataIdentifier,
        [
            asSource?: Record<string, unknown>,
            asDestination?: Record<string, unknown>
        ]
    >;

    // this mapper is responsible for recursive depths and counts
    let recursiveDepth: Map<MetadataIdentifier, ArrayKeyedMap>;
    let recursiveCount: Map<MetadataIdentifier, ArrayKeyedMap>;

    // this mapper is tracking some context about the MappingProfile
    let profileConfigurationContext: Set<MappingConfiguration>;

    function getOptions<
        TSource extends Dictionary<TSource>,
        TDestination extends Dictionary<TDestination>
    >(
        sourceIdentifier: ModelIdentifier<TSource>,
        destinationIdentifierOrOptions?:
            | ModelIdentifier<TDestination>
            | MapOptions<TSource, TDestination>
            | MapOptions<TSource[], TDestination[]>,
        options?:
            | MapOptions<TSource, TDestination>
            | MapOptions<TSource[], TDestination[]>
    ): {
        destinationIdentifier: ModelIdentifier<TDestination>;
        mapOptions?:
            | MapOptions<TSource, TDestination>
            | MapOptions<TSource[], TDestination[]>;
    } {
        if (destinationIdentifierOrOptions && options) {
            return {
                destinationIdentifier:
                    destinationIdentifierOrOptions as ModelIdentifier<TDestination>,
                mapOptions: options,
            };
        }

        let destinationIdentifier: ModelIdentifier<TDestination> =
            sourceIdentifier as ModelIdentifier<TDestination>;

        if (destinationIdentifierOrOptions && !options) {
            const typeofDestinationOrOptions =
                typeof destinationIdentifierOrOptions;
            if (
                typeofDestinationOrOptions === 'string' ||
                typeofDestinationOrOptions === 'function'
            ) {
                destinationIdentifier =
                    destinationIdentifierOrOptions as ModelIdentifier<TDestination>;
            } else {
                options = destinationIdentifierOrOptions as MapOptions<
                    TSource,
                    TDestination
                >;
            }
        }
        return { destinationIdentifier, mapOptions: options };
    }

    // return the Proxy
    return new Proxy<Mapper>(
        {
            [CUSTOM_NODE_INSPECT]() {
                return `
Mapper {} is an empty Object as a Proxy. The following methods are available to use with a Mapper:
- Mapper#map(Array)(Async), Mapper#mutate(Array)(Async)
- createMap()
- addProfile()
- getMapping()
- getMappings()
        `;
            },
        } as unknown as Mapper,
        {
            get(target, p: string | symbol, receiver) {
                if (p === STRATEGY) {
                    if (!strategy) {
                        strategy = strategyInitializer(receiver);
                    }
                    return strategy;
                }

                if (p === PROFILE_CONFIGURATION_CONTEXT) {
                    if (!profileConfigurationContext) {
                        profileConfigurationContext = new Set();
                    }
                    return profileConfigurationContext;
                }

                if (p === MAPPINGS) {
                    if (!mappings) {
                        mappings = new Map();
                    }
                    return mappings;
                }

                if (p === METADATA_MAP) {
                    if (!metadataMap) {
                        metadataMap = new Map();
                    }
                    return metadataMap;
                }

                if (p === METADATA_OBJECT_MAP) {
                    if (!metadataObjectMap) {
                        metadataObjectMap = new Map();
                    }

                    return metadataObjectMap;
                }

                if (p === ERROR_HANDLER) {
                    if (!errorHandler) {
                        errorHandler = {
                            handle: AutoMapperLogger.error
                                ? AutoMapperLogger.error.bind(AutoMapperLogger)
                                : // eslint-disable-next-line @typescript-eslint/no-empty-function
                                  () => {},
                        };
                    }
                    return errorHandler;
                }

                if (p === NAMING_CONVENTIONS) {
                    return namingConventions;
                }

                if (p === RECURSIVE_DEPTH) {
                    if (!recursiveDepth) {
                        recursiveDepth = new Map();
                    }
                    return recursiveDepth;
                }

                if (p === RECURSIVE_COUNT) {
                    if (!recursiveCount) {
                        recursiveCount = new Map();
                    }
                    return recursiveCount;
                }

                if (p === 'dispose') {
                    return () => {
                        mappings?.clear();
                        // TODO: why can metadata not be clear?
                        // metadata?.clear();
                        metadataObjectMap?.clear();
                        recursiveDepth?.clear();
                        recursiveCount?.clear();
                        profileConfigurationContext?.clear();
                    };
                }

                if (p === 'map') {
                    return <
                        TSource extends Dictionary<TSource>,
                        TDestination extends Dictionary<TDestination>,
                        IsAsync extends boolean = false,
                        Result = IsAsync extends true ? Promise<TDestination> : TDestination
                    >(
                        sourceObject: TSource,
                        sourceIdentifier: ModelIdentifier<TSource>,
                        destinationIdentifierOrOptions?:
                            | ModelIdentifier<TDestination>
                            | MapOptions<TSource, TDestination>,
                        options?: MapOptions<TSource, TDestination>,
                        isAsync?: IsAsync
                    ): Result => {
                        if (sourceObject == null)
                            return (isAsync ? Promise.resolve<Result>(sourceObject) : sourceObject) as Result;

                        const { destinationIdentifier, mapOptions } =
                            getOptions(
                                sourceIdentifier,
                                destinationIdentifierOrOptions,
                                options
                            );

                        const mapping = getMapping(
                            receiver,
                            sourceIdentifier,
                            destinationIdentifier
                        );

                        // ASYNCRONOUS
                        if (isAsync) {
                            return Promise.resolve(sourceObject)
                              .then(async (sourceObject) => {
                                sourceObject = await strategy.preMap(sourceObject, mapping);

                                let destination = await mapReturn<TSource, TDestination, true>(
                                    mapping,
                                    sourceObject,
                                    <MapOptions<TSource, TDestination>> mapOptions || {},
                                    false, // isMapArray
                                    isAsync,
                                );

                                destination = await strategy.postMap(
                                    sourceObject,
                                    destination,
                                    mapping,
                                );

                                return destination;
                            }) as Result;
                        }

                        // SYNCRONOUS

                        sourceObject = strategy.preMap(sourceObject, mapping);

                        let destination = mapReturn<TSource, TDestination, IsAsync, Result>(
                            mapping,
                            sourceObject,
                            <MapOptions<TSource, TDestination>> mapOptions || {}
                        );

                        destination =  strategy.postMap(
                            sourceObject,
                            // seal destination so that consumers cannot add properties to it
                            // or change the property descriptors. but they can still modify it
                            // the ideal behavior is seal but the consumers might need to add/modify the object after map finishes
                            destination,
                            mapping
                        );

                        return destination;
                    };
                }

                if (p === 'mapAsync') {
                    return <
                        TSource extends Dictionary<TSource>,
                        TDestination extends Dictionary<TDestination>
                    >(
                        sourceObject: TSource,
                        sourceIdentifier: ModelIdentifier<TSource>,
                        destinationIdentifierOrOptions?:
                            | ModelIdentifier<TDestination>
                            | MapOptions<TSource, TDestination>,
                        options?: MapOptions<TSource, TDestination>
                    ): Promise<TDestination> => {
                        return receiver['map'](
                            sourceObject,
                            sourceIdentifier,
                            destinationIdentifierOrOptions,
                            options,
                            true
                        );
                    };
                }

                if (p === 'mapArray') {
                    return <
                        TSource extends Dictionary<TSource>,
                        TDestination extends Dictionary<TDestination>,
                        IsAsync extends boolean = false,
                        Result = IsAsync extends true ? Promise<TDestination[]> : TDestination[]
                    >(
                        sourceArray: TSource[],
                        sourceIdentifier: ModelIdentifier<TSource>,
                        destinationIdentifierOrOptions?:
                            | ModelIdentifier<TDestination>
                            | MapOptions<TSource[], TDestination[]>,
                        options?: MapOptions<TSource[], TDestination[]>,
                        isAsync?: IsAsync
                    ): Result => {
                        if (!sourceArray.length) return (isAsync ? Promise.resolve<TDestination[]>([]) : []) as Result;

                        const { destinationIdentifier, mapOptions } =
                            getOptions(
                                sourceIdentifier,
                                destinationIdentifierOrOptions,
                                options
                            );

                        const mapping = getMapping(
                            receiver,
                            sourceIdentifier,
                            destinationIdentifier
                        );

                        const { beforeMap, afterMap, extraArgs } =
                            (mapOptions || {}) as MapOptions<
                                TSource[],
                                TDestination[]
                            >;

                        // ASYNCRONOUS
                        if (isAsync) {
                            return Promise.resolve<{
                                  sourceArray: TSource[];
                                  destinationArray: TDestination[];
                              }>({
                                sourceArray,
                                destinationArray: [],
                              }).then(async ({ sourceArray, destinationArray }) => {
                                if (beforeMap) {
                                  await beforeMap(sourceArray, []);
                                }

                                for (
                                    let i = 0, length = sourceArray.length;
                                    i < length;
                                    i++
                                ) {
                                    let sourceObject = sourceArray[i];
                                    sourceObject = await strategy.preMap(
                                        sourceObject,
                                        mapping
                                    );

                                    let destination = await mapReturn<TSource, TDestination, true>(
                                        mapping,
                                        sourceObject,
                                        {
                                            extraArgs: extraArgs as MapOptions<
                                                TSource,
                                                TDestination
                                            >['extraArgs'],
                                        },
                                        true, // isMapArray
                                        isAsync,
                                    );

                                    destination = await strategy.postMap(
                                        sourceObject,
                                        // seal destination so that consumers cannot add properties to it
                                        // or change the property descriptors. but they can still modify it
                                        // the ideal behavior is seal but the consumers might need to add/modify the object after map finishes
                                        destination,
                                        mapping
                                    );

                                    destinationArray.push(destination);
                                }

                                if (afterMap) {
                                  await afterMap(sourceArray, destinationArray);
                                }

                                return destinationArray;
                            }) as Result;
                        }

                        // SYNCRONOUS

                        if (beforeMap) {
                            beforeMap(sourceArray, []);
                        }

                        const destinationArray: TDestination[] = [];

                        for (
                            let i = 0, length = sourceArray.length;
                            i < length;
                            i++
                        ) {
                            let sourceObject = sourceArray[i];
                            sourceObject = strategy.preMap(
                                sourceObject,
                                mapping
                            );

                            let destination = mapReturn<TSource, TDestination, false>(
                                mapping,
                                sourceObject,
                                {
                                    extraArgs: extraArgs as MapOptions<
                                        TSource,
                                        TDestination
                                    >['extraArgs'],
                                },
                                true
                            );

                            destination = strategy.postMap(
                                sourceObject,
                                // seal destination so that consumers cannot add properties to it
                                // or change the property descriptors. but they can still modify it
                                // the ideal behavior is seal but the consumers might need to add/modify the object after map finishes
                                destination,
                                mapping
                            );

                            destinationArray.push(destination);
                        }

                        if (afterMap) {
                            afterMap(sourceArray, destinationArray);
                        }

                        return destinationArray as Result;
                    };
                }

                if (p === 'mapArrayAsync') {
                    return <
                        TSource extends Dictionary<TSource>,
                        TDestination extends Dictionary<TDestination>
                    >(
                        sourceArray: TSource[],
                        sourceIdentifier: ModelIdentifier<TSource>,
                        destinationIdentifierOrOptions?:
                            | ModelIdentifier<TDestination>
                            | MapOptions<TSource[], TDestination[]>,
                        options?: MapOptions<TSource[], TDestination[]>
                    ) => {
                        return receiver['mapArray'](
                                sourceArray,
                                sourceIdentifier,
                                destinationIdentifierOrOptions,
                                options,
                                true
                            );
                    };
                }

                if (p === 'mutate') {
                    return <
                        TSource extends Dictionary<TSource>,
                        TDestination extends Dictionary<TDestination>,
                        IsAsync extends boolean | undefined = undefined,
                        Result = IsAsync extends true ? Promise<void> : void
                    >(
                        sourceObject: TSource,
                        destinationObject: TDestination,
                        sourceIdentifier: ModelIdentifier<TSource>,
                        destinationIdentifierOrOptions?:
                            | ModelIdentifier<TDestination>
                            | MapOptions<TSource, TDestination>,
                        options?: MapOptions<TSource, TDestination>,
                        isAsync?: IsAsync
                    ): Result => {
                        if (sourceObject == null) return (isAsync ? Promise.resolve() : undefined) as Result;

                        const { destinationIdentifier, mapOptions } =
                            getOptions(
                                sourceIdentifier,
                                destinationIdentifierOrOptions,
                                options
                            );

                        const mapping = getMapping(
                            receiver,
                            sourceIdentifier,
                            destinationIdentifier
                        );

                        if (isAsync) {
                          return Promise.resolve(sourceObject).then(async (sourceObject) => {
                            sourceObject = await strategy.preMap(sourceObject, mapping);

                            await mapMutate(
                                mapping,
                                sourceObject,
                                destinationObject,
                                <MapOptions<TSource, TDestination>> mapOptions || {},
                                false, // isMapArray
                                isAsync
                            );

                            await strategy.postMap(
                                sourceObject,
                                destinationObject,
                                mapping
                            );

                            return undefined;
                          }) as Result;
                        }

                        sourceObject = strategy.preMap(sourceObject, mapping);

                        mapMutate(
                            mapping,
                            sourceObject,
                            destinationObject,
                            mapOptions || {}
                        );

                        strategy.postMap(
                            sourceObject,
                            destinationObject,
                            mapping
                        );

                        return undefined as Result;
                    };
                }
                if (p === 'mutateAsync') {
                    return <
                        TSource extends Dictionary<TSource>,
                        TDestination extends Dictionary<TDestination>
                    >(
                        sourceObject: TSource,
                        destinationObject: TDestination,
                        sourceIdentifier: ModelIdentifier<TSource>,
                        destinationIdentifierOrOptions?:
                            | ModelIdentifier<TDestination>
                            | MapOptions<TSource, TDestination>,
                        options?: MapOptions<TSource, TDestination>
                    ) => {
                        return receiver['mutate'](
                            sourceObject,
                            destinationObject,
                            sourceIdentifier,
                            destinationIdentifierOrOptions,
                            options,
                            true
                        );
                    };
                }

                if (p === 'mutateArray') {
                    return <
                        TSource extends Dictionary<TSource>,
                        TDestination extends Dictionary<TDestination>,
                        IsAsync extends boolean | undefined = undefined,
                        Result = IsAsync extends true ? Promise<void> : void
                    >(
                        sourceArray: TSource[],
                        destinationArray: TDestination[],
                        sourceIdentifier: ModelIdentifier<TSource>,
                        destinationIdentifierOrOptions?:
                            | ModelIdentifier<TDestination>
                            | MapOptions<TSource[], TDestination[]>,
                        options?: MapOptions<TSource[], TDestination[]>,
                        isAsync?: IsAsync
                    ): Result => {
                        if (!sourceArray.length) return (isAsync ? Promise.resolve : undefined) as Result;

                        const { destinationIdentifier, mapOptions } =
                            getOptions(
                                sourceIdentifier,
                                destinationIdentifierOrOptions,
                                options
                            );

                        const mapping = getMapping(
                            receiver,
                            sourceIdentifier,
                            destinationIdentifier
                        );

                        const { beforeMap, afterMap, extraArgs } =
                            (mapOptions || {}) as MapOptions<
                                TSource[],
                                TDestination[]
                            >;

                        if (isAsync) {
                            return Promise.resolve<{
                                  sourceArray: TSource[];
                                  destinationArray: TDestination[];
                              }>({
                                sourceArray,
                                destinationArray,
                              }).then(async ({ sourceArray, destinationArray }) => {
                                if (beforeMap) {
                                  await beforeMap(sourceArray, destinationArray);
                                }

                                for (
                                    let i = 0, length = sourceArray.length;
                                    i < length;
                                    i++
                                ) {
                                    let sourceObject = sourceArray[i];

                                    sourceObject = await strategy.preMap(
                                        sourceObject,
                                        mapping
                                    );

                                    await mapMutate(
                                        mapping,
                                        sourceObject,
                                        destinationArray[i] || {},
                                        {
                                            extraArgs: extraArgs as MapOptions<
                                                TSource,
                                                TDestination
                                            >['extraArgs'],
                                        },
                                        true,
                                        isAsync
                                    );

                                    await strategy.postMap(
                                        sourceObject,
                                        destinationArray[i],
                                        mapping
                                    );
                                }

                                if (afterMap) {
                                  await afterMap(sourceArray, destinationArray);
                                }

                                return undefined;
                            }) as Result;
                        }

                        if (beforeMap) {
                            beforeMap(sourceArray, destinationArray);
                        }

                        for (
                            let i = 0, length = sourceArray.length;
                            i < length;
                            i++
                        ) {
                            let sourceObject = sourceArray[i];

                            sourceObject = strategy.preMap(
                                sourceObject,
                                mapping
                            );

                            mapMutate(
                                mapping,
                                sourceObject,
                                destinationArray[i] || {},
                                {
                                    extraArgs: extraArgs as MapOptions<
                                        TSource,
                                        TDestination
                                    >['extraArgs'],
                                },
                                true
                            );

                            strategy.postMap(
                                sourceObject,
                                destinationArray[i],
                                mapping
                            );
                        }

                        if (afterMap) {
                            afterMap(sourceArray, destinationArray);
                        }

                        return undefined as Result;
                    };
                }

                if (p === 'mutateArrayAsync') {
                    return <
                        TSource extends Dictionary<TSource>,
                        TDestination extends Dictionary<TDestination>
                    >(
                        sourceArray: TSource[],
                        destinationArray: TDestination[],
                        sourceIdentifier: ModelIdentifier<TSource>,
                        destinationIdentifierOrOptions?:
                            | ModelIdentifier<TDestination>
                            | MapOptions<TSource[], TDestination[]>,
                        options?: MapOptions<TSource[], TDestination[]>
                    ) => {
                        return receiver['mutateArray'](
                            sourceArray,
                            destinationArray,
                            sourceIdentifier,
                            destinationIdentifierOrOptions,
                            options,
                            true
                        );
                    };
                }

                return Reflect.get(target, p, receiver);
            },
        }
    );
}
