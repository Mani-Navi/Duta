import strings from '../strings/strings';

function About() {
    const t = strings.fa;

    return (
        <div className="page-content">
            <div className="page-header">
                {/* تایپوگرافی رسمی Duta با حرف D آبی‌رنگ متمایز */}
                <h1 className="about-title-heading">
                    درباره{' '}
                    <span className="about-brand-wordmark" dir="ltr" aria-label="Duta">
                        <span className="wordmark-blue">D</span>uta
                    </span>
                </h1>

                <p>{t.aboutDesc}</p>
            </div>

            <div className="about-section">
                {t.aboutBlocks.map((block, i) => (
                    <div className="feature-card" key={i} style={{ marginBottom: '12px' }}>
                        <div className="feature-icon">
                            <i className={`ti ${block.icon}`} aria-hidden="true" />
                        </div>
                        <h3>{block.title}</h3>
                        <p>{block.desc}</p>
                    </div>
                ))}
            </div>

            <div className="about-contact">
                <div className="about-contact-title">{t.aboutContactTitle}</div>
                <p className="about-contact-desc">{t.aboutContactDesc}</p>

                <div className="about-contact-links">
                    <a
                        className="contact-btn"
                        href={`mailto:${t.aboutEmail}?subject=${encodeURIComponent(t.aboutEmailSubject)}`}
                    >
                        <i className="ti ti-mail" />
                        {t.aboutEmail}
                    </a>
                </div>

                <div className="about-topics">
                    {t.aboutTopics.map((topic, i) => (
                        <span className="about-topic-chip" key={i}>{topic}</span>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default About;