import { catalogResources } from '../config/catalogResources.js';
export const createCatalogDraft = (resource, initial) => {
    return Object.fromEntries(
        catalogResources[resource].fields.map(([key, , type]) => [
            key,
            initial?.[key] ?? (type === 'checkbox' ? true : ['decimal', 'integer'].includes(type) ? 0 : '')
        ])
    );
};
export const catalogPayload = (resource, form) => {
    const values = { ...form };
    catalogResources[resource].fields.forEach(([key, , type]) => {
        if (type === 'integer') values[key] = Number(values[key]);
        if (type === 'decimal') values[key] = String(values[key] || 0);
        if (type === 'checkbox') values[key] = !!values[key];
        if (['nid_number', 'tin_number'].includes(key) && !values[key]) values[key] = null;
        if (key === 'password' && !values[key]) delete values[key];
    });
    return values;
};
