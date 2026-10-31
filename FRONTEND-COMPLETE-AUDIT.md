# Icon Electromatic Frontend and CMS Audit

**Audit status: INCOMPLETE — static checklist coverage is complete; runtime,
visual, binary-asset, and deployment verification remain outstanding.**

The source-review checklist below records the current static coverage, including
full CSS parsing for very large/minified stylesheets and a structured
machine-generated inventory for the large literal catalog/blog datasets.
Record values and business claims have not all been independently verified.
No browser/runtime, visual, binary-asset integrity, or deployed-site behavior
was tested, so this is not a launch-readiness certification and is not approval
to design a schema or begin migration.

No frontend/backend source, browser data, images, backups, or database records
were changed during this audit. No build, test, server, migration, import, or
deployment command was run.

## Executive summary

- The public site is a Vite single-page application using vanilla JavaScript
  modules and a custom hash router. Public paths are registered in code, but
  in-app navigation commonly uses `#/...`; this is not server-rendered,
  crawlable page content.
- The demo admin edits localStorage JSON in the same browser/origin. It does not
  call the Express API. The front end has no observed API client or content
  synchronization path.
- Main catalog data is an OEM → category → product hierarchy. Public listing
  reads the editable CMS copy when available, but product detail reads a
  separate legacy generated product model.
- Content pages, catalog, partners and blogs are separate CMS documents. Image
  values can be ordinary paths/URLs or `idb:` references whose blobs live in
  IndexedDB. Neither localStorage nor IndexedDB is shared between browsers.
- Inquiry and careers forms give client-side success feedback but have no
  submission delivery or persistence API.
- Several CMS settings appear not to affect their public output (notably SEO
  metadata and some logo fields); some page content collections are editable
  but not rendered by the inspected Home page.
- There are duplicated/disconnected data sources, hard-coded claims, a
  client-only demo login, and a destructive localStorage version-bump behavior.
- The database/API recommendations below are preliminary persistence
  classifications only. They are **not** a finalized schema.

## Audit method and limitations

Static source review only. The inspected code was not executed in a browser;
the current browser, localStorage, IndexedDB and PostgreSQL were not accessed.
No visual, responsive, accessibility, network, SEO-crawler, image-rendering,
or form-delivery test was performed.

The current continuation completed static inspection of every required text
source file marked complete in the coverage checklist: source files were read
through EOF, large stylesheets were parsed in full, and the large literal
datasets were checked against the structured inventory. Earlier audit rounds
had partial coverage; the checklist reflects the current inspection status.
Binary asset contents and runtime behavior remain unverified. Exact coverage
and outstanding checks are listed below.

## Application shell, navigation, and shared interactions

`src/main.js` registers:

| Route | Rendered feature |
|---|---|
| `/` | Home |
| `/products` | OEM/category/product catalog |
| `/product/:id` | Legacy product detail |
| `/about` | About |
| `/services` | Services |
| `/partners` | Partners |
| `/blogs` | Blog hub |
| `/blog` | Same blog renderer |
| `/contact` | Contact and careers |
| `/admin` | Admin CMS, without the public header |

For public routes, the shell renders a shared header, footer, back-to-top
control, and chatbot. `src/router.js` parses hash routes first, uses pathname
fallback when there is no hash, extracts query parameters, matches `:id`
segments, and delegates clicks on `[data-route]` and `a[href^="#/"]`. Unknown
routes fall back to the home route rather than a dedicated not-found page.
Catalog navigation mutates hash/query state with `history.replaceState` in
some flows.

Shared interactions found:

- Header navigation and a mobile/sidebar drawer; visible labels can come from
  `cms_header`, while route destinations and some links are fixed in code.
- Light/dark theme state is separately stored as `icon-theme`; a URL theme
  query is also read.
- Back-to-top appears after scrolling.
- Custom cursor behavior is enabled for sufficiently wide fine-pointer
  devices.
- Chatbot prompts produce delayed, hard-coded answers and route links based on
  static catalog text; it is not a live service or CMS-aware support API.
- Footer office/social/contact links are rendered from footer data, but the
  logo selection is hard-coded by theme rather than using all editable logo
  fields.

## Public pages and user-visible behavior

### Home (`/`)

Inspected Home content includes:

1. Video-backed hero with title, subtitle, stats, and two calls to action.
2. Core capability cards and links.
3. Popular-product cards with OEM/category filter chips.
4. Blog/insight cards and link to the blog hub.
5. Contact/engineering information, presets, and an enquiry form.

The popular-product chips filter a static popular-products collection, not the
editable full catalog. Home reads `cms_home`, `cms_contact`, and `cms_blogs`.
The form includes name, organization, email, optional phone, subject, and
message. Presets populate the message. Submitting is intercepted in the
browser; the form is replaced by a thank-you state and a random reference.
No request or durable submission record was found.

The Home module’s introductory claim that projects, gallery, and testimonials
are connected does not match the inspected Home render: those collections are
managed separately but were not found in its displayed sections.

### Catalog (`/products`)

Three levels:

1. OEM cards, specialty selector/pills, text search, search reset, and
   horizontally scrollable specialty controls.
2. Selected OEM banner and category cards with description, product count,
   sample image, and several product names.
3. Selected category/OEM view with product cards/table and a cards/table
   toggle.

Visibility is generally interpreted as visible unless explicitly
`false`; array position supplies display ordering. Search filters the
rendered OEM cards, so it only matches text present there. View mode is
in-memory state. Selected OEM/category state is represented in URL/hash
query parameters.

Product cards show name, OEM/category, description excerpt, up to two
application tags, and catalog/RFQ actions. “Catalog” returns to a catalog
level; it does not appear to open `/product/:id`. Product imagery uses record
values and fallbacks.

### Product detail (`/product/:id`)

The detail template has breadcrumb, image/gallery treatment, name/model,
description, specification table, compliance/quality claims, quote/engineering
calls to action, related products, and a missing-product state.

This route uses `src/data/products.js`, not the hierarchical `cms_products`
data. The inspected legacy model generates a separate numeric-ID product set,
including randomized specification values/flags and external image URLs.
Consequently the editable catalog IDs/fields do not reliably join to this
detail page.

#### Catalog identity and relationship reconciliation

The main hierarchical catalog resolves as 15 OEMs → 88 categories → 169
products. Its identity and relationship fields are:

