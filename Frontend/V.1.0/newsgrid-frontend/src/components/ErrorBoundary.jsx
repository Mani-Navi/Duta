import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="retry-container" style={{ padding: '80px 20px' }}>
                    <div className="status-text error">متأسفانه خطایی در نمایش این بخش رخ داده است.</div>
                    <button className="retry-btn" onClick={this.handleReload}>
                        بارگذاری مجدد صفحه
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;