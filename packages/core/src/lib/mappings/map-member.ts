import {
    ConditionReturn,
    ConvertUsingReturn,
    Dictionary,
    FromValueReturn,
    MapDeferReturn,
    MapFnClassId,
    MapFromReturn,
    Mapper,
    MapWithArgumentsReturn,
    MapWithReturn,
    MemberMapReturn,
    MetadataIdentifier,
    Primitive,
    SelectorReturn,
    TransformationType
} from '../types';
import { isDateConstructor } from '../utils/is-date-constructor';
import { isPrimitiveConstructor } from '../utils/is-primitive-constructor';
import { asyncAware } from '../utils/async-aware';

export function mapMember<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>,
    IsAsync extends boolean = false,
>(
    transformationMapFn: MemberMapReturn<TSource, TDestination>,
    sourceObject: TSource,
    destinationObject: TDestination,
    destinationMemberPath: string[],
    extraArgs: Record<string, any> | undefined,
    mapper: Mapper,
    sourceMemberIdentifier?: MetadataIdentifier | Primitive | Date,
    destinationMemberIdentifier?: MetadataIdentifier | Primitive | Date,
    isAsync?: IsAsync,
) {
    let value: unknown;
    const transformationType: TransformationType =
        transformationMapFn[MapFnClassId.type];
    const mapFn = transformationMapFn[MapFnClassId.fn];
    const shouldRunImplicitMap = !(
        isPrimitiveConstructor(sourceMemberIdentifier) ||
        isPrimitiveConstructor(destinationMemberIdentifier) ||
        isDateConstructor(sourceMemberIdentifier) ||
        isDateConstructor(destinationMemberIdentifier)
    );

    switch (transformationType) {
        case TransformationType.MapFrom:
            value = (
                mapFn as MapFromReturn<TSource, TDestination>[MapFnClassId.fn]
            )(sourceObject);
            break;
        case TransformationType.FromValue:
            value = (
                mapFn as FromValueReturn<TSource, TDestination>[MapFnClassId.fn]
            )();
            break;
        case TransformationType.MapWith:
            value = (
                mapFn as MapWithReturn<TSource, TDestination>[MapFnClassId.fn]
            )(
                sourceObject,
                mapper,
                extraArgs ? { extraArgs: () => extraArgs } : undefined,
                isAsync
            );
            break;
        case TransformationType.ConvertUsing:
            value = (
                mapFn as ConvertUsingReturn<
                    TSource,
                    TDestination
                >[MapFnClassId.fn]
            )(sourceObject, isAsync as IsAsync);
            break;
        case TransformationType.Condition:
        case TransformationType.NullSubstitution:
        case TransformationType.UndefinedSubstitution:
            value = asyncAware(
                () => (
                    mapFn as ConditionReturn<TSource, TDestination>[MapFnClassId.fn]
                )(sourceObject, destinationMemberPath, isAsync as boolean),
                (value) => {
                    if (shouldRunImplicitMap && value != null) {
                        return Array.isArray(value)
                            ? mapper.mapArray(
                              value,
                              sourceMemberIdentifier as MetadataIdentifier,
                              destinationMemberIdentifier as MetadataIdentifier
                            )
                            : mapper.map(
                              value,
                              sourceMemberIdentifier as MetadataIdentifier,
                              destinationMemberIdentifier as MetadataIdentifier
                            );
                    }
                    return value;
                },
                isAsync
            );

            break;
        case TransformationType.MapWithArguments:
            value = (
                mapFn as MapWithArgumentsReturn<
                    TSource,
                    TDestination
                >[MapFnClassId.fn]
            )(sourceObject, extraArgs || {});
            break;
        case TransformationType.MapDefer: {
          value = asyncAware(() => (
            mapFn as MapDeferReturn<
              TSource,
              TDestination,
              SelectorReturn<TDestination>
            >[MapFnClassId.fn]
          )(sourceObject), (deferFunction) => {
            return mapMember(
              deferFunction,
              sourceObject,
              destinationObject,
              destinationMemberPath,
              extraArgs,
              mapper,
              sourceMemberIdentifier,
              destinationMemberIdentifier,
              isAsync
            );
          }, isAsync);

          break;
        }
    }
    return value;
}
