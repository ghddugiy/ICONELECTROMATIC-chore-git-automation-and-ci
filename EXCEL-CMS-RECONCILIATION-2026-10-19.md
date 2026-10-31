# Icon Electromatic Excel-to-CMS Reconciliation

**Status: READ-ONLY RECONCILIATION — no records were merged or imported.**

Prepared 2026-10-19. This report compares the v3 Excel workbook with the
corrected October 19 CMS backup. It records source values and structural
matches; it does not independently verify product claims, technical
specifications, external URLs, or image contents. It does not finalize a
database schema or authorize an import.

## Sources and fingerprints

| Source | Path | Fingerprint / recorded status |
|---|---|---|
| Candidate workbook | `PICTURES/Icon Website Product Info - Mrora.v3.xlsx` | SHA-256 `3b22172a3a102b53a667aeb48b0271d20a8e1216f0f895532e7eba0c1ed295a2`; 7,607,384 bytes |
| Corrected CMS export | `C:\Users\archa\Pictures\IconElectromatic-CMS-Backup-Corrected-2026-10-19T14-43-23-812Z\cms-localStorage.json` | SHA-256 `a8e7294ada73b3d343c7a6669b87f8c91c5b8aaee95b454377b7d40ebd88a0aa`; October 19 snapshot |
| Corrected backup manifest | `C:\Users\archa\Pictures\IconElectromatic-CMS-Backup-Corrected-2026-10-19T14-43-23-812Z\corrected-backup-manifest.json` | Records 13 CMS keys, 15 OEMs, 88 categories, 169 products |
| Image manifest | `C:\Users\archa\Pictures\IconElectromatic-CMS-Backup-Corrected-2026-10-19T14-43-23-812Z\image-manifest.json` | Records 134 unique original image paths and copied files |

The CMS export contains all 13 `cms_*` keys. Its `cms_products` document
contains 15 OEMs, 88 categories, and 169 products. The image manifest's 134
copied files were previously verified against their recorded sizes and
SHA-256 hashes. This comparison did not modify or recreate those sources.

## Workbook inspection

All three workbook worksheets were traversed from their OOXML content,
including every populated row and cell, merged-cell ranges, formulas,
hyperlinks, and drawing/image relationships.

| Worksheet | Used range | Non-empty rows | Relevant contents |
|---|---:|---:|---|
| `Website` | `B1:F1000` | 24 | 13 OEM names, 12 populated URLs, and 22 accompanying feedback notes |
| `Products` | `A1:AB976` | 146 | 64 rows with a product name in column D; 81 other non-empty data rows without a product name |
| `Product Pics` | `A1:CW995` | 166 | 92 product-name rows and embedded pictures |

`Products` has eight named columns: `OEM Name`, `Speciales in`, `Categories`,
`Products`, `Description`, `Application`, `Website Link`, and `Images`.
Columns I–AB have no named data fields and no populated cells. The `Images`
cells are empty for all 64 named product rows. There are no formulas in the
three sheets. Merged cells supply repeated OEM/specialty/category labels in
the comparisons below.

The 81 non-empty `Products` rows without a product name are not counted as
products. They contain category hierarchy and, in many cases, description,
application, and/or website-link text. In particular, rows 66–146 contain
category-level records and content with an empty `Products` column. Preserve
and reconcile that content separately; do not import it as product records
without an owner-approved mapping.

## Classification method

- **Confirmed match** means the Excel product name and OEM match an existing
  CMS product, the Excel category is present and matches that CMS category,
  and the description, application, and effective website link agree. Where
  Excel has a hyperlink relationship, its target is compared; otherwise the
  cell value is used. Image correspondence is not part of this status because
  the product-image cells are empty.
- **Conflict** means an Excel field with a value disagrees with its CMS
  counterpart.
- **Needs manual review** means a required comparison value—here, the
  product-level category—is missing or ambiguous.
- **Possible match** means the available values are insufficient to confirm
  identity but a candidate exists.
- **New candidate** means no existing CMS product-name candidate was found.

Name comparisons ignore case and surrounding/repeated whitespace. Category
and OEM comparisons also disregard case and punctuation/spacing for matching;
original values are preserved in the source workbook. No fuzzy matching or
automatic record merge was performed.