| Level | Current IDs / fields | Relationship |
|---|---|---|
| OEM | String `id`; `name`, `shortName`, `specialty`, `tagline`, `description`, `website`, `accentColor`, `glowColor`, `defaultImage`, `logoImg`, `logoSvg`, `categories`; CMS adds `visible` | Root record; categories are nested in `oem.categories` and keep array order. |
| Category | String `id`; `name`, `description`, `products`; CMS/editor shape also uses `label` and `visible` | Nested under one OEM; products are nested in `category.products` and keep array order. |
| Product | String `id`; `name`, `description`, `applications`, `image`, `link`, `category` | Nested under a category; the stored `category` is a category-name string, not a category foreign key. |

The 15 current OEM IDs in `CATALOG` are `rogers-corporation`,
`minicircuits`, `qorvo`, `tecdia`, `triteq`, `rfuw-engineering`, `yttek`,
`evans`, `ohmega-ticer`, `thermosen`, `fortify`, `nee`,
`transline-technology`, `spellman`, and `aee-isarael`. Category and product
IDs are distinct string identifiers in the source catalog and are scoped in
the nested data; all 88/169 records were counted and checked for missing or
duplicate IDs, but this pass did not transcribe every identifier into this
report.

The separate legacy `products.js` model has 24 category records and 201
generated product records with numeric IDs 1–201. Category fields are
`id`, `name`, `icon`, `description`; product fields are `id`, `model`, `name`,
`category`, `categoryName`, `description`, `image`, `specs`, `isNew`, and
`isFeatured`. The `category` field is a legacy category ID; the `categoryName`
is a denormalized label. This model has no verified OEM/category relationship
to the nested CMS catalog. Its generated/randomized specs and flags are not
authoritative input for a migration.

The blog source shape is another independent hierarchy: 15 OEM groups,
containing 17 articles, 17 videos, 15 whitepapers, and 17 official links in
the imported static dataset. Groups relate through `oemId`; item arrays are
nested in each group. Article fields include `id`, `title`, `category`,
`date`, `readTime`, `image`, `summary`, `content`, and `tags`; video fields
include `id`, `title`, `speaker`, `duration`, `date`, `thumbnail`, `summary`,
and `topics`; whitepapers include `id`, `title`, `author`, `date`, `pages`,
`frequencyBand`, `summary`, and `keyFindings`; official links include
`title`, `url`, `description`, and `icon`. CMS-added visibility and video URL
fields should be treated as separate observed fields, not assumed present in
every static seed record.

### About (`/about`)

Inspected content includes hero/badges, company narrative and downloads,
quick-fact counters, vision/mission, journey timeline, infographic/lightbox,
strategic domains, partnership/engineering pillars, and “Why Us” content.
Animation and modal interactions are present. The timeline render directly
indexes four milestone positions, coupling layout to a particular array size
and order even though the admin can edit/reorder entries.

### Services (`/services`)

Hero/breadcrumb/trust badges and alternating service sections. Service items
include badge/title/subtitle, descriptive text, tags, CTA, and image slides
with dots. Slideshow behavior includes autoplay and pause-on-hover. Links and
slides are content-driven.

### Partners (`/partners`)

Hero and trust text, repeated OEM ticker, and partner cards. Ticker/card
interactions scroll/highlight or route into the product catalog. A
`PARTNER_TO_OEM_MAP` is hard-coded; newly added partner IDs may not resolve.
Partner website values exist but the inspected card route is internal rather
than an external partner-site link.

The partner seed has 13 entries while other static OEM/blog copy says 15.
The PowerRF logo path in the seed is `/PICTURES/PowerRFlogo Vert Logo1.jpg`;
the asset found in the repository is under
`public/images/oem-logos/PowerRFlogo Vert Logo1.jpg`, so the seeded path does
not match the checked location.

#### Admin-to-public field trace updates

The additional render/handler trace confirms these saved fields have no
matching public use in the inspected renderers, or are not applied as their
editor label implies:

| Admin-saved field/content | Public-rendering trace |
|---|---|
| `cms_seo` title/description/keywords/Open Graph values | No observed renderer updates the document title, description, canonical, or OG tags from this data. |
| Header `logoUrl`, footer `logoUrl` | Editors save these values, but `Header.js` and `Footer.js` choose light/dark logo paths instead. |
| Home projects, gallery, testimonial collections and associated section copy | Admin has editable collections/settings; the reviewed `Home.js` rendering does not consume those collections. |
| Partner `website` | Persisted and editable; reviewed public partner cards route internally rather than using this external destination. |
| Blog video `videoUrl` | Persisted in video objects; the reviewed public preview uses thumbnail/content and does not play/embed the URL. |
| Blog `officialWebsite` / official links | Admin supports hub links; public rendering is conditional on the relevant hub section and has not been runtime-verified. |

These are source-level observations, not confirmation that alternate markup,
runtime listeners, or an unreviewed route cannot use a field. Contact and
footer office data are independently editable; Home reads contact office
fields for the homepage contact panel while Footer reads its own copy. More
exhaustive per-field tracing remains part of the incomplete code-review gate.

#### Static asset reference inventory

A literal path scan over 28 JavaScript/CSS/HTML files found 138 unique literal
asset paths, all resolving to a repository file under the scan's candidate
roots; it found no missing or ambiguous literal references. It enumerated 146
files under `public`. Nine public files had no matching literal source
reference: `public\icon-logo.jpeg`,
`public\images\darker-version-logo.png`,
`public\images\lighter-version-logo.png`,
`public\images\oem-logos\PowerRFlogo Vert Logo1.jpg`,
`public\images\oem-logos\Tecdia_clean.png`,
`public\images\oem-logos\Tecdia_Logo_grey_bg.png`,
`public\images\oem-logos\TriTeq_cropped.png`,
`public\jbhd-tjzps.mp4`, and `public\videos\hero-bg.mp4`.
The PowerRF CMS seed path `/PICTURES/PowerRFlogo Vert Logo1.jpg` resolved
outside `public` to `PICTURES\PowerRFlogo Vert Logo1.jpg`; the corrected
backup’s image audit separately verified its copied file. This is a
source-literal inventory only: computed paths, CSS/runtime selection,
external URLs, and whether files render correctly in a browser were not
verified. “No matching literal” is not proof that a file is unused.

