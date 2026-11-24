import { useCallback, useRef } from 'react';
import { createRequestKeys } from '../lib/idempotency';
export const useIdempotentMutation = ([trigger, state]) => {
    const keys = useRef(null);
    if (!keys.current) keys.current = createRequestKeys();
    const submit = useCallback(
        async (args) => {
            const result = await trigger({ ...args, key: keys.current.forRequest(args) }).unwrap();
            keys.current.complete(args);
            return result;
        },
        [trigger]
    );
    return [submit, state];
};
