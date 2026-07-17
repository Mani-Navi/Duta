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

        try {
            // مرحله ۱: کوکی st_bb رو از صفحه اصلی بگیر
            HttpHeaders h1 = new HttpHeaders();
            h1.set("User-Agent", "Mozilla/5.0");
            ResponseEntity<String> mainPage = rt.exchange(
                    "https://bonbast.com",
                    HttpMethod.GET, new HttpEntity<>(h1), String.class);

            String cookie = null;
            var cookies = mainPage.getHeaders().get("Set-Cookie");
            if (cookies != null) {
                for (String c : cookies) {
                    if (c.startsWith("st_bb=")) {
                        cookie = c.split(";")[0]; // st_bb=VALUE
                        break;
                    }
                }
            }
            sb.append("Cookie: ").append(cookie).append("\n\n");

            // مرحله ۲: با کوکی به /json پست کن
            if (cookie != null) {
                HttpHeaders h2 = new HttpHeaders();
                h2.setContentType(MediaType.APPLICATION_FORM_URLENCODED);
                h2.set("User-Agent", "Mozilla/5.0");
                h2.set("Referer", "https://bonbast.com/");
                h2.set("Cookie", cookie);
                h2.set("X-Requested-With", "XMLHttpRequest");

                String token = cookie.replace("st_bb=", "");
                String body = "pp=" + token;

                HttpEntity<String> entity = new HttpEntity<>(body, h2);
                ResponseEntity<String> r = rt.exchange(
                        "https://bonbast.com/json",
                        HttpMethod.POST, entity, String.class);

                sb.append("POST /json status: ").append(r.getStatusCode()).append("\n");
                sb.append("Response: ").append(r.getBody(), 0,
                        Math.min(500, r.getBody() != null ? r.getBody().length() : 0));
            }

        } catch (Exception e) {
            sb.append("Error: ").append(e.getClass().getSimpleName())
                    .append(" — ").append(e.getMessage());
        }
        return sb.toString();
    }
}