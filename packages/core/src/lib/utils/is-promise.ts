/**
 * Check if value is a Promise
 *
 * @param value
 */
export function isPromise(value: unknown): value is Promise<unknown> {
    return (
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        //            TS2339: Property then does not exist on type {}
        typeof (value === null || value === void 0 ? void 0 : value.then) === 'function'
    );
}
