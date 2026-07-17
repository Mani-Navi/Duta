package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.service.PriceService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.*;
import java.util.Map;

@RestController
@RequestMapping("/api/prices")
@RequiredArgsConstructor
public class PriceController {

    private final PriceService priceService;
    private final RestTemplate restTemplate = new RestTemplate();

    @GetMapping
    public Map<String, Object> getPrices() {
        return priceService.getPrices();
    }

    // endpoint دیباگ — بعد از رفع مشکل حذفش کن
    @GetMapping("/debug")
    public String debug() {
        StringBuilder sb = new StringBuilder();
        try {
            // مرحله ۱: آیا اصلاً به bonbast دسترسی داریم؟
            HttpHeaders headers = new HttpHeaders();
            headers.set("User-Agent", "Mozilla/5.0");
            HttpEntity<Void> entity = new HttpEntity<>(headers);

            ResponseEntity<String> response = restTemplate.exchange(
                    "https://bonbast.com",
                    HttpMethod.GET,
                    entity,
                    String.class
            );

            String html = response.getBody();
            sb.append("✅ bonbast.com reached. Status: ").append(response.getStatusCode()).append("\n");
            sb.append("HTML length: ").append(html != null ? html.length() : 0).append("\n");

            // مرحله ۲: آیا token پیدا میشه؟
            if (html != null) {
                String token = null;
                String marker = "\"pp\":\"";
                int idx = html.indexOf(marker);
                if (idx != -1) {
                    int start = idx + marker.length();
                    int end = html.indexOf("\"", start);
                    token = end != -1 ? html.substring(start, end) : null;
                    sb.append("✅ Token found (marker 1): ").append(token).append("\n");
                } else {
                    marker = "pp: '";
                    idx = html.indexOf(marker);
                    if (idx != -1) {
                        int start = idx + marker.length();
                        int end = html.indexOf("'", start);
                        token = end != -1 ? html.substring(start, end) : null;
                        sb.append("✅ Token found (marker 2): ").append(token).append("\n");
                    } else {
                        sb.append("❌ Token NOT found in HTML\n");
                        // نشون بده چی توی HTML هست
                        int ppIdx = html.indexOf("pp");
                        if (ppIdx != -1) {
                            sb.append("'pp' found at index ").append(ppIdx)
                                    .append(": ...").append(html, Math.max(0, ppIdx-10), Math.min(html.length(), ppIdx+50)).append("...\n");
                        }
                    }
                }

                // مرحله ۳: اگه token داریم، JSON بگیر
                if (token != null) {
                    HttpHeaders jsonHeaders = new HttpHeaders();
                    jsonHeaders.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
                    jsonHeaders.set("User-Agent", "Mozilla/5.0");
                    jsonHeaders.set("Referer", "https://bonbast.com/");
                    jsonHeaders.set("X-Requested-With", "XMLHttpRequest");

                    String body = "pp=" + token;
                    HttpEntity<String> jsonEntity = new HttpEntity<>(body, jsonHeaders);

                    ResponseEntity<String> jsonResponse = restTemplate.exchange(
                            "https://bonbast.com/json",
                            HttpMethod.POST,
                            jsonEntity,
                            String.class
                    );

                    sb.append("✅ /json response: ").append(jsonResponse.getBody(), 0,
                            Math.min(500, jsonResponse.getBody() != null ? jsonResponse.getBody().length() : 0)).append("\n");
                }
            }

        } catch (Exception e) {
            sb.append("❌ Error: ").append(e.getClass().getSimpleName())
                    .append(" — ").append(e.getMessage()).append("\n");
        }

        return sb.toString();
    }
}