package com.NewsGrid.V10.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.net.InetSocketAddress;
import java.net.Proxy;

@Configuration
public class ProxyConfig {

    @Value("${proxy.enabled:false}")
    private boolean enabled;

    @Value("${proxy.host:127.0.0.1}")
    private String host;

    @Value("${proxy.port:1080}")
    private int port;

    @Value("${proxy.type:HTTP}")
    private String type;

    public Proxy getProxy() {
        if (!enabled) {
            return Proxy.NO_PROXY;
        }

        Proxy.Type proxyType = "SOCKS".equalsIgnoreCase(type)
                ? Proxy.Type.SOCKS
                : Proxy.Type.HTTP;

        return new Proxy(proxyType, new InetSocketAddress(host, port));
    }

    public boolean isEnabled() {
        return enabled;
    }
}