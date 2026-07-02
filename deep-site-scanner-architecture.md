# Deep Site Scanner — Kiến Trúc Hệ Thống Đầy Đủ

> Browser Extension chuyên nghiệp để quét sâu toàn bộ website: link, tài nguyên, API, SPA routes, v.v.
> Tài liệu này là bản thiết kế hoàn chỉnh trước khi viết bất kỳ dòng code nào.

---

## 0. Nguyên tắc thiết kế nền tảng

Trước khi đi vào chi tiết, đây là 5 nguyên tắc chi phối mọi quyết định trong tài liệu này:

1. **Separation of Concerns** — Content script không được biết gì về cách dữ liệu được lưu trữ. Storage layer không được biết gì về cách URL được parse. Mỗi module chỉ biết "hợp đồng" (interface) của module nó gọi.
2. **Manifest V3 là môi trường không tin cậy về vòng đời** — Service worker có thể bị kill bất cứ lúc nào (thường sau 30s không hoạt động). Toàn bộ kiến trúc phải giả định trạng thái trong bộ nhớ (in-memory) có thể biến mất, nên **state phải được persist liên tục**, không phải khi "xong việc".
3. **Content script chạy trong "thế giới" của trang** — nó bị giới hạn bởi CSP của trang, có thể bị trang tấn công ngược (nếu trang độc hại), nên không bao giờ tin dữ liệu thô lấy từ DOM/network mà không sanitize.
4. **Crawl là bài toán đồ thị, không phải bài toán danh sách** — Website là một graph có chu trình (cycle), không phải cây. Toàn bộ engine phải xử lý như graph traversal có visited-set.
5. **Không có gì miễn phí về hiệu năng** — Mỗi content script inject vào 1 tab tốn RAM riêng. Mỗi URL lưu vào IndexedDB tốn I/O. Thiết kế phải cân nhắc chi phí ở scale hàng chục nghìn → hàng triệu URL.

---

