export const errorText = (error) =>
    error?.data?.errorMessages?.length
        ? error.data.errorMessages.map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`).join('; ')
        : error?.data?.message || error?.message || 'The request could not be completed';
