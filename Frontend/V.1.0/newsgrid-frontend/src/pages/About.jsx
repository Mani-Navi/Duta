import strings from '../strings/strings';

function About({ lang }) {
    const t = strings[lang];

    return (
        <div className="page-content">
            <div className="page-header">
                <h1>{t.aboutTitle}</h1>
                <p>{t.aboutDesc}</p>
            </div>

            {/* درباره پروژه */}
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

            {/* تماس */}
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
                    <a
                        className="contact-btn contact-btn-secondary"
                        href="https://github.com/Mani-Navi/NewsGrid"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <i className="ti ti-brand-github" />
                        GitHub
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
