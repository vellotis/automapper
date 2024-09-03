import {
    Dictionary,
    MapOptions,
    MapWithReturn,
    ModelIdentifier,
    SelectorReturn,
    TransformationType,
    ValueSelector
} from '../types';
import { asyncAware } from '../utils/async-aware';

type Constructor<TModel> = new (...args: unknown[]) => TModel;

export function mapWith<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>,
    TSelectorReturn = SelectorReturn<TDestination>,
    TWithDestination extends ModelIdentifier = ModelIdentifier,
    TWithSource extends ModelIdentifier = ModelIdentifier,
    TWithSourceValue extends ValueSelector = TWithSource extends Constructor<
        infer InferredWithSource
    >
        ? ValueSelector<TSource, InferredWithSource>
        : ValueSelector<TSource>
>(
    withDestination: TWithDestination,
    withSource: TWithSource,
    withSourceValue: TWithSourceValue
): MapWithReturn<TSource, TDestination, TSelectorReturn> {
    return [
        TransformationType.MapWith,
        (source, mapper, options, isAsync) => {
            return asyncAware(() => withSourceValue(source) as TWithSource, (nestedObject) => {
                if (Array.isArray(nestedObject)) {
                    return (isAsync ? mapper.mapArrayAsync<TWithSource, TDestination> : mapper.mapArray<TWithSource, TDestination>)(
                        nestedObject,
                        withSource,
                        withDestination,
                        options as unknown as MapOptions<TWithSource[], TDestination[]>
                    ) as TSelectorReturn;
                }

                return (isAsync ? mapper.mapAsync<TWithSource, TDestination> : mapper.map<TWithSource, TDestination>)(
                    nestedObject,
                    withSource,
                    withDestination,
                    options as unknown as MapOptions<TWithSource, TDestination>
                ) as TSelectorReturn;
            }, isAsync);
        },
    ];
}
