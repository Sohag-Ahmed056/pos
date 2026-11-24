const variants = { primary: 'btn', secondary: 'btn-secondary', icon: 'icon-button' };
export const Button = ({
    as: Component = 'button',
    type = 'button',
    variant = 'primary',
    className = '',
    children,
    ...props
}) => {
    return (
        <Component
            {...(Component === 'button' ? { type } : {})}
            className={`${variants[variant] || variants.primary} ${className}`}
            {...props}
        >
            {children}
        </Component>
    );
};
