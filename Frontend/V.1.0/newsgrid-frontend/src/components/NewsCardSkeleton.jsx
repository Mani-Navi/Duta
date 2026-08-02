const NewsCardSkeleton = () => {
    return (
        <div className="card skeleton-card" aria-hidden="true">
            <div className="card-top">
                <div className="skeleton-badge shimmer" />
                <div className="skeleton-title-line shimmer" style={{ width: '40%' }} />
            </div>
            <div className="skeleton-title-line shimmer" style={{ width: '100%', height: '20px', margin: '12px 0 6px 0' }} />
            <div className="skeleton-title-line shimmer" style={{ width: '70%', height: '20px', marginBottom: '16px' }} />
            <div className="card-bottom" style={{ borderTop: '1px solid rgba(128,128,128,0.1)', paddingTop: '10px' }}>
                <div className="skeleton-time shimmer" />
            </div>
        </div>
    );
};

export default NewsCardSkeleton;