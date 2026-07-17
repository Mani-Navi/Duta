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

    @GetMapping("/raw")
    public String raw() {
        try {
            String html = new RestTemplate().exchange(
                    "https://bonbast.com", HttpMethod.GET,
                    new HttpEntity<>(new HttpHeaders()), String.class).getBody();

            // param رو پیدا کن
            String marker = "param: \"";
            int idx = html.indexOf(marker);
            if (idx == -1) return "param not found";
            String param = html.substring(idx + marker.length(), html.indexOf("\"", idx + marker.length()));

            // به /json پست کن
            HttpHeaders h = new HttpHeaders();
            h.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
            h.set("User-Agent", "Mozilla/5.0");
            h.set("Referer", "https://bonbast.com/");
            h.set("X-Requested-With", "XMLHttpRequest");

            ResponseEntity<String> r = new RestTemplate().exchange(
                    "https://bonbast.com/json", HttpMethod.POST,
                    new HttpEntity<>("param=" + param, h), String.class);

            // raw JSON رو برگردون
            return r.getBody();

        } catch (Exception e) {
            return "Error: " + e.getMessage();
        }
    }

    // endpoint دیباگ — بعد از رفع مشکل حذفش کن
    @GetMapping("/debug")
    public String debug() {
        StringBuilder sb = new StringBuilder();
        RestTemplate rt = new RestTemplate();

        try {
            HttpHeaders h1 = new HttpHeaders();
            h1.set("User-Agent", "Mozilla/5.0");
            ResponseEntity<String> mainPage = rt.exchange(
                    "https://bonbast.com",
                    HttpMethod.GET, new HttpEntity<>(h1), String.class);

            String html = mainPage.getBody();

            // کل JS آخر صفحه رو نشون بده
            sb.append("=== Last 2000 chars ===\n");
            sb.append(html, Math.max(0, html.length() - 2000), html.length());
            sb.append("\n\n");

            // دنبال $.post یا fetch یا ajax بگرد
            String[] markers = {"$.post", "$.get", "fetch(", "ajax(", "/json", "token", "data:"};
            for (String marker : markers) {
                int idx = html.indexOf(marker);
                if (idx != -1) {
                    int from = Math.max(0, idx - 30);
                    int to = Math.min(html.length(), idx + 100);
                    sb.append("FOUND '").append(marker).append("' at ").append(idx)
                            .append(":\n...").append(html, from, to).append("...\n\n");
                }
            }

        } catch (Exception e) {
            sb.append("Error: ").append(e.getMessage());
        }
        return sb.toString();
    }
}