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

            // پیدا کردن همه جاهایی که "pp" هست
            int searchFrom = 0;
            int count = 0;
            while (count < 10) {
                int idx = html.indexOf("pp", searchFrom);
                if (idx == -1) break;
                int from = Math.max(0, idx - 20);
                int to = Math.min(html.length(), idx + 60);
                sb.append("[").append(idx).append("]: ...")
                        .append(html, from, to).append("...\n\n");
                searchFrom = idx + 2;
                count++;
            }

        } catch (Exception e) {
            sb.append("Error: ").append(e.getMessage());
        }
        return sb.toString();
    }
}