## 1. Kiến Trúc Tổng Thể (High-Level Architecture)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER ENVIRONMENT                         │
│                                                                       │
│  ┌────────────┐   ┌──────────────┐   ┌────────────┐  ┌───────────┐  │
│  │   Popup    │   │ Options Page │   │ Side Panel │  │  DevTools │  │
│  │ (UI Entry) │   │  (Settings)  │   │ (Live View)│  │  (opt.)   │  │
│  └─────┬──────┘   └──────┬───────┘   └─────┬──────┘  └─────┬─────┘  │
│        │                 │                 │                │       │
│        └─────────────────┴────────┬────────┴────────────────┘       │
│                                    │  chrome.runtime messaging       │
│                                    ▼                                 │
│                    ┌───────────────────────────────┐                │
│                    │   BACKGROUND SERVICE WORKER    │                │
│                    │  (Orchestrator / Event Bus)    │                │
│                    │  - Crawl Scheduler             │                │
│                    │  - State Machine                │                │
│                    │  - Message Router               │                │
│                    └───┬───────────────┬─────────────┘                │
│                        │               │                              │
│         chrome.scripting│               │chrome.webNavigation         │
│         .executeScript  │               │chrome.tabs / chrome.downloads│
│                        ▼               ▼                              │
│            ┌────────────────────┐  ┌─────────────────────┐           │
│            │   CONTENT SCRIPT   │  │  OFFSCREEN DOCUMENT  │           │
│            │  (injected per tab)│  │ (DOM parsing, heavy  │           │
│            │  - DOM Scanner     │  │  regex, XML/RSS      │           │
│            │  - MutationObserver│  │  parsing without a   │           │
│            │  - Shadow DOM walk │  │  visible tab)        │           │
│            │  - Network sniff   │  └─────────┬────────────┘           │
│            └─────────┬──────────┘            │                        │
│                      │ postMessage/           │                        │
│                      │ runtime.sendMessage    │                        │
│                      ▼                        ▼                        │
│            ┌─────────────────────────────────────────┐                │
│            │      STORAGE LAYER (IndexedDB / etc.)    │                │
│            └─────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────────┘
```

**Vì sao chia như vậy?**
- **Popup/Options/Side Panel** chỉ là "màn hình", không chứa logic nghiệp vụ → dễ thay UI mà không đụng logic crawl.
- **Background Service Worker** là "nhạc trưởng" duy nhất biết crawl đang ở trạng thái nào — tránh race condition khi nhiều tab cùng report kết quả.
- **Content Script** là "cảm biến" gắn vào từng tab — nó thu thập dữ liệu thô, KHÔNG quyết định crawl tiếp URL nào (quyết định đó thuộc về scheduler ở background).
- **Offscreen Document** giải quyết vấn đề: Manifest V3 service worker không có `DOMParser`/`document` đầy đủ — cần một trang ẩn để parse HTML/XML nặng mà không mở tab thật.

---

## 2. Clean Architecture — 4 Tầng

```
┌───────────────────────────────────────────────────────────┐
│  PRESENTATION       popup/, options/, sidepanel/           │
│  (React/Vue UI, chỉ render state + gửi command)            │
├───────────────────────────────────────────────────────────┤
│  APPLICATION        use-cases/                             │
│  StartCrawlUseCase, DiscoverResourcesUseCase,               │
│  ExportResultsUseCase, StopCrawlUseCase...                  │
│  (Điều phối domain objects, KHÔNG chứa chi tiết kỹ thuật)   │
├───────────────────────────────────────────────────────────┤
│  DOMAIN             domain/                                │
│  Entities: CrawlJob, ResourceNode, UrlFrontier              │
│  Value Objects: NormalizedUrl, ResourceType, CrawlDepth      │
│  Domain Services: DeduplicationPolicy, DomainScopePolicy    │
│  (Thuần logic nghiệp vụ, KHÔNG import chrome.* API nào cả) │
├───────────────────────────────────────────────────────────┤
│  INFRASTRUCTURE     infrastructure/                         │
│  ChromeStorageRepository, IndexedDbRepository,               │
│  ContentScriptBridge, NetworkSniffer, ExportAdapter          │
│  (Nơi DUY NHẤT được gọi chrome.* API / DOM API / fetch)     │
└───────────────────────────────────────────────────────────┘
```

**Lý do tồn tại của từng tầng:**

| Tầng | Giải quyết vấn đề gì | Nếu KHÔNG có tầng này thì sao? |
|---|---|---|
| Presentation | Hiển thị và nhận input người dùng | UI logic trộn với crawl logic → không thể unit test crawl logic vì phải mock cả DOM |
| Application | Điều phối một "kịch bản nghiệp vụ" hoàn chỉnh (vd: bắt đầu crawl gồm nhiều bước nhỏ) | Mỗi màn hình phải tự biết chuỗi bước → trùng lặp code, dễ sai thứ tự |
| Domain | Chứa "luật chơi" độc lập với công nghệ (thế nào là URL hợp lệ, khi nào dừng đệ quy) | Luật nghiệp vụ bị chôn trong code gọi API trình duyệt → khó test, khó đổi trình duyệt (Chrome→Firefox) |
| Infrastructure | Cách ly các API dễ đổi (chrome.storage có thể đổi sang IndexedDB) | Đổi 1 API kéo theo sửa code khắp nơi |

**Quy tắc phụ thuộc (Dependency Rule):** mũi tên phụ thuộc luôn hướng vào trong. Domain không biết Infrastructure tồn tại. Đây là lý do ta dùng **Dependency Injection** — Infrastructure "cắm" implementation vào Domain thông qua interface (Repository pattern), chứ Domain không `import` trực tiếp `chrome.storage`.

---

## 3. Design Patterns — Áp dụng cụ thể

| Pattern | Áp dụng ở đâu | Vì sao cần |
|---|---|---|
| **Strategy** | `ResourceExtractorStrategy` — mỗi loại tài nguyên (HTML, CSS, JS, XML, GraphQL...) có 1 strategy trích xuất URL riêng | Thêm loại tài nguyên mới (vd: WebManifest) không sửa code cũ — Open/Closed Principle |
| **Factory** | `ExtractorFactory.create(resourceType)` trả về đúng Strategy | Tách logic "chọn extractor nào" khỏi nơi dùng nó |
| **Builder** | `CrawlJobBuilder` dựng `CrawlJob` từ config phức tạp (depth, domain scope, rate limit, filters) | Constructor với 15 tham số là anti-pattern; Builder cho phép set từng phần rõ ràng |
| **Observer** | `CrawlEventBus` — Background phát event (`urlDiscovered`, `crawlProgress`, `errorOccurred`), UI đăng ký lắng nghe | Popup/SidePanel cần cập nhật real-time mà không polling liên tục |
| **Command** | Mỗi hành động người dùng (Start, Pause, Resume, Stop, Retry) là 1 Command object đưa vào queue của background | Cho phép undo, logging, và xử lý tuần tự an toàn dù nhiều UI gửi lệnh cùng lúc |
| **State** | `CrawlJob` có state machine: `Idle → Running → Paused → Completed/Failed/Cancelled` | Tránh if/else rối loạn khi kiểm tra "crawl đang làm gì" |
| **Visitor** | `DomVisitor` duyệt cây DOM/Shadow DOM, áp `visit(node)` cho từng loại node (a, img, script, iframe...) | Tách "cách duyệt cây" khỏi "làm gì với từng node" — dễ thêm loại xử lý mới |
| **Adapter** | `ChromeStorageAdapter`, `IndexedDbAdapter` cùng implement `IResourceRepository` | Domain gọi 1 interface duy nhất, không quan tâm storage thật là gì |
| **Facade** | `CrawlerFacade.startScan(url, options)` — 1 hàm duy nhất che giấu việc gọi hàng chục module bên trong | UI không cần biết đến 10 bước nội bộ để bắt đầu crawl |
| **Mediator** | Background Service Worker đóng vai trò Mediator giữa các Content Script (các tab không nói chuyện trực tiếp với nhau) | Tránh N×N kết nối giữa các tab; mọi giao tiếp qua 1 điểm trung tâm |
| **Composite** | `ResourceNode` có thể chứa `children: ResourceNode[]` (trang → tài nguyên con) | Biểu diễn cây/graph tài nguyên đồng nhất, dùng đệ quy để export hoặc render Tree View |
| **Dependency Injection** | Mọi Use Case nhận Repository qua constructor, không tự `new` | Cho phép test Use Case với Fake Repository, không cần trình duyệt thật |
| **Repository** | `IUrlFrontierRepository`, `IResourceRepository` | Che giấu chi tiết truy vấn/lưu trữ khỏi Application layer |
| **Chain of Responsibility** | `UrlFilterChain`: RobotsTxtFilter → DomainScopeFilter → DuplicateFilter → BlacklistFilter | Mỗi filter chỉ quyết định "pass" hay "reject", dễ thêm/bớt/đổi thứ tự luật lọc |

---

## 4. Manifest V3 & Kiến Trúc Extension

### 4.1 manifest.json — các thành phần chính

```jsonc
{
  "manifest_version": 3,
  "name": "Deep Site Scanner",
  "permissions": [
    "storage",        // chrome.storage.local/session
    "scripting",      // inject content script động
    "tabs",           // đọc URL tab, tạo tab crawl
    "webNavigation",  // biết khi SPA chuyển route (pushState)
    "downloads",      // export file, tải tài nguyên tìm được
    "offscreen",      // parse XML/HTML nặng ngoài service worker
    "alarms",         // giữ service worker "tỉnh" định kỳ, lên lịch retry
    "contextMenus",   // "Scan this page" trong menu chuột phải
    "sidePanel",      // giao diện xem tiến trình trực tiếp
    "notifications"   // báo khi crawl hoàn tất
  ],
  "host_permissions": ["<all_urls>"],   // cần quét domain bất kỳ người dùng chọn
  "background": { "service_worker": "background.js", "type": "module" },
  "action": { "default_popup": "popup.html" },
  "options_page": "options.html",
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content-script.js"],
    "run_at": "document_idle",
    "all_frames": true          // để bắt được iframe con
  }]
}
```

**Về `host_permissions: <all_urls>`:** đây là quyền "nhạy cảm" nhất — Chrome Web Store sẽ review kỹ. Thiết kế tốt hơn cho production thật: dùng `optional_host_permissions` và xin quyền động (`chrome.permissions.request`) chỉ cho domain người dùng thực sự muốn quét — tuân thủ nguyên tắc *principle of least privilege*.

### 4.2 Vòng đời Service Worker — vấn đề cốt lõi của MV3

Service worker **không sống liên tục**. Nó bị Chrome tắt sau ~30 giây không có hoạt động (event, message, network call). Điều này phá vỡ giả định "biến trong RAM luôn còn đó" mà lập trình viên MV2 quen dùng.

**Hệ quả thiết kế bắt buộc:**
- `CrawlJob` state, `UrlFrontier` (hàng đợi URL), `visitedSet` phải **persist vào `chrome.storage.session`** (nhanh, mất khi trình duyệt tắt — phù hợp vì crawl không cần sống qua session) sau **mỗi lần thay đổi**, không phải cuối job.
- Dùng `chrome.alarms` (tối thiểu 30s/lần theo giới hạn Chrome) để "đánh thức" service worker định kỳ và tiếp tục xử lý queue nếu nó bị kill giữa chừng.
- Khi service worker khởi động lại, bước đầu tiên luôn là: **rehydrate state từ storage** trước khi làm bất cứ điều gì khác.

```
┌──────────┐   idle 30s    ┌──────────┐   alarm/message   ┌──────────┐
│  ACTIVE  │ ────────────▶ │  KILLED  │ ─────────────────▶ │ REVIVED  │
│(có state │               │(RAM mất) │                    │(đọc lại  │
│ trong RAM)│              │          │                    │ state từ │
└──────────┘               └──────────┘                    │ storage) │
                                                             └──────────┘