## Product reconciliation

The `Products` sheet contains 64 named product records: 37 Rogers Corporation,
19 Ohmega Ticer, and 8 Fortify. All 64 product names and OEMs have an existing
CMS counterpart. The descriptions and application values match across the
two sources for all 64 records. Based on fields present in both sources:

| Classification | Count | Reason |
|---|---:|---|
| Confirmed match | 47 | Product, OEM, populated category, description, application, and effective website link agree |
| Conflict | 1 | Row 55: Excel hyperlink target is a URL, but the CMS `link` value is display text rather than that URL |
| Needs manual review | 16 | Excel product-level category is blank |
| Possible match | 0 | — |
| New candidate | 0 | — |

The workbook has no product image values for these 64 records. Therefore,
even the 47 confirmed matches are not image-confirmed.

### Row-by-row detail

`CMS ID` is the existing CMS product ID corresponding by name. For rows with a
blank Excel category, the CMS category is listed only as a review candidate;
it is not an instruction to fill the blank or to change the relationship.

| Excel row | OEM | Excel category | Product | CMS ID | Classification / note |
|---:|---|---|---|---|---|
| 2 | Rogers Corporation | RT/Duroid | RT/duroid 5880 | `rt-duroid-5880-2` | Confirmed match |
| 3 | Rogers Corporation | RT/Duroid | RT/duroid 5870 | `rt-duroid-5870-3` | Confirmed match |
| 4 | Rogers Corporation | RT/Duroid | RT/duroid 5880LZ | `rt-duroid-5880lz-4` | Confirmed match |
| 5 | Rogers Corporation | RT/Duroid | RT/duroid 6002 | `rt-duroid-6002-5` | Confirmed match |
| 6 | Rogers Corporation | RT/Duroid | RT/duroid 6006 | `rt-duroid-6006-6` | Confirmed match |
| 7 | Rogers Corporation | RT/Duroid | RT/duroid 6010.2LM | `rt-duroid-6010-2lm-7` | Confirmed match |
| 8 | Rogers Corporation | RT/Duroid | RT/duroid 6035HTC | `rt-duroid-6035htc-8` | Confirmed match |
| 9 | Rogers Corporation | RO400 Series | RO4350B | `ro4350b-9` | Confirmed match |
| 10 | Rogers Corporation | RO400 Series | RO4003C | `ro4003c-10` | Confirmed match |
| 11 | Rogers Corporation | RO300 Series | RO3003 | `ro3003-11` | Confirmed match |
| 12 | Rogers Corporation | RO300 Series | RO3003G2 | `ro3003g2-12` | Confirmed match |
| 13 | Rogers Corporation | RO300 Series | RO3006 | `ro3006-13` | Confirmed match |
| 14 | Rogers Corporation | RO300 Series | RO3010 | `ro3010-14` | Confirmed match |
| 15 | Rogers Corporation | RO400 Series | RO4360G2 | `ro4360g2-15` | Confirmed match |
| 16 | Rogers Corporation | RO400 Series | RO4835 | `ro4835-16` | Confirmed match |
| 17 | Rogers Corporation | TMM Series | TMM 3 | `tmm-3-17` | Confirmed match |
| 18 | Rogers Corporation | TMM Series | TMM 4 | `tmm-4-18` | Confirmed match |
| 19 | Rogers Corporation | TMM Series | TMM 6 | `tmm-6-19` | Confirmed match |
| 20 | Rogers Corporation | TMM Series | TMM 10 | `tmm-10-20` | Confirmed match |
| 21 | Rogers Corporation | TMM Series | TMM 10i | `tmm-10i-21` | Confirmed match |
| 22 | Rogers Corporation | TMM Series | TMM 13i | `tmm-13i-22` | Confirmed match |
| 23 | Rogers Corporation | CLTE Series | CLTE-XT | `clte-xt-23` | Confirmed match |
| 24 | Rogers Corporation | CLTE Series | CLTE-MW | `clte-mw-24` | Confirmed match |
| 25 | Rogers Corporation | DICLAD Series | DiClad 880 | `diclad-880-25` | Confirmed match |
| 26 | Rogers Corporation | DICLAD Series | DiClad 870 | `diclad-870-26` | Confirmed match |
| 27 | Rogers Corporation | DICLAD Series | DiClad 527 | `diclad-527-27` | Confirmed match |
| 28 | Rogers Corporation | *(blank)* | MAGTREX 555 | `magtrex-555-28` | Needs manual review; CMS category candidate: DICLAD Series |
| 29 | Rogers Corporation | TC Series | TC350 | `tc350-29` | Confirmed match |
| 30 | Rogers Corporation | TC Series | TC350 Plus | `tc350-plus-30` | Confirmed match |
| 31 | Rogers Corporation | TC Series | TC600 | `tc600-31` | Confirmed match |
| 32 | Rogers Corporation | *(blank)* | RO4400 Bondply | `ro4400-bondply-32` | Needs manual review; CMS category candidate: TC Series |
| 33 | Rogers Corporation | *(blank)* | RO4400T Bondply | `ro4400t-bondply-33` | Needs manual review; CMS category candidate: TC Series |
| 34 | Rogers Corporation | *(blank)* | 2929 Bondply | `2929-bondply-34` | Needs manual review; CMS category candidate: TC Series |
| 35 | Rogers Corporation | *(blank)* | CuClad 6250 Bonding Film | `cuclad-6250-bonding-film-35` | Needs manual review; CMS category candidate: TC Series |
| 36 | Rogers Corporation | *(blank)* | CuClad 6700 Bonding Film | `cuclad-6700-bonding-film-36` | Needs manual review; CMS category candidate: TC Series |
| 37 | Rogers Corporation | *(blank)* | SpeedWave 300P Prepreg | `speedwave-300p-prepreg-37` | Needs manual review; CMS category candidate: TC Series |
| 38 | Rogers Corporation | *(blank)* | XtremeSpeed RO1200 | `xtremespeed-ro1200-38` | Needs manual review; CMS category candidate: TC Series |
| 39 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 0.5A10PT | `ohmegaply-rcm-0-5a10pt-39` | Confirmed match |
| 40 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 0.5A25PT | `ohmegaply-rcm-0-5a25pt-40` | Confirmed match |
| 41 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 0.5A40PT | `ohmegaply-rcm-0-5a40pt-41` | Confirmed match |
| 42 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 0.5A50PT | `ohmegaply-rcm-0-5a50pt-42` | Confirmed match |
| 43 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 0.5A100PT | `ohmegaply-rcm-0-5a100pt-43` | Confirmed match |
| 44 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 0.5A250PT | `ohmegaply-rcm-0-5a250pt-44` | Confirmed match |
| 45 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 0.5A377PT | `ohmegaply-rcm-0-5a377pt-45` | Confirmed match |
| 46 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 1A10PT | `ohmegaply-rcm-1a10pt-46` | Confirmed match |
| 47 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 1A25PT | `ohmegaply-rcm-1a25pt-47` | Confirmed match |
| 48 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 1A50PT | `ohmegaply-rcm-1a50pt-48` | Confirmed match |
| 49 | Ohmega Ticer | RCM Series | OhmegaPly® RCM – 1A100PT | `ohmegaply-rcm-1a100pt-49` | Confirmed match |
| 50 | Ohmega Ticer | TCR Series | TCR® 25N18P9X | `tcr-25n18p9x-50` | Confirmed match |
| 51 | Ohmega Ticer | TCR Series | TCR® 50N18P9X | `tcr-50n18p9x-51` | Confirmed match |
| 52 | Ohmega Ticer | TCR Series | TCR® 100N18P9X | `tcr-100n18p9x-52` | Confirmed match |
| 53 | Ohmega Ticer | TCR Series | TCR® 250A18P9X | `tcr-250a18p9x-53` | Confirmed match |
| 54 | Ohmega Ticer | TCR Series | TCR® 1KO18P9X | `tcr-1ko18p9x-54` | Confirmed match |
| 55 | Ohmega Ticer | TCR EHF Series | TCR EHF® 25N18P8X | `tcr-ehf-25n18p8x-55` | **Conflict:** Excel hyperlink target is `https://quanticohmega.com/tcr-ehf/`; CMS `link` is the text TCR-EHF® Embedded Resistor Copper Foil &#124; 5G mmWave PCB |
| 56 | Ohmega Ticer | TCR EHF Series | TCR EHF® 50N18P8X | `tcr-ehf-50n18p8x-56` | Confirmed match |
| 57 | Ohmega Ticer | TCR EHF Series | TCR EHF® 100N18P8X | `tcr-ehf-100n18p8x-57` | Confirmed match |
| 58 | Fortify | *(blank)* | Radix™ 2.8 Dielectric Lens Material | `radix-2-8-dielectric-lens-material-58` | Needs manual review; CMS category candidate: 3D Printed Dielectric Parts |
| 59 | Fortify | *(blank)* | Radix™ 4.6 Dielectric Lens Material | `radix-4-6-dielectric-lens-material-59` | Needs manual review; CMS category candidate: 3D Printed Dielectric Parts |
| 60 | Fortify | *(blank)* | GRIN Dielectric Lens (Radix™ Platform) | `grin-dielectric-lens-radix-platform-60` | Needs manual review; CMS category candidate: 3D Printed Dielectric Parts |
| 61 | Fortify | *(blank)* | 3D Printed Horn Lens | `3d-printed-horn-lens-61` | Needs manual review; CMS category candidate: 3D Printed Dielectric Parts |
| 62 | Fortify | *(blank)* | Switched Beam Antenna Lens | `switched-beam-antenna-lens-62` | Needs manual review; CMS category candidate: 3D Printed Dielectric Parts |
| 63 | Fortify | *(blank)* | Field-of-View (FOV) Enhancing Lens | `field-of-view-fov-enhancing-lens-63` | Needs manual review; CMS category candidate: 3D Printed Dielectric Parts |
| 64 | Fortify | *(blank)* | Tactical FOV Enhancing Lens | `tactical-fov-enhancing-lens-64` | Needs manual review; CMS category candidate: 3D Printed Dielectric Parts |
| 65 | Fortify | *(blank)* | Low-Dk Printed Foam Spacer (Lens Adjacent) | `low-dk-printed-foam-spacer-lens-adjacent-65` | Needs manual review; CMS category candidate: 3D Printed Dielectric Parts |

