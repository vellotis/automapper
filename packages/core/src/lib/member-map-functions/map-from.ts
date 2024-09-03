import type {
    Dictionary,
    MapFromReturn,
    Resolver,
    SelectorReturn,
    ValueSelector,
} from '../types';
import { TransformationType } from '../types';
import { isResolver } from '../utils/is-resolver';

export function mapFrom<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>,
    TSelectorReturn = SelectorReturn<TDestination>
>(
    from:
        | ValueSelector<TSource, TDestination, TSelectorReturn | Promise<TSelectorReturn>>
        | Resolver<TSource, TDestination, TSelectorReturn | Promise<TSelectorReturn>>
): MapFromReturn<TSource, TDestination, TSelectorReturn | Promise<TSelectorReturn>> {
    if (isResolver(from)) {
        return [TransformationType.MapFrom, from.resolve.bind(from)];
    }

    return [TransformationType.MapFrom, from];
}
