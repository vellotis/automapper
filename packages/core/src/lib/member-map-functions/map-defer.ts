import type { DeferFunction, Dictionary, MapDeferReturn } from '../types';
import { SelectorReturn, TransformationType } from '../types';

export function mapDefer<
    TSource extends Dictionary<TSource> = any,
    TDestination extends Dictionary<TDestination> = any,
    TSelectorReturn = SelectorReturn<TDestination>,
    IsAsync extends boolean = TSelectorReturn extends Promise<unknown> ? true : false
>(
    defer: DeferFunction<TSource, TDestination, TSelectorReturn, IsAsync>
): MapDeferReturn<TSource, TDestination, TSelectorReturn, IsAsync> {
    return [TransformationType.MapDefer, defer];
}