## Category reconciliation

The workbook lists 86 unique OEM/category pairs that match the CMS category
names under their corresponding OEMs. Two CMS category pairs are not present
in the workbook's category column:

| CMS OEM | CMS category absent from Excel |
|---|---|
| Fortify | 3D Printed Dielectric Parts |
| Transline Technology | PCB Fabrication |

The `Products` hierarchy contains names for all 15 CMS OEMs. The two categories
above are absent from its category column even though their OEMs appear in
other workbook fields.

The product-level category is blank for 16 named rows (Excel rows 28, 32–38,
and 58–65). The CMS categories noted in the row table are candidates only.
The `Products` sheet also repeats the Minicircuits category label `Power
Sensors` in its category-level rows; this is a repeated category entry, not a
duplicate named product in the workbook.

## OEM and website reconciliation

The `Website` worksheet lists 13 OEM names. Twelve can be matched to a CMS OEM
by name or CMS short name; `RFuQ Engineering` has no matching CMS OEM entry.
Do not assume it is the same entity as `RFuW Engineering`, which appears in
the product/category data and CMS.

The following three CMS OEMs are absent from the Website worksheet's OEM
list: `RFuW Engineering`, `Spellman`, and `AEE ISARAEL`.

URL differences requiring owner confirmation:

| OEM | Excel Website value | CMS website value | Note |
|---|---|---|---|
| Rogers Corporation | `https://www.rogerscorp.com/` | `https://www.rogerscorp.com` | Trailing slash difference |
| Ohmega Ticer | `https://ohmegaticer.com/` | `https://quanticohmega.com` | Different host |
| Thermosen | `https://thermosen.in/` | `https://www.thermosen.com` | Different host |
| Fortify | *(blank)* | `https://3dfortify.com` | Excel value missing |
| NEE / NEE International | `https://www.neeinternational.com/` | `https://www.nee-intl.com` | Different host |

