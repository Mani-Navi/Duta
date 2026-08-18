package com.NewsGrid.V10.logging;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class DutaLogger {
    private final Logger log;
    private final String component;

    private DutaLogger(Class<?> clazz) {
        this.log = LoggerFactory.getLogger(clazz);
        this.component = clazz.getSimpleName();
    }

    public static DutaLogger of(Class<?> clazz) {
        return new DutaLogger(clazz);
    }

    public void info(LogEvent event, String message, Object... kv) {
        if (log.isInfoEnabled()) log.info(format(event, message, kv));
    }

    public void warn(LogEvent event, String message, Object... kv) {
        log.warn(format(event, message, kv));
    }

    public void error(LogEvent event, String message, Throwable ex, Object... kv) {
        log.error(format(event, message, kv), ex);
    }

    public void debug(LogEvent event, String message, Object... kv) {
        if (log.isDebugEnabled()) log.debug(format(event, message, kv));
    }

    private String format(LogEvent event, String message, Object[] kv) {
        StringBuilder sb = new StringBuilder()
                .append("[").append(component).append("] ")
                .append("[").append(event).append("] ")
                .append(message);

        if (kv.length > 0) {
            sb.append(" |");
            for (int i = 0; i < kv.length; i += 2) {
                if (i + 1 < kv.length) {
                    sb.append(" ").append(kv[i]).append("=").append(kv[i + 1]);
                }
            }
        }
        return sb.toString();
    }

    public static class Timer {
        private final long start = System.currentTimeMillis();
        public long stop() { return System.currentTimeMillis() - start; }
    }

    public Timer startTimer() { return new Timer(); }
}