```

### 4.3 Content Script vs Offscreen Document — khi nào dùng cái nào?

| Tiêu chí | Content Script | Offscreen Document |
|---|---|---|
| Có thể đọc DOM **thật** của trang (đã render, đã chạy JS) | ✅ Có | ❌ Không |
| Bị giới hạn bởi CSP của trang đích | ✅ Có (bất lợi) | ❌ Không |
| Dùng để parse chuỗi HTML/XML tải về qua `fetch()` (vd sitemap.xml) | Có thể nhưng lãng phí (đã có 1 tab thật) | ✅ Đúng mục đích — nhẹ, không cần tab hiển thị |
| Truy cập Shadow DOM, MutationObserver của trang sống | ✅ Bắt buộc | ❌ Không |
| Số lượng đồng thời | 1 mỗi tab đang mở | Chrome chỉ cho **1 offscreen document** toàn extension |

### 4.4 Giao tiếp giữa các thành phần

```
Popup ──(runtime.sendMessage)──▶ Background ──(scripting.executeScript)──▶ Content Script
  ▲                                   │                                          │
  │                                   │◀────────(runtime.sendMessage)────────────┘
  │                                   │            (báo cáo tài nguyên tìm được)
  └────(runtime.onMessage / Port)────┘
         (cập nhật tiến trình real-time)
```

- **`chrome.runtime.sendMessage`**: dùng cho giao tiếp "hỏi-đáp 1 lần" (vd: "lấy config hiện tại").
- **Long-lived Port (`chrome.runtime.connect`)**: dùng khi cần stream liên tục — vd Side Panel muốn nhận **từng URL** ngay khi tìm thấy, không đợi tổng hợp xong. Port tránh việc gửi hàng nghìn message rời rạc (mỗi message có overhead serialize riêng) — thay vào đó ta gom lô (batch) 50-100 URL/lần qua cùng 1 port.
- **`postMessage` (window)**: chỉ dùng nội bộ trong content script khi cần giao tiếp giữa "main world" và "isolated world" (vd script inject vào trang để đọc biến JS nội bộ như `window.__NUXT__` hoặc `window.__NEXT_DATA__` của SPA).

---

## 5. Crawling Engine — Thiết Kế Như Search Engine Thật

### 5.1 BFS vs DFS — chọn cái nào?

| | BFS | DFS |
|---|---|---|
| Thứ tự khám phá | Theo từng "tầng" độ sâu | Đi sâu 1 nhánh trước |
| Bộ nhớ hàng đợi | Cao hơn (giữ cả 1 tầng) | Thấp hơn |
| Phù hợp crawl web? | ✅ **Có** — phản ánh đúng mức độ "quan trọng" (trang gần root thường quan trọng hơn) | Dễ bị "lạc" sâu vào 1 nhánh vô tận (vd trang lịch có link "tháng sau" bất tận) |

**Quyết định: dùng BFS làm mặc định**, với `UrlFrontier` là hàng đợi ưu tiên (priority queue) chứ không phải FIFO thuần — vì không phải mọi URL cùng độ sâu đều quan trọng như nhau (xem 5.2).

### 5.2 Crawl Priority — Priority Queue

Điểm ưu tiên = hàm của nhiều yếu tố:
```
priority = w1*(1/depth) + w2*(sameDomain ? 1 : 0) + w3*(isSitemapListed ? 1 : 0)
           + w4*(resourceType == HTML ? 1 : 0.3)   // ưu tiên trang HTML hơn ảnh/font
```
Cài đặt bằng **binary heap** (min-heap theo `-priority`) để lấy phần tử ưu tiên cao nhất trong O(log n) — quan trọng khi frontier có hàng trăm nghìn URL.

### 5.3 URL Normalization — bắt buộc trước khi dedup

Nếu không normalize, `https://site.com/a` và `https://site.com/a/` và `HTTPS://Site.com/a?utm_source=x#frag` sẽ bị coi là 3 URL khác nhau → crawl trùng lặp vô tận.