The `Website` worksheet also contains 22 feedback/request notes in column B.
They are not OEM/product records and have not been treated as migration
instructions or verified claims.

## Product Pics and image reconciliation

`Product Pics` contains 92 distinct product names, all matching existing CMS
product names. The 64 detailed `Products` names are included among these 92.
The other 28 are Evans entries present only in `Product Pics`:

`XG1 Series- Binary`, `XG2 Series - 2 Terminal`, `XG3 Series - 3 Terminal`,
`XQ Series - Ultra-High Q`, `XV Series - Vertical Layer`, `Substrates`,
`TDD Series`, `TDE Series`, `THS3 Series`, `THQ`, `THQA2/M2/T2 Series`,
`HyCap Series`, `Capattery Series`, `Capacitor Banks`, `Angstor`, `Capstick`,
`Quencharc RC Snubber`, `New High Voltage MLP`, `Surfilm`,
`MLCC (Low and Mid Voltage)`, `SMPS`, `Military (MIL-PRF 49470)`,
`MegaCap Type (BC Series)`, `Pulse Energy`, `Radial Leaded`, `Discoidal`,
`Planar Arrays`, and `Safety Caps`.

There are 77 CMS products whose names do not occur in either Excel named
product list:

| CMS OEM | Products absent from both Excel product-name lists |
|---|---:|
| Minicircuits | 43 |
| Qorvo | 10 |
| TecDia | 7 |
| YTTEK | 6 |
| NEE | 4 |
| RFuW Engineering | 2 |
| TriTeq | 1 |
| Thermosen | 1 |
| Transline Technology | 1 |
| Spellman | 1 |
| AEE ISARAEL | 1 |
| **Total** | **77** |