### Blogs (`/blogs`, `/blog`)

The hub has hero/trust copy, OEM selector chips/cards and counts, then
OEM-specific views with tabs for all updates, articles, videos, and
whitepapers. Hidden OEM/content records are filtered by `visible !== false`.
Article cards open a modal with article content and an inquiry link; video
cards open a preview modal with thumbnail, duration, summary/topics; whitepaper
entries expose download URLs. Modals close via controls/backdrop. Query/hash
state selects OEM/tab.

The public OEM collection derives from static `CATALOG`; it is not wholly
driven by current CMS visibility. The admin stores `videoUrl`, but the
inspected public video modal does not embed or play it.

### Contact and careers (`/contact`)

The inquiry view shows office information, presets, and a form containing
required name/company/email/phone/subject/model-or-frequency/message fields.
Query parameters can prefill subject, model, product, OEM, and generated
message text.

Careers view includes a tab switcher, editable introduction/benefits, and
applicant fields for name, email, position, phone, city, experience,
organization, notice period, skills, LinkedIn, resume, and statement. Labels,
options, requiredness, accepted resume types/size and related copy are
configurable. Validation is client-side. Submission displays a success state
and generated reference; neither inquiry nor career application was found
to be sent or stored. Resume bytes are not transmitted.

### Additional field-level trace from the continuation

Further targeted inspection of `ContentService.js`, `Admin.js`, and
`Contact.js` added these field and behavior details. This is not a complete
field-by-field audit of those modules.

| Feature / editable fields | Save and public-use trace |
|---|---|
| Careers tab/hero: `tabLabelSales`, `tabLabelCareers`, `breadcrumbCareers`, `eyebrowCareers`, `careersTitle`, `careersLead`, `showHiringBadge`, `hiringBadgeText`, `careersHeroImage` | Saved into `cms_contact.careers` by the careers form handler. Public Contact rendering uses the tab labels, badge visibility/text, breadcrumb/eyebrow/title/lead, and image. The image is resolved through `ImageStorage`. |
| Careers introduction/benefits: `introIcon`, `introTitle`, `introSubtitle`, `introDescription`; benefit `id`, `icon`, `iconColor`, `title`, `description` | Introduction values render in the careers info panel. Benefits are an ordered array; add/edit/delete/reorder saves to `cms_contact`. New benefit IDs are generated using `ben-` plus `Date.now()`. |
| Careers form header: `showFormBadge`, `formBadgeIcon`, `formBadgeText`, `formTitle`, `formSubtitle` | Form badge visibility, icon, and text are rendered conditionally; the form heading and subtitle are interpolated into the careers form. |
| Careers applicant controls | Per-field labels, placeholders/options and required booleans are configurable for name, email, position, phone, city, experience, organization, notice, skills, LinkedIn, statement, and resume. Position/experience/notice option arrays are editable strings with add/edit/delete/reorder handlers. |
| Resume rules: `resumeAcceptedExtensions`, `resumeMaxSizeMb`, `resumeRequired`, `resumeFormatErrorMessage`, `resumeSizeErrorMessage`, `resumeHelpText`, `resumeLabel` | Accepted extensions and max size are checked in browser code; errors use the configured format/size templates. Requiredness is represented in rendered form controls and checked again for the resume on submit. No upload request or durable resume storage was observed. |
| Careers confirmation: `successTitle`, `successSubtitle`, `successMessage`, `candidateIdPrefix`, `nextStepsTitle`, `nextStepsText`, `careersEmail`, `resetButtonText`, `validationErrorMessage`, `errorMessage` | The success view uses the title/templates, generates a client-side random reference, displays next steps and a mailto link, and offers a reset/reload button. `validationErrorMessage` is used for the missing-resume alert. `errorMessage` is editable/saved but no public read was found in the inspected source; there is no submission API whose error it currently reports. |
| Contact office hours and inquiry presets | `hoursWeekday`/`hoursWeekend` render on Contact. Presets are ordered strings and support add/edit/delete/reorder; clicking one pre-fills the inquiry message. Office data in `cms_contact` is separate from corresponding footer fields. |
| Header/footer logos and SEO | Admin exposes header/footer `logoUrl`; current Header rendering selects fixed light/dark asset paths, and the inspected Footer implementation does not consume the editable `logoUrl`. `logoDarkUrl`/`logoLightUrl` are present in defaults but not exposed by these editors or consumed in the inspected Header renderer. SEO fields (`siteTitle`, description, keywords, OG title/description/image) save through the generic page form; no corresponding dynamic document-head update was found. |
| Home section copy | Admin exposes project/gallery/testimonial section title, subtitle, and lead values in the Home document. The reviewed Home renderer does not consume these values or the separate project/gallery/testimonial collections; they are saved data with no observed output dependency in that renderer. |
| Blog video records | Sampled add/edit handlers preserve `id`, `title`, `speaker`, `duration`, `date`, `visible`, `thumbnail`, `videoUrl`, `summary`, and `topics[]`; new records are prepended to the OEM's video array. The public view filters hidden records and shows preview content, but the inspected renderer does not play/embed `videoUrl`. |

Admin form saves generally serialize submitted `FormData` into the active CMS
document. Because unchecked checkboxes do not appear in `FormData`, the
careers handlers explicitly write boolean values from checkbox state; the
numeric resume-size field is converted to a number. Most generic save/reset
behavior remains described above and has not been exhaustively traced through
every editor.

### Further source findings from the current continuation

These findings come from direct reads of additional file portions. They do not
close the outstanding full-file inspection gaps below.

- **Legacy detail data shape:** `src/data/products.js` declares 24 fixed
  Mini-Circuits-style category records. Its generator assigns integer IDs
  sequentially from 1, constructs a model from each template prefix and model
  suffix, sets `category` to the legacy category ID and `categoryName` to its
  display name, and supplies `description`, an external Mini-Circuits case-style
  image URL, `specs`, `isNew`, and `isFeatured`. `specs` include a template-
  selected frequency range and optional fields such as gain, noise figure,
  attenuation, conversion loss, coupling, switching speed, impedance, and
  length, plus generated/default case style, operating temperature, VSWR,
  connector, and RoHS values. Several values and the new/featured flags are
  selected with `Math.random()` when the product cache is first generated in
  that page runtime. These are generated demo values, not verified product
  facts, and must not be migrated as specifications or claims.
