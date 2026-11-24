// Keep the acknowledged draft checkpoint while retrying an uncertain posting response.
// Re-saving first could reject a draft that the server has already posted successfully.
export const createDocumentSubmission = (initialId) => {
    let id = initialId;
    let savedPayload;
    const submit = async ({ kind, values, payment = {}, postNow }, { saveDraft, post }) => {
        const signature = JSON.stringify(values);
        if (savedPayload !== signature) {
            const response = await saveDraft({ kind, id, values });
            id = response.data.id;
            savedPayload = signature;
        }
        if (postNow) await post({ kind, id, values: payment });
        return { id };
    };
    return submit;
};