Quy tắc normalize:
1. Lowercase scheme + host.
2. Loại bỏ `#fragment` (trừ khi SPA dùng hash routing — xử lý riêng, xem 5.9).
3. Loại bỏ trailing slash (trừ path gốc `/`).
4. Sắp xếp query params theo alphabet; loại bỏ tracking params (`utm_*`, `fbclid`, `gclid`...).
5. Decode/encode percent-encoding nhất quán (`%2F` vs `/`).
6. Loại bỏ `:80`/`:443` mặc định.

### 5.4 Deduplication

- Dùng **hash set** (`Set<string>` trong RAM cho tốc độ + persist định kỳ vào IndexedDB cho durability).
- Ở quy mô triệu URL: RAM Set tốn ~100 bytes/URL → 1 triệu URL ≈ 100MB, vẫn ổn cho extension. Nếu vượt ngưỡng, chuyển sang **Bloom Filter** (xác suất, tiết kiệm bộ nhớ, chấp nhận tỷ lệ trùng giả rất nhỏ).
- Key dùng để dedup = URL đã normalize, **không phải** URL gốc.

### 5.5 Domain Restriction (Scope Policy)

`DomainScopePolicy` là 1 Strategy có thể cấu hình:
- `SAME_ORIGIN` — chỉ scheme+host+port giống hệt.
- `SAME_DOMAIN` — cho phép subdomain khác nhau (`blog.site.com` khi bắt đầu từ `site.com`).
- `SAME_DOMAIN_PLUS_LIST` — domain gốc + whitelist thủ công (vd CDN ảnh riêng).
- `UNRESTRICTED` — crawl cả external, nhưng **không đệ quy tiếp vào external** (chỉ ghi nhận sự tồn tại — 1-hop external check, tránh crawl cả internet).

### 5.6 Depth Limitation & Chống Vòng Lặp Vô Tận

- `maxDepth` cấu hình được (mặc định 5).
- **Visited set** ngăn quay lại URL đã thăm (chống cycle A→B→A).
- **Path-based loop detection**: một số site sinh URL kiểu `/page/page/page/page/...` (calendar, faceted search) — phát hiện bằng cách giới hạn số lần 1 **path segment lặp lại** trong cùng URL (vd không quá 2 lần `/category/`).
- **Content fingerprint dedup**: hash nội dung trang (SimHash/MD5 của DOM đã normalize) — nếu 2 URL khác nhau trả về nội dung giống hệt (session ID trong URL), coi là 1 trang, không branch tiếp.

### 5.7 Retry Policy

- **Exponential backoff**: lần 1 retry sau 1s, lần 2 sau 2s, lần 3 sau 4s, tối đa 3 lần rồi đánh dấu `FAILED`.
- Retry chỉ áp dụng cho lỗi **tạm thời** (timeout, HTTP 429/503) — không retry HTTP 404/403 (lỗi vĩnh viễn, tốn tài nguyên vô ích).
- Circuit breaker: nếu 1 domain lỗi liên tục >10 lần trong 1 phút → tạm ngưng crawl domain đó 5 phút (tránh dội bom 1 server đang down).

### 5.8 Robots.txt & Rate Limiting

- Tải `robots.txt` **1 lần đầu** mỗi domain, parse bằng thư viện nhỏ tự viết (User-agent match, Disallow/Allow, Crawl-delay).
- Tôn trọng `Crawl-delay` nếu có; mặc định tối thiểu 200-500ms giữa 2 request cùng domain (token bucket rate limiter per-domain, không phải global — để crawl nhiều domain song song vẫn nhanh).
- **Lưu ý pháp lý/đạo đức**: đây là extension chạy trong trình duyệt người dùng, dùng chính phiên đăng nhập của họ — khác về bản chất với 1 bot crawl từ server. Vẫn nên tôn trọng robots.txt như một chuẩn mực tốt, và tuyệt đối không dùng để bypass paywall/auth.

### 5.9 Xử lý SPA (React/Vue/Angular)

Đây là phần khó nhất vì URL không đổi trang (server không trả HTML mới):

1. **History API hook**: patch `history.pushState`/`replaceState` (qua script inject vào MAIN world) + lắng nghe event `popstate` → mỗi lần route đổi, coi như "trang mới" cần scan lại DOM.
2. **Hash routing**: lắng nghe `hashchange` cho app dùng `#/route`.
3. **MutationObserver** trên `document.body` với `{ childList: true, subtree: true }` — bắt DOM thay đổi do render lại (không phải lúc nào route đổi cũng đổi URL, vd tab nội bộ).
4. **Debounce**: DOM có thể đổi hàng chục lần/giây khi React re-render — gom các thay đổi trong cửa sổ 300-500ms rồi mới quét 1 lần, tránh quét lặp lãng phí CPU.
5. **Framework route hint**: đọc `window.__NEXT_DATA__`, `window.__NUXT__`, Angular route config nếu tồn tại — cho biết trước danh sách route tĩnh mà không cần click từng cái.

### 5.10 Infinite Scroll & Lazy Loading

- `IntersectionObserver` để phát hiện phần tử "lazy" (`loading="lazy"`, `data-src`) khi nào thực sự vào viewport.
- Với infinite scroll: chủ động `window.scrollTo(bottom)` theo chu kỳ + đợi MutationObserver báo có node mới + có **giới hạn số lần scroll tối đa** (vd 50 lần) để tránh treo vô hạn ở trang scroll bất tận thật sự (social feed).

### 5.11 Concurrency Model