- **Identity/relationship mismatch:** the editable catalog is a nested
  OEM → category → product array with string IDs and array position/order.
  The detail page resolves a numeric route ID through the unrelated legacy
  generator. No foreign key, matching identifier, or deterministic join
  between these product records was found in the inspected source. Legacy
  category IDs identify generic Mini-Circuits lines; they are not the IDs of
  the 88 nested CMS categories. The two data sets cannot safely be merged by
  product name, model text, category label, or array order. Reconciliation
  requires an owner-approved, authoritative catalog crosswalk; absent that,
  preserve the verified CMS hierarchy as-is and quarantine/omit the generated
  legacy detail data rather than assigning invented facts.
- **Legacy detail output adds unsupported claims:** `ProductDetail.js` renders
  “RoHS Compliant”, “ISO 9001”, “Verified Stock”, and a 24-hour quote/datasheet
  promise independently of product record fields. Its inquiry URL reads
  `product.oem`, which is not among the legacy product fields constructed in
  `products.js`; the resulting OEM prefill is therefore empty for generated
  records. The legacy UI also renders a single image as both the gallery
  image and thumbnail. These are code observations, not assertions that the
  claims are true.
- **Fields preserved by catalog seeding:** the `ContentService` products seed
  maps OEMs to `id`, `name`, `shortName`, `specialty`, duplicate `category`,
  `tagline`, `description`, `website`, `logoImg`, `logoSvg`, `defaultImage`,
  `accentColor`, `glowColor`, `visible`, and nested `categories`. Categories
  map `id`, `name`, `description`, `visible`, and nested `products`. Products
  map `id`, `name`, `category`, `description`, `applications`, `link`, `image`,
  and `visible`; missing IDs may be generated from category ID plus a random
  suffix. This mapping does not preserve unlisted source properties. Array
  order carries ordering; no separate position field was observed in this
  mapping.
- **Partner rendering and linking:** the public partner page reads its own
  `cms_partners` document, uses the fields `id`, `name`, `logoImg` (or
  `logoSvg` fallback), `accentColor`, `category`, `domain`, and
  `description`, and duplicates logo-bearing partners three times for its
  ticker. The page does not filter partner records by a `visible` property in
  the inspected renderer and does not use `website` as its card destination.
  A hard-coded partner-to-OEM map handles a finite set of IDs; it includes
  `tri-teq` → `triteq`, while the partner seed/editor and other catalog
  records use distinct identifiers. New or differently spelled partner IDs
  therefore need an explicit mapping before catalog navigation can be assumed.
- **Header controls:** navigation labels and CTA label/destination are read
  from the header CMS document, but the public header and drawer choose
  `/lighter-version-logo.png` or `/darker-version-logo.png` from theme state
  rather than the admin `logoUrl` or saved light/dark logo fields. The drawer
  closes on its close button, backdrop, Escape, and route selection; the mobile
  nav toggles its expanded state and closes after navigation or outside click.
  These are source-level findings only; keyboard, focus, and responsive behavior
  were not exercised.
- **Chatbot is static and uncoupled from CMS:** matching searches the imported
  static catalog in product → category → OEM order and does not apply CMS
  visibility. Specific replies interpolate catalog name/description and link
  to catalog/contact routes; general replies contain literal portfolio,
  turnaround, delivery, ISO/RoHS, genuineness, and geographic claims. The
  chatbot does not load the CMS or a backend. These literal claims require
  owner/source verification before public use. Its helper escapes interpolated
  HTML text, but its canned HTML remains fixed source content.
- **Home catalog cards are also static:** `Home.js` obtains popular products
  through `getPopularProducts()` from `catalogData.js`, not from the editable
  `cms_products` document. The Home OEM filter buttons operate on that same
  static list. By contrast, the main `/products` page uses the CMS copy when
  present and filters hidden OEM/category/product records. Product CMS edits
  and visibility changes therefore do not consistently propagate to Home,
  the chatbot, and the detail route.
- **Legacy deployment files:** `com.html` contains a WordPress/Astra/Elementor
  home-page snapshot with remote WordPress assets, an old site title, a root
  canonical URL (`https://iconelectromatic.com/`), and embedded legacy page
  content. Full structural parsing found 14 sections, one `<h1>`, no forms,
  26 script tags, five inline style blocks, 33 anchors, 18 image/source
  elements, and no
  duplicate IDs. Its inline scripts are WordPress/Elementor configuration and
  compatibility snippets; one reloads the page on a persisted `pageshow` only
  when `window.wpforms` exists. Targeted search found no import/runtime
  reference in the Vite entry, app source, or deployment configuration.
  Whether it is deployed or retained intentionally remains unverified.
  `vercel.html` is a standalone static shell pointing at fixed hashed
  `/assets/index-*.js` and `.css` artifacts. The current `index.html` instead
  loads `/src/main.js` and `/src/styles/index.css`. The full minified
  `vercel.css` parses as a compiled stylesheet snapshot with responsive rules
  and keyframes. Targeted search found no runtime reference from the app source
  or deployment configuration (a stale feature note mentions it); whether the
  separate snapshot is deployed remains unverified.
- **Backup / spreadsheet:** neither the corrected backup nor the Excel catalog
  was opened in this continuation. Existing earlier audit notes give enough
  evidence of the static-model mismatch to identify a reconciliation need;
  exact owner-approved product facts or a crosswalk cannot be derived from
  those prior notes.

## Admin CMS operations observed

The admin is rendered at `/admin`. The sign-in screen has prefilled
hard-coded demo credentials; successful client-side comparison sets
`localStorage.admin_auth='true'`. This is not server authentication or
authorization. Admin state includes a sidebar, dashboard, shared modals,
reset, logout, and a global image field widget.

Shared generic card forms use `FormData`, update collection objects, and save
through `ContentService.saveData()`. Reordering swaps entries in arrays.
Reset asks for confirmation, invokes `resetData(currentTab)`, and rerenders.
The image widget accepts an image file or pasted path/URL, previews it,
updates/deletes a value, and removes an IndexedDB blob only when the prior
value starts with `idb:`. This is browser-local upload/storage, not a server
upload.

