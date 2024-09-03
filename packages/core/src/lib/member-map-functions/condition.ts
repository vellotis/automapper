import type {
    ConditionPredicate,
    ConditionReturn,
    Dictionary,
    SelectorReturn,
} from '../types';
import { TransformationType } from '../types';
import { get } from '../utils/get';
import { asyncAware } from '../utils/async-aware';

export function condition<
    TSource extends Dictionary<TSource>,
    TDestination extends Dictionary<TDestination>,
    TSelectorReturn = SelectorReturn<TDestination>
>(
    predicate: ConditionPredicate<TSource>,
    defaultValue?: TSelectorReturn
): ConditionReturn<TSource, TDestination, TSelectorReturn> {
    return [
        TransformationType.Condition,
        (source, sourceMemberPaths, isAsync) => {
            return asyncAware(() => predicate(source), (predicateResult) => {
                if (predicateResult) {
                    return get(source, sourceMemberPaths) as TSelectorReturn;
                }

                return defaultValue as TSelectorReturn;
            }, isAsync)
        },
    ];
}
