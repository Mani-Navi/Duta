const NewsCardSkeleton = () => {
    return (
        <div className="card skeleton-card" aria-hidden="true">
            <div className="card-top">
                <div className="src-group">
                    <div className="skeleton-badge shimmer" />
                    <div className="skeleton-title-line shimmer" style={{ width: '60px' }} />
                </div>
                <div className="skeleton-title-line shimmer" style={{ width: '38px', borderRadius: '20px' }} />
            </div>
            <div className="skeleton-title-line shimmer" style={{ width: '100%', height: '15px', margin: '12px 0 6px 0' }} />
            <div className="skeleton-title-line shimmer" style={{ width: '70%', height: '15px', marginBottom: '14px' }} />
            <div className="card-bottom">
                <div className="skeleton-time shimmer" />
            </div>
        </div>
    );
};

export default NewsCardSkeleton;