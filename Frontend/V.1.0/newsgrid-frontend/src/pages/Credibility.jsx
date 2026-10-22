import strings from '../strings/strings';

function Credibility() {
    const t = strings.fa;

    return (
        <div className="page-content">
            <div className="page-header">
                <h1>{t.credTitle}</h1>
                <p>{t.credDesc}</p>
            </div>

            <div className="cred-grid">
                {t.credLevels.map((c, i) => (
                    <div className={`cred-card ${c.cls}`} key={i}>
                        <div className="dot" />
                        <h3>{c.title}</h3>
                        <p>{c.desc}</p>
                    </div>
                ))}
            </div>

            <div className="algo-header">
                <h2>{t.algoTitle}</h2>
                <p>{t.algoDesc}</p>
            </div>

            <div className="steps">
                {t.steps.map((s, i) => (
                    <div className="step" key={i}>
                        <div className="step-num">{i + 1}</div>
                        <h3>{s.title}</h3>
                        <p>{s.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Credibility;