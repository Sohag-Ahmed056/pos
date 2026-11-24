export const MetricCard = ({ title, value, icon: Icon, featured = false, caption, className = '' }) => {
    return (
        <div className={`metric ${featured ? 'metric-featured' : ''} ${className}`}>
            <div className="mb-5 flex items-center justify-between">
                <span className="text-sm font-semibold opacity-90">{title}</span>
                {Icon && <Icon size={20} className="opacity-80" />}
            </div>
            <p className="text-[30px] font-bold tracking-tight tabular-nums">{value}</p>
            {caption && <p className="mt-3 text-sm opacity-80">{caption}</p>}
        </div>
    );
};
