/**
 * Check if value is a Promise
 *
 * @param value
 */
export function isPromise(value: unknown): value is Promise<unknown> {
    return (
        typeof (value === null || value === void 0 ? void 0 : (value as any).then) === 'function'
    );
}
