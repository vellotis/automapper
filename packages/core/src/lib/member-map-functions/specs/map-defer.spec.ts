import {
  type DeferFunction,
  Dictionary,
  MapFnClassId,
  TransformationType
} from '../../types';
import { ignore } from '../ignore';
import { mapDefer } from '../map-defer';

describe(mapDefer.name, () => {
    it('should return correctly', () => {
        const defer = () => ignore();

        const mapDeferFn = mapDefer(defer);

        expect(mapDeferFn).toBeTruthy();
        expect(mapDeferFn[MapFnClassId.type]).toEqual(
            TransformationType.MapDefer
        );
        expect(mapDeferFn[MapFnClassId.fn]).toBe(defer);
    });

    // Static type checks
    // eslint-disable-next-line @typescript-eslint/no-empty-function,@typescript-eslint/no-unused-vars
    function expectType<TExpected>(actualType: TExpected) {}
    // eslint-disable-next-line @typescript-eslint/no-empty-function,@typescript-eslint/no-unused-vars
    function itCheckTypes() {

      // Type checks passing

      expectType<[
        TransformationType.MapDefer,
        DeferFunction<Dictionary<unknown>, Dictionary<unknown>, unknown>
      ]>(mapDefer<Dictionary<unknown>, Dictionary<unknown>, unknown>(() => ignore()));

      expectType<[
        TransformationType.MapDefer,
        DeferFunction<Dictionary<unknown>, Dictionary<unknown>, unknown, false>
      ]>(mapDefer<Dictionary<unknown>, Dictionary<unknown>, unknown>(() => ignore()));

      expectType<[
        TransformationType.MapDefer,
        DeferFunction<Dictionary<unknown>, Dictionary<unknown>, unknown>
      ]>(mapDefer<Dictionary<unknown>, Dictionary<unknown>, unknown, false>(() => ignore()));

      expectType<[
        TransformationType.MapDefer,
        DeferFunction<Dictionary<unknown>, Dictionary<unknown>, unknown, false>
      ]>(mapDefer<Dictionary<unknown>, Dictionary<unknown>, unknown, false>(() => ignore()));

      expectType<[
        TransformationType.MapDefer,
        DeferFunction<Dictionary<unknown>, Dictionary<unknown>, unknown, true>
      ]>(mapDefer<Dictionary<unknown>, Dictionary<unknown>, unknown, true>(() => Promise.resolve(ignore())));

      expectType<[
        TransformationType.MapDefer,
        DeferFunction<Dictionary<unknown>, Dictionary<unknown>, unknown>
      ]>(mapDefer<Dictionary<unknown>, Dictionary<unknown>, unknown>(() => Promise.resolve(ignore())));

      // Type checks failing

      expectType<[
        TransformationType.MapDefer,
        DeferFunction<Dictionary<unknown>, Dictionary<unknown>, unknown, true>
        // @ts-expect-error: TS2345
      ]>(mapDefer<Dictionary<unknown>, Dictionary<unknown>, unknown>(() => ignore()));

      expectType<[
        TransformationType.MapDefer,
        DeferFunction<Dictionary<unknown>, Dictionary<unknown>, unknown, true>
        // @ts-expect-error: TS2345
      ]>(mapDefer<Dictionary<unknown>, Dictionary<unknown>, unknown, false>(() => ignore()));

      expectType<[
        TransformationType.MapDefer,
        DeferFunction<Dictionary<unknown>, Dictionary<unknown>, unknown, false>
        // @ts-expect-error: TS2345
      ]>(mapDefer<Dictionary<unknown>, Dictionary<unknown>, unknown, true>(() => ignore()));
    }
});
