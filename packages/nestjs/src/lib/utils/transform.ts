import type {
    Dictionary,
    MapOptions,
    Mapper,
    ModelIdentifier,
} from '@automapper/core';
import { isEmpty } from '@automapper/core';

export function shouldSkipTransform<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>
>(
    mapper: Mapper | undefined,
    from: ModelIdentifier<TDestination>,
    to: ModelIdentifier<TSource>
): boolean {
    return !mapper || !to || !from;
}

export function transformArray<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>
>(
    value: TSource[],
    mapper: Mapper | undefined,
    from: ModelIdentifier<TSource>,
    to: ModelIdentifier<TDestination>,
    options?: MapOptions<TSource[], TDestination[]>,
    isAsync?: boolean
) {
    if (!Array.isArray(value)) return value;
    return (isAsync ? mapper?.mapArrayAsync<TSource, TDestination> : mapper?.mapArray<TSource, TDestination>)?.(
        value,
        from,
        to,
        options
    );
}

export function getTransformOptions<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>
>(
    options?: { isArray?: boolean; mapperName?: string, sync?: boolean } & MapOptions<
        TSource,
        TDestination
    >
): {
    mapperName?: string;
    isArray: boolean;
    isAsync: boolean;
    transformedMapOptions?: MapOptions<TSource, TDestination>;
} {
    const { isArray = false, mapperName, sync = false, ...mapOptions } = options || {};
    const transformedMapOptions = isEmpty(mapOptions) ? undefined : mapOptions;
    return { isArray, mapperName, isAsync: !sync, transformedMapOptions };
}