| Admin section | Observed editable operations and fields |
|---|---|
| Dashboard | Displays catalog/content counts and broad CMS status claims. |
| Home | Edit hero text/video/poster, CTAs and section copy. Add/edit/delete/reorder stats (`value`, `label`) and capability cards (`title`, `icon`, `desc`, link text/URL). |
| About | Edit hero/company narrative, vision/mission, journey, downloads, infographic. CRUD/reorder badges, highlights, stats, milestones, domains, pillars and Why Us cards; image-bearing entries use image widget. |
| Services | Edit service content and CRUD/reorder blocks, descriptions, tags, slides/captions and CTA. Add defaults CTA values; edit UI handles up to two slides while preserving further slides; not all header/badge defaults were verified as editable. |
| Projects | Edit intro; CRUD/reorder cards with title, category, client sector, date, status, tags, image and description. |
| Gallery | CRUD/reorder title, category, image and caption. |
| Testimonials | Edit intro; CRUD/reorder name, role, company, industry, stars, avatar and quote. |
| Contact/careers | Edit contact and career copy, offices/hours; CRUD/reorder presets, benefits, positions, experience levels and notice options; edit labels, toggles, required flags, validation/success text, resume constraints and settings. These are configuration only, not submission storage. |
| Products/OEMs | Search/expand admin tree; create/edit/delete/show/hide/reorder OEMs, categories and products. OEM creation seeds “General Products”; category deletion removes contained products; category rename updates product category text; moving products can create/append a category. Product fields include ID, name/model, image, description, applications, URL, visibility. |
| Partners | Edit hero/trust copy; CRUD/reorder partner name, domain, accent, logo, website, description. No partner visibility toggle was found in the reviewed handlers. |
| Blogs | Edit hub copy and OEM profiles; show/hide and CRUD/reorder articles, videos, whitepapers; CRUD/reorder official links. Article fields: title/category/date/read time/image/summary/content/tags/visible. Video fields: title/speaker/duration/date/thumbnail/video URL/summary/topics/visible. Whitepaper fields: title/author/date/pages/frequency/download URL/summary/key findings/visible. Link fields: title/URL/description/icon. Links did not have visibility controls in the inspected handlers. |
| Header/nav | Edit logo fields, CTA label/link, and seven nav labels. Some visible route/link/logo behavior remains hard-coded. |
| Footer | Edit logo fields, tagline, copyright, social URLs, office names/addresses/phones/emails. Contact also has office fields in a separate content record. |
| SEO | Edit title, description, keywords and OpenGraph fields/image. Inspected code did not apply these to the document head at runtime. |

Admin writes whole-page JSON documents, not individual persistent rows.
Operations may replace the current document in localStorage and do not provide
multiuser concurrency, revision history, authorization, rollback, or shared
publication state.

## Data, storage, and persistence trace

### Local storage

`ContentService` uses `CMS_VERSION='v7'` and keys prefixed `cms_`. It stores
JSON strings. Page content keys defined in defaults include `header`, `footer`,
`home`, `about`, `services`, `projects`, `gallery`, `testimonials`, `contact`,
and `seo`, alongside `products`, `partners`, and `blogs`; `cms_version` is a
control key. Some keys are seeded only when requested. The verified October 19
snapshot included 13 `cms_*` keys (including `cms_version`) and did not
contain `cms_services`; this means the source defines more possible CMS
documents than that snapshot had saved.

On version mismatch, `getData()` removes **every** localStorage key beginning
`cms_`, sets the version, then seeds documents on demand. This is destructive
reset behavior rather than a data-preserving schema migration. Product cached
data is accepted only if the expected nested categories structure exists;
legacy blog/partner shapes are wrapped; contact data is merged with career
defaults and missing option arrays repaired. `saveData()` serializes one
document and dispatches `cms-data-updated`; no listener was found in the
inspected source. `resetData()` removes one page key and re-seeds it.

Other observed localStorage use:

- `admin_auth`: demo login flag.
- `icon-theme`: light/dark preference.

### IndexedDB and images

`ImageStorage.js` defines database `IconElectromatic_CMS`, store `cms_images`,
version 1. Blob records are keyed by `id`; CMS values can contain `idb:` IDs.
`init()` loads records into an in-memory object-URL cache; normal asset paths
and external URLs pass through. Admin uploads save blobs to IndexedDB, and
content values refer to those records. Deleting/replacing an `idb:` image can
remove its IndexedDB record. This storage is local to one browser profile and
is not persistent shared media storage for a production website.

The corrected backup audit done separately found 0 IndexedDB image
references in its saved CMS snapshot; later image-copy work populated a backup
image directory from the referenced local files. That backup observation is
not a live inspection of the browser.

### Static data and model duplication

- `catalogData.js`: primary static OEM/category/product hierarchy.
- `cms_products`: editable/serialized reduced copy seeded from that catalog.
- `blogData.js`: separate static OEM blog content normalized into `cms_blogs`.
- `cms_partners`: another independent partner dataset and mapping.
- `products.js`: separate generated numeric-ID product set used by detail route.

The detail model is not linked to CMS product IDs or specs. Static Home product
chips, blog OEM selection, chatbot answers, partner mapping, and catalog content
are not all driven by a common CMS model. Catalog category seeding drops
`label`, which exists in other catalog/admin shapes. Blog and partner
compatibility conversions allow multiple data shapes to coexist.

## Feature-to-data and preliminary backend-persistence mapping

The “backend need” column describes behavior a future system would need; it
does not prescribe routes or finalize a schema.

