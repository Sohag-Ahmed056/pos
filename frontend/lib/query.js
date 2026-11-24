export const queryString = (filters = {}) => {
    return new URLSearchParams(
        Object.entries(filters).filter(([, value]) => value !== '' && value !== null && value !== undefined)
    ).toString();
};
export const collectionUrl = (resource, filters) => {
    const query = queryString(filters);
    return `/${resource}${query ? `?${query}` : ''}`;
};
export const mutationRequest = (url, body = {}, method = 'POST', key) => ({
    url,
    method,
    body,
    ...(key ? { headers: { 'Idempotency-Key': key } } : {})
});
