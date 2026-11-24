const canonical = (value) => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
        return Object.fromEntries(
            Object.keys(value)
                .sort()
                .map((key) => [key, canonical(value[key])])
        );
    return value;
};
export const createRequestKeys = (createKey = () => crypto.randomUUID()) => {
    const keys = new Map();
    const signature = (args) => JSON.stringify(canonical(args));
    return {
        forRequest: (args) => {
            const id = signature(args);
            if (!keys.has(id)) keys.set(id, createKey());
            return keys.get(id);
        },
        complete: (args) => {
            keys.delete(signature(args));
        }
    };
};
