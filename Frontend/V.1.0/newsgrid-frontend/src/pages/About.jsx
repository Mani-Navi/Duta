import strings from '../strings/strings';

function About() {
    const t = strings.fa;

    return (
        <div className="page-content">
            <div className="page-header">
                {/* جایگزینی لوگوی رسمی برندی Nitt به جای متن ساده */}
                <div className="about-logo-header" dir="ltr" aria-label="Nitt — News in Bites">
                    <span className="logo-text" style={{ fontSize: '36px' }}>
                        N<span className="logo-dot">i</span>tt
                    </span>
                    <span className="logo-divider" style={{ height: '24px' }} />
                    <span className="logo-sub" style={{ fontSize: '15px' }}>News in Bites</span>
                </div>

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