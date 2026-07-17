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
        RestTemplate rt = new RestTemplate();

        // تست ۱: مستقیم GET به /json
        try {
            HttpHeaders h = new HttpHeaders();
            h.set("User-Agent", "Mozilla/5.0");
            h.set("Referer", "https://bonbast.com/");
            ResponseEntity<String> r = rt.exchange(
                    "https://bonbast.com/json",
                    HttpMethod.GET, new HttpEntity<>(h), String.class);
            sb.append("GET /json: ").append(r.getStatusCode())
                    .append("\n").append(r.getBody(), 0, Math.min(300, r.getBody().length())).append("\n\n");
        } catch (Exception e) {
            sb.append("GET /json error: ").append(e.getMessage()).append("\n\n");
        }

        // تست ۲: کوکی‌ها و آخر HTML صفحه اصلی
        try {
            HttpHeaders h = new HttpHeaders();
            h.set("User-Agent", "Mozilla/5.0");
            ResponseEntity<String> r = rt.exchange(
                    "https://bonbast.com",
                    HttpMethod.GET, new HttpEntity<>(h), String.class);
            sb.append("Cookies:\n");
            var cookies = r.getHeaders().get("Set-Cookie");
            if (cookies != null) cookies.forEach(c -> sb.append(c).append("\n"));
            String body = r.getBody();
            sb.append("\nLast 800 chars of HTML:\n");
            sb.append(body, Math.max(0, body.length() - 800), body.length());
        } catch (Exception e) {
            sb.append("Error: ").append(e.getMessage());
        }

        return sb.toString();
    }
}