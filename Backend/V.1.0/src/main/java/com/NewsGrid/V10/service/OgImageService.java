package com.NewsGrid.V10.service;

import com.NewsGrid.V10.entity.Article;
import org.springframework.stereotype.Service;

import java.awt.*;
import java.awt.geom.RoundRectangle2D;
import java.awt.image.BufferedImage;
import java.time.ZonedDateTime;
import java.time.Duration;

@Service
public class OgImageService {

    // ابعاد کارت — 1200×630 استاندارد OG
    private static final int W = 1200;
    private static final int H = 630;
    private static final int CARD_PAD = 60;

    public BufferedImage generateCard(Article article) {
        BufferedImage img = new BufferedImage(W, H, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();

        // کیفیت بالا
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_LCD_HRGB);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);

        // ── پس‌زمینه ──
        Color bg = new Color(0xF2F2F7);
        g.setColor(bg);
        g.fillRect(0, 0, W, H);

        // ── کارت سفید وسط ──
        int cX = CARD_PAD, cY = CARD_PAD;
        int cW = W - CARD_PAD * 2, cH = H - CARD_PAD * 2;
        RoundRectangle2D card = new RoundRectangle2D.Float(cX, cY, cW, cH, 36, 36);
        g.setColor(Color.WHITE);
        g.fill(card);

        // سایه کارت
        g.setColor(new Color(0, 0, 0, 10));
        for (int i = 1; i <= 6; i++) {
            g.setStroke(new BasicStroke(i));
            g.draw(new RoundRectangle2D.Float(cX - i, cY - i, cW + i * 2, cH + i * 2, 36 + i, 36 + i));
        }

        // ── رنگ و initials منبع ──
        Color srcColor = parseColor(article.getSource() != null ? article.getSource().getColor() : null, new Color(0x007AFF));
        String initials = article.getSource() != null && article.getSource().getInitials() != null
                ? article.getSource().getInitials()
                : (article.getSource() != null ? article.getSource().getName().substring(0, Math.min(2, article.getSource().getName().length())).toUpperCase() : "?");
        String sourceName = article.getSource() != null ? article.getSource().getName() : "";
        int credibility = article.getSource() != null ? article.getSource().getCredibility() : 0;

        // ── بالای کارت: source-label + badge ──
        int topY = cY + 36;

        // badge رنگی منبع (مربع کوچک)
        int badgeSize = 28;
        RoundRectangle2D srcBadge = new RoundRectangle2D.Float(cX + 36, topY, badgeSize, badgeSize, 8, 8);
        g.setColor(srcColor);
        g.fill(srcBadge);

        // initials داخل badge
        g.setColor(Color.WHITE);
        g.setFont(new Font("SansSerif", Font.BOLD, 10));
        FontMetrics fm = g.getFontMetrics();
        int iX = cX + 36 + (badgeSize - fm.stringWidth(initials)) / 2;
        int iY = topY + (badgeSize - fm.getHeight()) / 2 + fm.getAscent();
        g.drawString(initials, iX, iY);

        // نام منبع
        g.setColor(new Color(0x8E8E93));
        g.setFont(new Font("SansSerif", Font.BOLD, 16));
        g.drawString(sourceName, cX + 36 + badgeSize + 10, topY + 20);

        // badge امتیاز اعتبار — بالا راست
        Color scoreColor = getScoreColor(credibility);
        String scoreLabel = getScoreLabel(credibility);
        String scoreText = credibility + "%";

        g.setFont(new Font("SansSerif", Font.BOLD, 14));
        int scoreW = g.getFontMetrics().stringWidth(scoreText) + 20;
        RoundRectangle2D scorePill = new RoundRectangle2D.Float(cX + cW - scoreW - 36, topY - 4, scoreW, 28, 14, 14);
        g.setColor(withAlpha(scoreColor, 30));
        g.fill(scorePill);
        g.setColor(scoreColor);
        g.drawString(scoreText, (int)(cX + cW - scoreW - 36 + 10), topY + 16);

        // ── خط جداکننده ──
        g.setColor(new Color(0xF2F2F7));
        g.setStroke(new BasicStroke(1.5f));
        g.drawLine(cX + 36, topY + 46, cX + cW - 36, topY + 46);

