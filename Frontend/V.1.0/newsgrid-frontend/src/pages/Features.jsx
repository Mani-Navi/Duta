import strings from '../strings/strings';

function Features({ lang }) {
    const t = strings[lang];

    return (
        <div className="page-content">
            <div className="page-header">
                <h1>{t.featuresTitle}</h1>
                <p>{t.featuresDesc}</p>
            </div>

            <div className="feature-grid">
                {t.featureList.map((f, i) => (
                    <div className="feature-card" key={i}>
                        <div className="feature-icon">
                            <i className={`ti ${f.icon}`} aria-hidden="true" />
                        </div>
                        <h3>{f.title}</h3>
                        <p>{f.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Features;