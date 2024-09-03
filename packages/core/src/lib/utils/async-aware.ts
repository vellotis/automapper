import { isPromise } from './is-promise';

export function asyncAware<
  TAwaited,
  TOperationResult,
  IsAsync extends boolean = false,
  Result = IsAsync extends true ? Promise<TOperationResult> : TOperationResult
>(
    awaitable: (isAsync: IsAsync) => TAwaited | Promise<TAwaited>,
    operation: (awaited: TAwaited, isAsync: IsAsync) => TOperationResult | Promise<TOperationResult>,
    isAsync?: IsAsync
): Result {
    const awaited = awaitable(isAsync as IsAsync);

    if (isAsync) {
        return Promise.resolve(awaited).then((awaited) => {
            return operation(awaited, isAsync as true as IsAsync);
        }) as Result;
    } else {
      if (isPromise(awaited)) throw new Error(
          'Use `Mapper::mapAsync` instead of `Mapper::map` as the mapping contains async operations'
      );
      return operation(awaited as Awaited<TAwaited>, isAsync as false as IsAsync) as Result;
    }
}
