package com.NewsGrid.V10.controller;

import com.NewsGrid.V10.entity.Article;
import com.NewsGrid.V10.service.ArticleService;
import com.NewsGrid.V10.service.OgImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;

@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class OgImageController {

    private final ArticleService articleService;
    private final OgImageService ogImageService;

    @GetMapping(value = "/{id}/og-image", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> getOgImage(@PathVariable Long id) throws Exception {
        Article article = articleService.getArticleById(id);
        BufferedImage img = ogImageService.generateCard(article);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "PNG", out);

        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .header("Cache-Control", "public, max-age=3600")
                .body(out.toByteArray());
    }
}