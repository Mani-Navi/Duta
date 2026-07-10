import strings from '../strings/strings';

function ArticleDetail({ lang, article }) {
    const t = strings[lang];

    const getBadgeClass = (credibility) => {
        if (credibility >= 80) return 'green';
        if (credibility >= 50) return 'yellow';
        return 'red';
    };

    const getScoreLabel = (credibility) => {
        if (credibility >= 80) return lang === 'fa' ? 'تأیید شده' : 'Verified';
        if (credibility >= 50) return lang === 'fa' ? 'در حال بررسی' : 'Developing';
        return lang === 'fa' ? 'نامعتبر' : 'Unverified';
    };

    const getScoreDesc = (credibility) => {
        if (credibility >= 80) return lang === 'fa'
            ? 'این خبر توسط منابع معتبر پوشش داده شده است.'
            : 'This story has been covered by credible sources.';
        if (credibility >= 50) return lang === 'fa'
            ? 'این خبر هنوز توسط منابع بیشتری تأیید نشده است.'
            : 'This story has not yet been confirmed by more sources.';
        return lang === 'fa'
            ? 'هیچ منبع معتبری این خبر را تأیید نکرده است.'
            : 'No credible source has confirmed this story.';
    };

    const getScoreColor = (credibility) => {
        if (credibility >= 80) return '#34C759';
        if (credibility >= 50) return '#FF9500';
        return '#FF3B30';
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const diff = Math.floor((Date.now() - new Date(dateStr)) / 60000);
        if (diff < 60) return lang === 'fa' ? `${diff} دقیقه پیش` : `${diff} minutes ago`;
        const hours = Math.floor(diff / 60);
        if (hours < 24) return lang === 'fa' ? `${hours} ساعت پیش` : `${hours} hours ago`;
        const days = Math.floor(hours / 24);
        return lang === 'fa' ? `${days} روز پیش` : `${days} days ago`;
    };

    const buildRing = (score, color) => {
        const r = 21, cx = 27, cy = 27;
        const circ = 2 * Math.PI * r;
        const fill = (score / 100) * circ;
        return (
            <svg width="54" height="54" viewBox="0 0 54 54"
                 style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={cx} cy={cy} r={r} fill="none"
                        stroke="rgba(130,130,140,0.18)" strokeWidth="4" />
                <circle cx={cx} cy={cy} r={r} fill="none"
                        stroke={color} strokeWidth="4"
                        strokeDasharray={`${fill} ${circ}`}
                        strokeLinecap="round" />
            </svg>
        );
    };

    const credibility = article.source?.credibility || 0;
    const badgeClass = getBadgeClass(credibility);
    const scoreColor = getScoreColor(credibility);
    const category = article.source?.category;

    return (
        <div className="detail-content">

            {/* Meta */}
            <div className="detail-meta">
                {category && (
                    <span className="detail-category">
            {lang === 'fa' ? category.nameFa : category.nameEn}
          </span>
                )}
                <span className="detail-time">
          {formatTime(article.publishedAt)}
        </span>
            </div>

            {/* تیتر */}
            <div className="detail-title">{article.title}</div>

            {/* امتیاز اعتبار */}
            <div className="group-card">
                <div className="cred-row">
                    <div className="cred-ring-wrap">
                        {buildRing(credibility, scoreColor)}
                        <div className="cred-num" style={{ color: scoreColor }}>
                            {credibility}
                        </div>
                    </div>
                    <div>
            <span className="cred-status" style={{ color: scoreColor }}>
              {getScoreLabel(credibility)}
            </span>
                        <div className="cred-desc">
                            {getScoreDesc(credibility)}
                        </div>
                    </div>
                </div>
            </div>

            {/* منبع */}
            <div className="sources-title">
                {t.sourcesCoveredBy(1)}
            </div>

            <div className="source-list">
                <div
                    className="source-item"
                    onClick={() => window.open(article.url, '_blank')}
                >
                    <div className="source-info">
                        <div className="source-icon">
                            {article.source?.name?.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                            <div className="source-name">{article.source?.name}</div>
                            <div className="source-time-label">
                                {formatTime(article.publishedAt)}
                            </div>
                        </div>
                    </div>
                    <div className="source-right">
            <span className={`source-badge ${badgeClass}`}>
              {getScoreLabel(credibility)}
            </span>
                        <i className={`ti ${lang === 'fa'
                            ? 'ti-chevron-left'
                            : 'ti-chevron-right'} arrow-icon`}
                        />
                    </div>
                </div>
            </div>

            <div className="footer-note">{t.clickToRead}</div>
        </div>
    );
}

export default ArticleDetail;