| Feature/data | Current fields / source | Current persistence | Preliminary persistence class and backend need |
|---|---|---|---|
| Header/footer | Flat navigation, CTA, logo, offices, social, legal/tagline fields; `Header.js`, `Footer.js`, `ContentService.js` | `cms_header`, `cms_footer` | Structured JSON is adequate for singleton settings. Reconcile footer/contact office duplication; persistent images only if logo uploads are supported. |
| Home/about/services | Hero/section copy, CTAs, badges, stats, cards, arrays, slides, milestones, domains, pillars | `cms_home`, `cms_about`, `cms_services` | JSON page content is plausible for mostly page-shaped content. Arrays need stable IDs/order/visibility if independently managed or referenced. Images need a media store and stable references. |
| Projects/gallery/testimonials | `items[]` with project metadata, gallery category/caption/image, testimonial identity/quote/rating/avatar | `cms_projects`, `cms_gallery`, `cms_testimonials` | JSON can preserve current page shapes; relational rows may be warranted for filtering/search, independent lifecycle, audit/versioning. Images require persistent media storage. Home rendering/integration must be decided. |
| Contact/careers configuration | Offices, presets, labels, required flags, choices, benefits, positions, resume rules, copy | `cms_contact` plus duplicate `cms_footer` office data | JSON configuration could preserve existing shape. Actual submissions must be separate persisted records/endpoints with validation, spam controls, regional routing, retention policy and protected resume storage. |
| OEM/catalog | OEM identities, specialty, descriptions, websites, logos, colors, visibility; categories and products nested with IDs, images, descriptions, applications, links and order | `cms_products` nested JSON seeded from `CATALOG` | Relational OEM/category/product entities and explicit ordering/foreign keys are likely needed for individual CRUD, filters, public item URLs and joins. Keep full field inventory before deciding schema. |
| Partners | Partner identity/domain/category/accent/logo/description/website; partner↔OEM map | `cms_partners` JSON plus hard-coded map | Structured partner rows and managed relationship to OEMs may be needed. Image fields need persistent storage. |
| Blog hub/content | OEM groups, articles/rich body/tags, videos, whitepapers/key findings, official links, visibility/order | `cms_blogs` JSON seeded from `OEM_BLOGS` | Relational content entities may support independent publish/order/search/ownership. Article body can remain text/JSON if suitable; persistent image/video/document media references need design. |
| SEO | Page/site title, descriptions, keywords, OG fields/image | `cms_seo` JSON; not observed applied at runtime | JSON settings can store values, but public rendering/build must actually emit unique titles/descriptions/canonical/OG metadata. |
| Product detail legacy data | Numeric ID, model/category/description/image/specs/flags in `products.js` | In-memory generated/static module | Must be reconciled with the main catalog before persistence; avoid migrating generated/random values as verified product facts. |
| Admin identity | Demo email/password comparison and `admin_auth` boolean | `localStorage.admin_auth` | Requires server-enforced authentication/authorization; never persist credentials/session authorization as CMS content. |
| Enquiry/applicant submissions | Form values and resume data in Home/Contact handlers | Client-only form state/success UI | Relational submission records and validated server endpoints; sensitive resume files need protected object storage and access/retention rules. |
| Images/assets | Paths/URLs/`idb:` values, SVG logo strings, uploaded blobs | Static public files + external URLs + local IndexedDB | Persistent media storage needed for uploads, with metadata/path references and safe SVG/content handling; migrate existing paths without inventing replacements. |
| Chatbot/theme | Static answers and catalog references; theme preference | In-memory chatbot; `icon-theme` localStorage | Theme preference may remain client-specific; chatbot is not CMS/API-driven and should not become a backend dependency without product decision. |

No frontend call to `fetch`, Axios, `XMLHttpRequest`, `sendBeacon`, or `/api/`
was found in the reviewed source searches. Backend integration therefore
requires a deliberate client loading/update strategy: public renderers and
admin currently expect synchronous local data. Forms likewise need distinct
server submission behavior rather than a storage adapter alone.

## Inconsistencies, risks, and missing functionality

1. **Disconnected product detail:** multiple product schemas and route identity
   do not join. Specs/randomized flags and external images in the legacy
   generator should not be treated as verified CMS facts.
2. **Public SEO absent/incomplete:** static entry metadata, hash routes, no
   observed dynamic head updates, and no inspected evidence of server-rendered
   per-page metadata/canonical URLs.
3. **Demo authentication:** hard-coded prefilled credentials and browser-only
   flag do not protect admin operations.
4. **No persistence/API for forms:** thank-you states imply success without
   delivery/storage; career resume is not uploaded.
5. **Destructive version upgrade:** a `cms_version` mismatch removes all
   `cms_*` localStorage entries.
6. **Local-only data/images:** CMS edits and IndexedDB blobs are not shared,
   backed up automatically, or synchronized across user devices.
7. **Hard-coded claims:** inspected code contains unverified product counts,
   compliance/stock/delivery claims, customer/testimonial content, and chatbot
   assertions that need source verification.
8. **Visibility/relationships vary:** products and blog material have
   visibility handling, while partner visibility was not found; OEM/category
   relationships are partly inferred from nested array position and hard-coded
   mapping.
9. **Editable data not consistently rendered:** SEO fields and some logo fields
   appear unused; projects/gallery/testimonials are managed but not found in
   Home rendering; `videoUrl` is saved but not played.
10. **Duplicate office fields:** contact and footer contain independently
    editable office data.
11. **Potential path error:** seeded PowerRF URL differs from checked asset
    path.
12. **Deployment artifacts unclear:** WordPress-era `com.html`, fixed-hash
    `vercel.html`, and minified `vercel.css` may be legacy/snapshot files;
    static review did not establish whether deployed or still referenced.

## Files inspected and exact coverage status

All listed paths are under
`C:\Users\archa\Desktop\Iconelecromatics\ICONELECTROMATIC-chore-git-automation-and-ci`.
**Partial** means only targeted ranges/searches or asset enumeration were
completed. **Complete** means the full source was read, parsed, or structurally
inventoried through EOF; it does not mean runtime behavior was tested.

### Entry, routing, and configuration

| File | Coverage |
|---|---|
| `index.html` | Complete static read in the current continuation (18 lines); runtime/head behavior not-tested |
| `src\main.js` | Complete static read in the current continuation; runtime route behavior not-tested |
| `src\router.js` | Complete static read in the current continuation; runtime route behavior not-tested |
| `vite.config.js` | Inspected; Vite configuration |
| `package.json` | Inspected; scripts and declared dependencies |
| `package-lock.json` | Enumerated; not reviewed in detail |
| `vercel.json` | Inspected |
| `vercel.html` | Complete |
| `vercel.css` | Full-file PostCSS parse; 18 physical lines, 1,209 rules, 1,306 unique selectors, 4,986 declarations, 17 media rules, 9 keyframes; runtime/deployment use unverified |
| `com.html` | Full-file HTML structure/resource inventory; 973 physical lines; inline style blocks parsed; legacy WordPress snapshot, runtime/deployment use unverified |

### Admin and shared components