The embedded image inventory is structurally present but not safely
product-mappable from cell data alone:

- The `Images` column on `Products` has no values for its 64 product rows.
- The `Pics` column on `Product Pics` has no text references; pictures are
  embedded workbook drawing objects.
- The workbook package contains 94 media files and 95 image anchors; one media
  target is referenced twice. There is one additional non-image drawing
  anchor, and no missing image target was found.
- 51 image anchors are positioned on rows containing product names, spanning
  25 product rows. The other 67 product rows have no same-row image anchor;
  44 image anchors are on rows without product names, and 9 product rows have
  multiple image anchors.
- These are positional observations only. Same-row placement does not prove
  an image belongs to that product. The embedded images were not opened or
  visually checked.

Separately, the CMS backup has 169 non-empty product image references across
100 unique paths; all 169 references are present in the corrected backup's
image manifest. No mapping was established between the workbook's embedded
images and those CMS paths.

## Duplicate and ambiguity findings

- No duplicate named product names were found in the Excel `Products` rows or
  `Product Pics` rows.
- The CMS contains repeated product names that require review before any
  deduplication: `Power Sensors` appears twice under Minicircuits in category
  `Power Sensors` (IDs `power-sensors-98` and `power-sensors-111`); `RF/Microwave
  PCB` appears four times under NEE in category `RF/Microwave PCB` (IDs
  `rf-microwave-pcb-141` through `rf-microwave-pcb-144`). These may be
  intentional repeated entries; the comparison does not establish that they
  are erroneous duplicates.
- Sixteen product category assignments are absent in Excel, and product
  images cannot be reliably assigned from workbook drawing positions alone.
- The RFuQ/RFuW name difference and the five OEM URL differences above need
  owner confirmation.

## Proposed next steps (no action taken)

1. Ask the owner to confirm the disputed OEM identity and website URLs,
   including whether the missing OEM website entries should be supplied.
2. Have the catalog owner confirm the 16 blank product categories and the
   row-55 TCR EHF link value.
3. Review the two repeated CMS product-name groups to decide whether the
   separate IDs represent intentional entries or duplicates.
4. Obtain an explicit mapping from workbook image objects to product IDs and
   CMS image paths. Visual review or a human-approved mapping is required;
   do not infer it from row position.
5. Decide how the 77 CMS products absent from both Excel product-name lists
   and the Excel category-level descriptions/applications/links should be
   treated. Preserve the current CMS values pending that decision.
6. Only after these decisions, prepare a separate dry-run import comparison
   for owner review. This report does not authorize a database/schema change,
   import, overwrite, image upload, or migration.

## Safety and limitations

This was a read-only comparison. No source files, Excel values, CMS backup,
images, browser storage, database records, or migrations were changed or
executed. No product rows were imported or merged. Product claims, external
URLs, and image contents have not been independently fact-checked.