```
                         ┌─────────────────────┐
                         │   Crawl Scheduler    │
                         │ (background, single) │
                         └──────────┬────────────┘
                    phân phối job    │   giới hạn N tab song song
              ┌─────────────┬───────┴───────┬─────────────┐
              ▼             ▼               ▼             ▼
          Tab Worker 1  Tab Worker 2   Tab Worker 3   Tab Worker N
        (content script)(content script)(content script)(content script)
```

- Giới hạn **N tab đồng thời** (mặc định 3-5) — mở quá nhiều tab ẩn (`chrome.tabs.create({active:false})`) gây tốn RAM và có thể bị site phát hiện là bot.
- Mỗi domain có **rate limiter riêng** (token bucket), nhưng scheduler tổng vẫn giới hạn tổng số tab để không "ngợp" máy người dùng.
- Dùng **Web Worker** (trong offscreen document) cho tác vụ CPU-nặng thuần túy (regex lớn, parse XML khổng lồ, tính content hash) để không block main thread của service worker.

---

## 6. Resource Discovery — Kỹ Thuật Cho Từng Nguồn

| Nguồn | Kỹ thuật |
|---|---|
| **HTML** | Duyệt `document.querySelectorAll('a[href], img[src], script[src], link[href], video[src], source[src], iframe[src]')` sau khi DOM `document_idle`. |
| **CSS** | Fetch nội dung file CSS, regex tìm `url(...)` (background-image, @font-face, @import) — kể cả CSS lồng trong `<style>` inline. |
| **JavaScript** | Regex tìm chuỗi giống URL (`https?://...`, `/api/...`) trong bundle JS đã tải — chấp nhận có false positive, lọc lại bằng validate URL. Không eval code JS (rủi ro bảo mật). |
| **DOM động** | `MutationObserver` theo dõi `childList`+`attributes` để bắt node thêm sau khi trang tải xong (AJAX render). |
| **Network requests** | Content script không thấy được network trực tiếp — dùng `PerformanceObserver` với `entryTypes: ['resource']` để lấy **mọi** resource đã tải (ảnh, script, fetch, XHR) kèm timing, không cần `webRequest`. |
| **Performance API** | `performance.getEntriesByType('resource')` bổ sung cho PerformanceObserver (lấy lịch sử trước khi observer gắn). |
| **History/Navigation API** | Đã mô tả ở 5.9 — bắt SPA route change. |
| **iframe** | `all_frames: true` trong content script tự động inject vào iframe cùng-origin; iframe cross-origin chỉ lấy được `src` (không đọc được nội dung do same-origin policy — đây là giới hạn trình duyệt, không phải thiếu sót thiết kế). |
| **Shadow DOM** | Đệ quy: với mỗi element, kiểm tra `el.shadowRoot`, nếu có thì `querySelectorAll` tiếp bên trong (Visitor pattern áp dụng ở đây). Shadow DOM `mode: closed` **không thể** truy cập — giới hạn kỹ thuật của web platform. |
| **Meta tags / JSON-LD** | `document.querySelectorAll('meta[property], script[type="application/ld+json"]')` — parse JSON-LD tìm các trường `url`, `image`, `sameAs`. |
| **Sitemap.xml** | Fetch `/sitemap.xml`, nếu là sitemap index thì đệ quy tải các sitemap con; parse bằng offscreen document (`DOMParser` với `text/xml`). |
| **Robots.txt** | Fetch `/robots.txt`, parse dòng `Sitemap:` để tìm thêm sitemap không theo quy ước mặc định. |
| **GraphQL** | Phát hiện endpoint qua pattern URL phổ biến (`/graphql`, `/api/graphql`) tìm thấy trong JS bundle hoặc PerformanceObserver; không tự động gửi query (tránh side-effect ngoài ý muốn), chỉ **ghi nhận endpoint tồn tại**. |
| **WebSocket** | Không thể "phát hiện thụ động" hoàn toàn — patch constructor `WebSocket` trong MAIN world (giống cách hook `pushState`) để log URL mỗi khi trang tự tạo kết nối WS. |
| **Fetch/XHR** | Tương tự WebSocket — patch `window.fetch` và `XMLHttpRequest.prototype.open` trong MAIN world context để log mọi request trang tự thực hiện, sau đó gửi về content script qua `postMessage`. |
| **Pagination** | Heuristic: tìm `<a rel="next">`, text chứa "Next"/"Trang sau"/số trang tăng dần trong URL query (`?page=`), hoặc nút load-more (aria-label). |

**Lưu ý bảo mật quan trọng về patch `fetch`/`WebSocket`:** việc này chèn code vào MAIN world của trang — phải inject qua `chrome.scripting.executeScript({world: 'MAIN'})` (API chính thức MV3), **không** dùng cách chèn `<script>` tag thủ công (dễ bị CSP của trang chặn và là pattern kém an toàn hơn).

---

## 7. Browser APIs — Vai Trò Từng API