| File | Coverage |
|---|---|
| `src\admin\Admin.js` | Complete static read, lines 1–4,947 in consecutive bounded ranges; a further bounded reread covered 1,961–3,560. Runtime behavior unverified. |
| `src\admin\admin.css` | Full-file PostCSS parse; 1,040 physical lines, 174 rules, 170 unique selectors, 784 declarations, one media rule, three keyframes; runtime rendering unverified |
| `src\components\Chatbot.js` | Complete static read, lines 1–452; runtime unverified |
| `src\components\CustomCursor.js` | Inspected in first pass; not runtime-tested |
| `src\components\Footer.js` | Inspected in first pass; not runtime-tested |
| `src\components\Header.js` | Complete static read, lines 1–408; runtime unverified |
| `src\components\ProductCard.js` | Inspected in first pass; not runtime-tested |
| `src\components\sidebar-drawer.css` | Full-file PostCSS parse; 574 physical lines, 80 rules, 73 unique selectors, 307 declarations, four media rules; runtime rendering unverified |

### Data and persistence

| File | Coverage |
|---|---|
| `src\data\blogData.js` | Full static data/helper review; 999 physical lines; every OEM group and nested record ID/field set is represented in the verified supporting inventory |
| `src\data\catalogData.js` | Full static data/helper review; 2,436 physical lines; all OEM/category/product IDs, fields, and parent relationships are represented in the verified supporting inventory |
| `src\data\ContentService.js` | Complete static read, lines 1–891 in consecutive bounded ranges; runtime storage behavior not tested. |
| `src\data\ImageStorage.js` | Inspected in first pass; resolver/upload persistence paths; browser IndexedDB behavior not runtime-tested |
| `src\data\products.js` | Complete static read, lines 1–231 in bounded ranges; its generated specifications/flags remain synthetic data, not verified facts |

### Page components

| File | Coverage |
|---|---|
| `src\pages\About.js` | Complete static read, lines 1–618; runtime unverified |
| `src\pages\Blogs.js` | Complete static read, lines 1–766; runtime unverified |
| `src\pages\Contact.js` | Complete static read through current EOF, lines 1–697; the previous coverage request extended to 698. Runtime behavior not tested. |
| `src\pages\Home.js` | Complete static read, lines 1–438; the latest continuation read lines 401–438 through EOF. Runtime behavior not tested. |
| `src\pages\Partners.js` | Complete static read, lines 1–171; the latest continuation read lines 154–171 through EOF. Runtime behavior not tested. |
| `src\pages\ProductDetail.js` | Complete static read; runtime not-tested |
| `src\pages\Products.js` | Complete static read, lines 1–925; runtime unverified |
| `src\pages\Services.js` | Complete static read, lines 1–191; the latest continuation read lines 168–191 through EOF. Runtime behavior not tested. |

### Styles and binary assets