        // ── badge خبر فوری ──
        int titleY = cY + 140;
        if (article.isBreaking()) {
            RoundRectangle2D breakPill = new RoundRectangle2D.Float(cX + 36, titleY - 46, 110, 28, 14, 14);
            g.setColor(new Color(0xE11D48, false).brighter());
            g.setColor(new Color(0xFFE4E8));
            g.fill(breakPill);
            g.setColor(new Color(0xE11D48));
            g.setFont(new Font("SansSerif", Font.BOLD, 13));
            g.drawString("● خبر فوری", cX + 50, titleY - 26);
            titleY += 10;
        }

        // ── تیتر خبر ──
        g.setColor(new Color(0x1C1C1E));
        g.setFont(new Font("SansSerif", Font.BOLD, 38));
        fm = g.getFontMetrics();
        String title = article.getTitle() != null ? article.getTitle() : "";
        java.util.List<String> lines = wrapText(g, title, cW - 72);
        for (int i = 0; i < Math.min(lines.size(), 3); i++) {
            g.drawString(lines.get(i), cX + 36, titleY + i * 52);
        }

        // ── پایین کارت: زمان + آیکون ──
        int bottomY = cY + cH - 36;

        // خط جداکننده
        g.setColor(new Color(0xF2F2F7));
        g.setStroke(new BasicStroke(1.5f));
        g.drawLine(cX + 36, bottomY - 32, cX + cW - 36, bottomY - 32);

        // زمان
        g.setColor(new Color(0xC7C7CC));
        g.setFont(new Font("SansSerif", Font.PLAIN, 16));
        g.drawString(formatTime(article.getPublishedAt()), cX + 36, bottomY);

        // آیکون external link — راست
        g.setColor(new Color(0xC7C7CC));
        g.setFont(new Font("SansSerif", Font.PLAIN, 18));
        g.drawString("↗", cX + cW - 56, bottomY);

        // لوگو NewsGrid — پایین راست
        g.setFont(new Font("SansSerif", Font.BOLD, 15));
        g.setColor(new Color(0x1C1C1E));
        int nW = g.getFontMetrics().stringWidth("News");
        g.drawString("News", cX + cW - 140, bottomY);
        g.setColor(new Color(0x007AFF));
        g.drawString("Grid", cX + cW - 140 + nW + 2, bottomY);

        g.dispose();
        return img;
    }

    private java.util.List<String> wrapText(Graphics2D g, String text, int maxWidth) {
        java.util.List<String> lines = new java.util.ArrayList<>();
        String[] words = text.split(" ");
        StringBuilder line = new StringBuilder();
        FontMetrics fm = g.getFontMetrics();

        for (String word : words) {
            String test = line.length() > 0 ? word + " " + line : word;
            if (fm.stringWidth(test) > maxWidth && line.length() > 0) {
                lines.add(line.toString());
                line = new StringBuilder(word);
            } else {
                line = new StringBuilder(test);
            }
        }
        if (line.length() > 0) lines.add(line.toString());
        return lines;
    }

    private String formatTime(ZonedDateTime dt) {
        if (dt == null) return "";
        long mins = Duration.between(dt, ZonedDateTime.now()).toMinutes();
        if (mins < 60) return mins + " دقیقه پیش";
        long hours = mins / 60;
        if (hours < 24) return hours + " ساعت پیش";
        return (hours / 24) + " روز پیش";
    }

    private Color parseColor(String hex, Color fallback) {
        if (hex == null || hex.isEmpty()) return fallback;
        try { return Color.decode(hex); } catch (Exception e) { return fallback; }
    }

    private Color withAlpha(Color c, int alpha) {
        return new Color(c.getRed(), c.getGreen(), c.getBlue(), alpha);
    }

    private Color getScoreColor(int score) {
        if (score >= 80) return new Color(0x34C759);
        if (score >= 50) return new Color(0xFF9500);
        return new Color(0xFF3B30);
    }

    private String getScoreLabel(int score) {
        if (score >= 80) return "تأیید شده";
        if (score >= 50) return "در حال بررسی";
        return "نامعتبر";
    }
}