| API | Vai trò trong hệ thống |
|---|---|
| `chrome.scripting` | Inject content script động vào tab cụ thể (thay vì khai báo tĩnh toàn bộ), và inject vào MAIN world để hook fetch/WebSocket/history. |
| `chrome.tabs` | Tạo tab ẩn để crawl, đọc URL hiện tại, đóng tab sau khi quét xong. |
| `chrome.webNavigation` | Biết chính xác khi nào 1 tab hoàn tất điều hướng (kể cả SPA qua `onHistoryStateUpdated`) — đáng tin cậy hơn tự đoán qua content script. |
| `chrome.storage.local` | Lưu **kết quả crawl** dài hạn (tồn tại qua restart trình duyệt), giới hạn ~10MB (hoặc unlimited với permission `unlimitedStorage`). |
| `chrome.storage.session` | Lưu **state crawl đang chạy** (frontier, visited set) — mất khi đóng trình duyệt, đúng ý vì crawl dở dang không nên tự resume sau khi user tắt máy. |
| `chrome.runtime` | Message passing nền tảng giữa mọi thành phần; `onInstalled` để khởi tạo storage lần đầu. |
| `chrome.alarms` | Đánh thức service worker định kỳ để tiếp tục xử lý queue, và lên lịch retry sau backoff. |
| `chrome.downloads` | Export kết quả ra file (JSON/CSV/HTML) và tải các tài nguyên tìm thấy nếu người dùng chọn. |
| `chrome.sidePanel` | Giao diện xem tiến trình crawl real-time song song với việc duyệt web (không như popup, side panel không tự đóng). |
| `chrome.notifications` | Báo khi crawl hoàn tất/lỗi nghiêm trọng, đặc biệt hữu ích cho crawl chạy nền lâu (hàng chục phút). |
| `chrome.contextMenus` | "Scan this page" / "Scan this site" ngay từ menu chuột phải — UX nhanh hơn mở popup. |
| `chrome.webRequest` | **Cân nhắc kỹ** — MV3 giới hạn mạnh `webRequest` (ưu tiên `declarativeNetRequest`), và quan sát thụ động qua `PerformanceObserver` đã đủ cho mục đích discovery mà không cần quyền nhạy cảm này. Chỉ dùng nếu cần chặn/sửa request (ngoài phạm vi crawler thuần). |
| `MutationObserver` (Web API) | Phát hiện DOM thay đổi động — nền tảng của việc quét SPA/AJAX. |
| `PerformanceObserver` (Web API) | Nguồn dữ liệu network requests thụ động, không cần permission đặc biệt. |
| `IndexedDB` (Web API) | Lưu trữ chính cho dataset lớn (hàng trăm nghìn resource) — hỗ trợ index, transaction, truy vấn hiệu quả hơn `chrome.storage`. |
| `Cache API` | Cache nội dung file đã tải (CSS/JS) để không tải lại khi phân tích lại cùng 1 crawl. |
| `Streams API` | Xử lý response lớn (sitemap khổng lồ, file JS nhiều MB) theo luồng thay vì buffer toàn bộ vào RAM. |
| `File System Access API` | Tùy chọn nâng cao: cho phép ghi trực tiếp ra 1 thư mục trên máy khi export dataset rất lớn (thay vì qua `chrome.downloads` — chỉ hỗ trợ khi engine dựa trên Chromium desktop). |

---

## 8. Storage Architecture

| Storage | Khi nào dùng | Giới hạn |
|---|---|---|
| **IndexedDB** | Lưu trữ chính: `ResourceNode` records, có index theo `type`, `domain`, `depth`, `discoveredAt` để Resource Explorer query nhanh | Không giới hạn cứng (theo % dung lượng đĩa), là lựa chọn **chính** cho dataset lớn |
| **chrome.storage.local** | Config người dùng, settings, danh sách crawl job gần đây (metadata nhẹ) | ~10MB mặc định, xin `unlimitedStorage` permission nếu cần |
| **chrome.storage.session** | State crawl đang chạy (frontier queue, visited set) — cần persist liên tục vì service worker có thể bị kill | Mất khi đóng trình duyệt (đúng ý thiết kế) |
| **Cache API** | Cache raw response (HTML/CSS/JS) trong 1 phiên crawl để tránh fetch lại khi nhiều URL tham chiếu cùng 1 asset | Theo quản lý cache chuẩn của trình duyệt |
| **SQLite qua Native Messaging** | **Tùy chọn nâng cao** — nếu người dùng cài 1 native host app, cho phép export/query bằng SQL thật cho dataset cực lớn (triệu+ record) ngoài khả năng IndexedDB tiện dụng | Cần cài thêm phần mềm ngoài extension — chỉ dành cho power user |

**Vì sao không dùng `chrome.storage.local` làm kho chính?** API này serialize/deserialize toàn bộ giá trị mỗi lần đọc/ghi (không có index, không có transaction từng phần) — với hàng chục nghìn record sẽ rất chậm và dễ vượt quota. IndexedDB được thiết kế đúng cho use case này.

---

## 9. Export System

```
ResourceRepository (domain data)
        │
        ▼
  ExportUseCase(format, filterOptions)
        │
        ▼
┌───────────────┬───────────────┬───────────────┬───────────────┬───────────────┐
│ JsonExporter   │  CsvExporter  │  MdExporter    │  HtmlExporter  │ SqliteExporter │
│ (Strategy)     │  (Strategy)   │  (Strategy)    │  (Strategy)    │  (Strategy)    │
└───────────────┴───────────────┴───────────────┴───────────────┴───────────────┘
        │
        ▼
  chrome.downloads.download(blobUrl)
```

- Mỗi format là 1 **Strategy** implement chung interface `IExporter.export(nodes[]): Blob`.
- Với dataset lớn: dùng **Streams API** để ghi từng chunk ra thay vì dựng 1 chuỗi khổng lồ trong RAM (đặc biệt quan trọng cho CSV/JSON với >100k dòng).
- HTML export là 1 báo cáo tự chứa (self-contained) — nhúng sẵn CSS/JS để mở trực tiếp bằng trình duyệt, không cần server.

---

## 10. Thiết Kế UI

| Màn hình | Chức năng chính |
|---|---|
| **Dashboard** | Tổng quan job hiện tại: số URL đã quét/còn lại/lỗi, biểu đồ tốc độ crawl theo thời gian |
| **Live Crawl Progress** | Thanh tiến trình + log stream các URL vừa phát hiện (qua Long-lived Port, xem 4.4) |
| **Statistics** | Phân bổ theo loại tài nguyên (pie chart: HTML/JS/CSS/Image/API...), theo domain, theo status code |
| **Resource Explorer** | Bảng dữ liệu (virtualized list — chỉ render hàng đang hiển thị, quan trọng khi có hàng chục nghìn dòng) |
| **Search** | Full-text search trên URL/title, dùng IndexedDB index, debounce input |
| **Filters** | Theo loại, domain, status code, depth, khoảng thời gian phát hiện |
| **Tree View** | Composite pattern hiển thị trực quan — trang cha → tài nguyên con, thu gọn/mở rộng |
| **Graph View** | Force-directed graph (d3.js) cho quan hệ liên kết giữa các trang — hữu ích để thấy "cụm" trang liên quan |
| **Network Visualization** | Sơ đồ domain → subdomain → resource, giúp thấy phụ thuộc bên thứ 3 (CDN, tracking script) |
| **Error Logs** | Danh sách lỗi kèm retry count, có nút "Retry" thủ công từng URL |
| **Download Panel** | Danh sách file tải được (PDF, tài liệu), trạng thái tải, nút mở thư mục |
| **Dark Mode** | Theo `prefers-color-scheme` + toggle thủ công lưu vào `chrome.storage.local` |