| File/asset group | Coverage |
|---|---|
| `src\styles\index.css` | Full-file PostCSS parse; 13,224 physical lines, 1,868 rules, 1,843 unique selectors, 7,097 declarations, 31 media rules, 36 keyframes; runtime rendering unverified |
| `public\` assets | Enumerated/referenced; binary contents not opened or visually checked |
| `PICTURES\` assets | Enumerated/referenced selectively; complete integrity/usage verification not performed |

The backend was not audited beyond the frontend search for API calls. No
individual backend implementation file is claimed as inspected here.

### Required-source completion checklist

`[x]` means the source file was reviewed through EOF or fully parsed and
structurally inspected, including supporting inventory where the file is a
large literal data set. No runtime behavior is implied.

- [x] `index.html`
- [x] `src/main.js`
- [x] `src/router.js`
- [x] `src/admin/Admin.js` — complete static read, lines 1–4,947; runtime unverified
- [x] `src/data/ContentService.js` — complete static read, lines 1–891; runtime unverified
- [x] `src/data/catalogData.js` — all 15 OEMs, 88 categories, 169 products,
  IDs/fields/relationships inventoried and verified against source
- [x] `src/data/blogData.js` — all 15 OEM groups and nested record IDs/fields
  inventoried and verified against source
- [x] `src/data/products.js` — complete static read, lines 1–231; generated
  specifications/flags are not verified facts
- [x] `src/pages/About.js` — complete static read, lines 1–618; runtime unverified
- [x] `src/pages/Blogs.js` — complete static read, lines 1–766; runtime unverified
- [x] `src/pages/Contact.js` — complete static read, lines 1–697; runtime unverified
- [x] `src/pages/Home.js` — complete static read, lines 1–438; runtime unverified
- [x] `src/pages/Partners.js` — complete static read, lines 1–171; runtime unverified
- [x] `src/pages/Products.js` — complete static read, lines 1–925; runtime unverified
- [x] `src/pages/ProductDetail.js` — complete static read in an earlier audit
- [x] `src/pages/Services.js` — complete static read, lines 1–191; runtime unverified
- [x] `src/components/Header.js` — complete static read, lines 1–408; runtime unverified
- [x] `src/components/Chatbot.js` — complete static read, lines 1–452; runtime unverified
- [x] `src/styles/index.css` — full PostCSS parse; 13,224 lines
- [x] `src/admin/admin.css` — full PostCSS parse; 1,040 lines
- [x] `src/components/sidebar-drawer.css` — full PostCSS parse; 574 lines
- [x] `com.html` — full HTML structure/resource inspection and inline CSS parse;
  973 lines; legacy WordPress snapshot
- [x] `vercel.css` — full PostCSS parse; 18 lines; compiled snapshot
- [x] `vercel.html` — complete static read in an earlier audit

## Coverage limits and next audit gate

The static source-review checklist above is complete for the listed frontend
modules and deployment HTML/CSS. The full catalog/blog modules were evaluated
as static exports and their every record ID, field key, and parent relationship
was compared with `FRONTEND-DATA-INVENTORY.json`; the check found zero
inventory mismatches. This validates structure and relationships, not the
truth of every source string, technical specification, URL, or business claim.
The legacy generated product records remain synthetic and are not factual
catalog data.

Since the previous report update, `src/pages/About.js` (1–618),
`src/pages/Blogs.js` (1–766), `src/pages/Products.js` (1–925),
`src/components/Header.js` (1–408), and `src/components/Chatbot.js` (1–452)
were read in consecutive bounded ranges through their actual EOFs. These
checklist entries certify static source coverage only, not runtime or visual
behavior. The current line counts were verified from the workspace using
`[System.IO.File]::ReadAllLines`: `Admin.js` 4,947, `ContentService.js` 891,
`catalogData.js` 2,436, `blogData.js` 999, data `products.js` 231,
`Home.js` 438, `Contact.js` 697, `Partners.js` 171, `Services.js` 191,
`About.js` 618, `Blogs.js` 766, page `Products.js` 925, `Header.js` 408,
`Chatbot.js` 452, `index.css` 13,224, `admin.css` 1,040,
`sidebar-drawer.css` 574, `com.html` 973, and `vercel.css` 18. These values
supersede earlier line counts in this report.

The complete Contact source confirms that the inquiry and recruiting submit
handlers only replace the form with an in-page confirmation; neither sends
data to an API nor stores submissions. The resume is checked in the browser
for configured extension and size and is not uploaded. The generated
candidate reference is random and is not persisted. The `careers.errorMessage`
setting is saved/configurable but is not used by the inspected page handler.
Query/hash values can set the inquiry subject, product/model, OEM text, message,
and initial tab; the inquiry subject choices and most inquiry labels/copy are
hard-coded rather than CMS-driven. This is source-level evidence only.

The completed Admin.js read covers the careers editors, contact presets and
careers form-save handlers, plus OEM/category/product catalog rendering and
CRUD, visibility and reorder handlers. The additional reread of lines
1,961–3,560 confirms those operations write through
`ContentService.saveData` to browser-local CMS data. `ContentService.js` was
also read through EOF, including defaults, conversions, version handling and
save/reset logic; no potentially destructive method was executed.

The complete literal data modules were compared against the supporting
machine-generated inventory: 15 OEMs, 88 categories and 169 products; 15 blog
groups, 17 articles, 17 videos, 15 whitepapers and 17 official links; and the
separate legacy generated dataset summary of 24 categories and 201 generated
products. Main catalog and blog ID/field/relationship comparisons returned
zero mismatches. The dataset module helpers were inspected; no browser,
storage, API, or database module was imported for this comparison.

The large stylesheet coverage was completed by parsing every stylesheet with
the project’s already-installed PostCSS parser; no parse errors occurred.
`index.css` contains 1,868 rules, 1,843 unique selectors, 7,097 declarations,
31 media rules and 36 keyframes. `admin.css` contains 174 rules, 170 unique
selectors, 784 declarations, one media rule and three keyframes. The sidebar
stylesheet contains 80 rules, 73 unique selectors, 307 declarations and four
media rules. Minified `vercel.css` contains 1,209 rules, 1,306 unique
selectors, 4,986 declarations, 17 media rules and nine keyframes. The files
were parsed in full, not sampled from their minified or large output.

`com.html` was fully inspected with an HTML parser that enumerated document
structure, headings, links, image references, forms, external scripts and
inline scripts; all five embedded style blocks were separately parsed with
PostCSS. It is a legacy WordPress/Astra/Elementor page capture and has no form
markup. No source/config reference to `com.html` or `vercel.css` was found in
the targeted Vite application and deployment files.

The completed `About.js` read confirmed that its public render consumes the
About document’s hero, badges, highlight cards, stats, company copy, downloads,
vision/mission, journey milestones, strategic domains, pillars and “why us”
content, with inline fallback values where a field/list is absent. It also
uses browser-only animation and infographic-modal handlers.

The completed `Blogs.js` read confirmed that OEM/article/video/whitepaper
visibility is filtered in its public listing paths, OEM and tab selection are
encoded in the hash query, and article/video modals are client-side previews.
The video modal displays a thumbnail and “Session Stream Ready” text; this
source does not implement video playback. Article body content is assigned to
`innerHTML`, so any eventual CMS/API must define and enforce a safe rich-text
format rather than accepting arbitrary unsanitized HTML.

The completed `Products.js` read confirmed the public OEM → category → product
navigation, per-level visibility filtering, specialty/search controls,
breadcrumb updates and cards/table toggle. Category preview counts and preview
names use the raw category `products` array rather than filtering hidden
products, while the product-detail-level list filters them; hidden product
names/counts can therefore remain visible in category previews. The product
`link` field is saved and an `isValidLink` value is computed, but no datasheet
link is rendered by the inspected public card/table functions. The Header reads
its nav labels and CTA text/link from the header CMS document, but selects
theme logo paths directly and stores the theme in the separate
`icon-theme` localStorage key. Chatbot matching reads static `CATALOG` data and
contains hard-coded business/quality/delivery claims; it does not read the CMS
catalog or verify those claims against a service.

`FRONTEND-DATA-INVENTORY.json` is a supporting machine-generated structural
inventory. It records IDs, field keys and parent relationships for the main
catalog and blog content and summarizes the separate legacy generated product
data. Its catalog counts are 15 OEMs, 88 categories and 169 products. It is
not a substitute for complete source review or factual verification of
generated product specifications and claims.

Binary assets were not visually examined and the public site was not
exercised. Exact rendered behavior, route deployment, mobile presentation,
accessibility, image load success, client storage behavior under real browser
conditions, and form network delivery remain unverified. These are the
remaining audit gates; they do not mean the listed source files remain
partially inspected.

The data comparison evaluated only static data exports in memory; it did not
read or write browser storage or the database. The supporting
`FRONTEND-DATA-INVENTORY.json` contains catalog/blog record IDs where present,
field keys, and parent relationships rather than copying all IDs into this
report. The
inventory does not independently validate the truth of source strings or
technical/business claims. The CMS backup/export was not re-read in this
continuation. Admin operations were inspected statically but not exercised.
The source-review checklist is complete for the enumerated files; the overall
audit remains incomplete because runtime, visual, asset-integrity and
deployment behavior remain unverified.

Safe runtime verification still required (only after explicit approval and
with a non-production/test browser profile): exercise every route and
responsive layout; observe image load outcomes including local `idb:` values;
test catalog search/filter/order/visibility and product-detail resolution;
exercise each admin create/edit/delete/reorder/save and image-upload flow
against disposable data; verify form submission actually sends/stores no data
and document its current behavior; inspect rendered SEO/head metadata; and
check console/network errors. This audit did not navigate, refresh, or
interrogate the user's active browser session.

**Database-design gate:** Do not finalize a schema or start migration based
solely on this report. Runtime/visual verification, owner confirmation of
product facts and claims, and approval of the feature-to-data inventory remain
separate gates.
