export const PageHeader = ({ eyebrow, title, description, children }) => {
    return (
        <div className="page-heading">
            <div>
                {eyebrow && <p className="eyebrow">{eyebrow}</p>}
                <h1>{title}</h1>
                {description && <p className="subtitle">{description}</p>}
            </div>
            {children}
        </div>
    );
};