---

## 11. Hiệu Năng Ở Quy Mô Lớn (Triệu URL)

- **Batch processing**: content script không gửi từng URL 1 message — gom **50-100 URL/batch** trước khi gửi về background, giảm overhead serialize của `runtime.sendMessage`.
- **Stream processing**: khi parse sitemap/JS lớn, dùng `ReadableStream` + xử lý theo chunk, không `await response.text()` toàn bộ file 50MB vào RAM 1 lần.
- **Lazy processing**: chỉ parse chi tiết nội dung 1 resource khi thực sự cần hiển thị (vd user mở Resource Explorer) — lưu trước metadata tối thiểu (URL, type, status), nội dung đầy đủ tải lazy khi cần.
- **Worker isolation**: các tác vụ CPU-nặng (content hashing, regex lớn) chạy trong offscreen document (có thể spawn thêm Web Worker bên trong) — không block message loop của background service worker.
- **Incremental crawling**: lưu `lastCrawledAt` mỗi URL; hỗ trợ "crawl lại chỉ những gì thay đổi" bằng so sánh `ETag`/`Last-Modified` header hoặc content hash, tránh crawl lại toàn bộ site mỗi lần.
- **IndexedDB batch writes**: dùng 1 transaction cho nhiều `put()` thay vì transaction riêng từng record — giảm overhead I/O đáng kể (có thể nhanh hơn 10-50x).

---

## 12. Xử Lý Lỗi

```
Error xảy ra
     │
     ▼
Phân loại lỗi ──▶ Transient (timeout, 429/503)?──▶ Retry với backoff (§5.7)
     │                                                    │
     ▼ Permanent (404, CSP block, CORS)                   ▼ Vượt max retry
Log vào Error Store ◀─────────────────────────────────── Log + đánh dấu FAILED
     │
     ▼
Job vẫn tiếp tục với URL khác (partial failure không chặn toàn bộ crawl)
```

- **Crash protection**: mọi thao tác content script bọc trong `try/catch`; nếu content script bị lỗi nghiêm trọng (vd site chặn script), background vẫn tiếp tục crawl các tab khác — 1 tab lỗi không kéo sập cả job.
- **Structured logging**: mỗi lỗi lưu kèm `{url, errorType, timestamp, stackTrace, retryCount}` để debug và hiển thị ở Error Logs screen.
- **Recovery**: khi service worker bị kill giữa chừng (không phải do lỗi mà do MV3 lifecycle), job tự resume từ state đã persist (§4.2) — đây thực chất cũng là 1 dạng "lỗi" hệ thống phải xử lý.

---

## 13. Bảo Mật

- **Permissions tối thiểu**: xin `optional_host_permissions` theo domain thay vì `<all_urls>` cố định khi có thể (§4.1).
- **CSP của extension** (`content_security_policy` trong manifest): chặn `eval()`, chỉ load script từ chính extension — không bao giờ `eval` code JS lấy được từ trang quét (dù để "phân tích" — rủi ro thực thi mã độc).
- **Extension isolation**: content script chạy ở "isolated world" — biến JS của nó không xung đột/không bị đọc bởi script của trang, trừ khi chủ động inject vào MAIN world (đã nêu ở §6, và khi đó phải cẩn trọng dữ liệu gửi ra/vào).
- **XSS prevention**: dữ liệu lấy từ DOM trang (title, meta content) khi hiển thị lên UI của extension phải qua `textContent`, không bao giờ `innerHTML` trực tiếp với dữ liệu chưa sanitize.
- **Trusted origins**: khi patch `fetch`/`postMessage`, luôn kiểm tra `event.origin` khớp với tab đang quét trước khi xử lý dữ liệu nhận được — tránh 1 trang độc hại giả mạo message injection vào extension.
- **Safe data handling**: không tự động tải hoặc thực thi file tìm được (vd không tự mở PDF/exe) — chỉ ghi nhận sự tồn tại, tải về là hành động **rõ ràng do người dùng** kích hoạt.
- **Không dùng để bypass auth/paywall**: crawler chạy trong phiên đăng nhập của người dùng — về mặt thiết kế nên giới hạn phạm vi (domain scope) mặc định an toàn, cảnh báo rõ khi user mở rộng phạm vi ra ngoài site họ đang xem.

---

## 14. Chiến Lược Testing

| Loại test | Phạm vi | Công cụ gợi ý |
|---|---|---|
| **Unit Tests** | Domain layer thuần (UrlNormalizer, DedupPolicy, PriorityQueue) — không cần trình duyệt | Vitest/Jest |
| **Integration Tests** | Use Case + Fake Repository (kiểm tra luồng nghiệp vụ đầy đủ không cần chrome.* thật) | Vitest + test doubles |
| **Browser Tests** | Content script chạy thật trong trang test cố định (fixture HTML có đủ loại resource) | Puppeteer/Playwright với extension load thật |
| **Performance Tests** | Đo thời gian crawl N URL giả lập, đo RAM theo thời gian | Playwright + performance.memory |
| **Stress Tests** | Site giả lập vòng lặp vô hạn, faceted search bùng nổ URL — xác nhận giới hạn depth/loop-detection hoạt động | Local mock server (vd Express) sinh URL động |
| **Regression Tests** | Snapshot test cho từng `ResourceExtractorStrategy` với fixture HTML/CSS/JS mẫu | Jest snapshot |
| **End-to-End Tests** | Kịch bản đầy đủ: mở popup → start crawl → chờ hoàn tất → export → kiểm tra file | Playwright (extension E2E) |

