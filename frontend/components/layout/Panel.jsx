export const Panel = ({ title, description, action, children, footer, className = '' }) => {
    return (
        <section className={`panel ${className}`}>
            {(title || action) && (
                <div className="panel-heading">
                    <div>
                        {title && <h2>{title}</h2>}
                        {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
                    </div>
                    {action}
                </div>
            )}
            {children}
            {footer}
        </section>
    );
};
