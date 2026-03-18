# ZJU 12元素占位图 Prompt（Midjourney / Stable Diffusion）

## 通用风格模板

### 正向 Prompt 模板
```text
[主体元素], 2D cartoon flat illustration, clean vector-like shape, bright campus palette, high readability, centered composition, transparent background, soft shadow, game icon style, cute but not childish, no text, no watermark
```

### 负向 Prompt 模板
```text
photorealistic, 3d render, complex background, text, watermark, logo, blurry, noisy, low contrast, extra limbs, messy composition
```

### Midjourney 追加参数
```text
--ar 1:1 --v 6 --stylize 120
```

### Stable Diffusion 建议
- Size: `1024x1024`
- CFG: `6.5 ~ 8`
- Steps: `28 ~ 40`
- 背景：透明优先；若模型不支持透明，先纯色背景后抠图

## 12个浙大元素（与合成树一一对应）

1. 抢课验证码  
```text
course selection captcha code card, tiny digital ticket, anxious playful expression, 2D cartoon flat illustration, clean vector-like shape, bright campus palette, centered composition, transparent background, game icon style
```

2. 选课转圈圈  
```text
loading spinner for course selection website, circular buffering icon with motion streak, humorous campus meme style, 2D cartoon flat illustration, high readability, transparent background, game icon style
```

3. 早八闹钟  
```text
early-morning alarm clock, sleepy but ringing, energetic cyan-yellow contrast, 2D cartoon flat illustration, rounded shape, transparent background, game icon style
```

4. 麦香饼  
```text
crispy campus breakfast pancake, warm golden color, simple food icon, 2D cartoon flat illustration, clean outline, transparent background, game icon style
```

5. 大不列颠土豆  
```text
funny british-style campus potato snack, tiny crown motif, meme vibe, 2D cartoon flat illustration, bright colors, transparent background, game icon style
```

6. 小白车  
```text
small white campus shuttle bus, compact rounded bus silhouette, friendly expression, 2D cartoon flat illustration, high readability, transparent background, game icon style
```

7. 紫金港大白鹅  
```text
big white goose mascot from campus lake, proud posture, slightly mischievous vibe, 2D cartoon flat illustration, clean shape, transparent background, game icon style
```

8. 启真湖晚风  
```text
evening lake breeze symbol, swirl of wind and water ripple, calming blue gradient, 2D cartoon flat illustration, simple emblem style, transparent background, game icon style
```

9. 图书馆满座提示  
```text
library full-seat notification badge, tiny seat icon with warning dot, humorous stress meme style, 2D cartoon flat illustration, centered composition, transparent background, game icon style
```

10. 门禁倒计时  
```text
dorm gate countdown timer, digital countdown display with urgency glow, 2D cartoon flat illustration, clean outline, transparent background, game icon style
```

11. 满绩传说（4.0/4.8）  
```text
legendary perfect GPA medal 4.0/4.8, academic glory badge, sparkling but minimal, 2D cartoon flat illustration, campus honor style, transparent background, game icon style
```

12. 竺院神仙  
```text
ultimate zju genius mascot, elegant scholar-like halo, confident and calm, 2D cartoon flat illustration, premium bright palette, transparent background, game icon style
```