---

## 15. Cấu Trúc Thư Mục

```
deep-site-scanner/
├── manifest.json
├── src/
│   ├── presentation/
│   │   ├── popup/
│   │   ├── options/
│   │   └── sidepanel/
│   ├── application/
│   │   └── use-cases/
│   │       ├── StartCrawlUseCase.ts
│   │       ├── StopCrawlUseCase.ts
│   │       ├── DiscoverResourcesUseCase.ts
│   │       └── ExportResultsUseCase.ts
│   ├── domain/
│   │   ├── entities/         (CrawlJob, ResourceNode)
│   │   ├── value-objects/    (NormalizedUrl, ResourceType)
│   │   └── services/         (DedupPolicy, DomainScopePolicy, UrlFilterChain)
│   ├── infrastructure/
│   │   ├── background/       (service worker entrypoint, scheduler)
│   │   ├── content-script/   (DOM scanner, MutationObserver bridge)
│   │   ├── offscreen/        (heavy parsing)
│   │   ├── storage/          (IndexedDbRepository, ChromeStorageRepository)
│   │   ├── messaging/        (EventBus, PortManager)
│   │   └── export/           (Json/Csv/Md/Html/SqliteExporter)
│   └── shared/                (types, constants, logger)
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
    └── architecture.md   (tài liệu này)
```

---

## 16. Sequence Diagram — Một Lượt Crawl Đầy Đủ

```
User        Popup       Background        Content Script      Storage
 │            │              │                    │               │
 │─Start URL─▶│              │                    │               │
 │            │─StartCrawl──▶│                    │               │
 │            │              │─rehydrate state────────────────────▶│
 │            │              │◀────────state (nếu có)──────────────│
 │            │              │─create tab + inject│                │
 │            │              │───────────────────▶│                │
 │            │              │                    │─scan DOM,      │
 │            │              │                    │ hook fetch/WS  │
 │            │              │◀──batch resources──│                │
 │            │              │─filter+dedup+enqueue                │
 │            │              │─persist frontier───────────────────▶│
 │            │◀─progress event (Port)──          │                │
 │◀─cập nhật UI│              │                    │                │
 │            │              │─lấy URL tiếp theo từ frontier        │
 │            │              │─(lặp lại cho đến khi frontier rỗng   │
 │            │              │  hoặc đạt maxDepth/maxUrls)          │
 │            │              │─CrawlCompleted─────────────────────▶│
 │            │◀─notification│                    │                │
```

---

## 17. Development Roadmap

| Milestone | Nội dung | Rủi ro chính |
|---|---|---|
| **M0 — Nền tảng** | Manifest, message bus, state machine cơ bản, storage repository | Thiết kế sai contract giữa layer → sửa về sau tốn kém |
| **M1 — Crawl tĩnh** | BFS frontier, URL normalize/dedup, HTML link discovery, domain scope | URL normalization sai gây dedup sai từ gốc |
| **M2 — Resource Discovery mở rộng** | CSS/JS/sitemap/robots/JSON-LD, offscreen document | Regex JS quá lỏng → nhiều false positive |
| **M3 — SPA support** | History/hash hook, MutationObserver debounce, fetch/XHR/WebSocket hook | Hook MAIN world sai cách bị CSP trang chặn |
| **M4 — Storage & Export** | IndexedDB schema, 5 export format | Schema không có index đúng → Explorer chậm ở dataset lớn |
| **M5 — UI hoàn chỉnh** | Dashboard, Tree/Graph view, filters, dark mode | Virtualization sai → UI treo với >10k dòng |
| **M6 — Resilience** | Service worker revival, retry/circuit breaker, loop detection | Thiếu test case cho site sinh URL vô hạn |
| **M7 — Testing & Hardening** | Đủ 7 loại test ở §14, security review | Bỏ sót permission thừa khi submit Chrome Web Store |

---

## 18. Phân Tích Rủi Ro & Cải Tiến Tương Lai

**Rủi ro chính:**
1. **Service worker lifecycle** là rủi ro kỹ thuật lớn nhất của toàn bộ MV3 — cần test kỹ §4.2 trước khi build tính năng khác lên trên.
2. **Site chống bot** (Cloudflare, CAPTCHA) sẽ chặn crawl tự động — cần cơ chế phát hiện và dừng lịch sự thay vì retry vô ích.
3. **Shadow DOM `closed` mode** và **iframe cross-origin** là giới hạn nền tảng web, không thể vượt qua bằng thiết kế — cần nêu rõ trong tài liệu người dùng để tránh kỳ vọng sai.
4. **Chrome Web Store review** với `host_permissions: <all_urls>` có thể bị từ chối/yêu cầu giải trình — nên chuẩn bị sẵn optional permissions.

**Cải tiến tương lai:**
- Machine learning nhẹ để phân loại resource "quan trọng" ưu tiên crawl trước (thay vì heuristic thủ công ở §5.2).
- Hỗ trợ crawl đa tab thật sự song song với Web Worker pool để tận dụng đa nhân CPU khi hash nội dung.
- Tích hợp Native Messaging cho SQLite export ở quy mô doanh nghiệp (§8).
- Chế độ "diff crawl" trực quan — so sánh 2 lần crawl để hiển thị trang mới/mất/thay đổi.

---

*Tài liệu này là bản thiết kế đầy đủ. Bước tiếp theo (khi bạn sẵn sàng): triển khai M0 — dựng khung project theo cấu trúc §15 và message bus §4.4, viết unit test cho Domain layer trước tiên vì đây là phần không phụ thuộc trình duyệt, dễ đảm bảo đúng nhất trước khi build lên các tầng khác.*
