# How to add new languages to flipstarter 

Steps to add new language:

1. Create a folder in `static/ui` with you languages two letters code.
2. Copy `interface.json` from `static/ui/en` to your newly created folder.
3. Translate `interface.json` strings to your language.
4. Add you language data in static/ui/languages.json

Example:
```json
"ar": {
    "name": "Arabic",
    "momentLocales": "ar",
    "currency": "USD",
    "unicode" : "🇸🇦",
    "buttonColor": "#2196F3"
}
```

## Language code and MomentLocales
You can get momentLocales and language code for your language check: 
 - af (Afrikaans)
 - ar-dz (Arabic - Algeria)
 - ar-ly (Arabic - Libya)
 - ar-ma (Arabic - Morocco)
 - ar-sa (Arabic - Saudi Arabia)
 - ar-tn (Arabic - Tunisia)
 - ar (Arabic)
 - az (Azeri)
 - be (Belarusian)
 - bg (Bulgarian)
 - bn (Bengali)
 - bo (Tibetan)
 - bs (Bosnian)
 - ca (Catalan)
 - cs (Czech)
 - cy (Welsh)
 - da (Danish)
 - de-at (German - Austria)
 - de-ch (German - Switzerland)
 - de (German)
 - el (Greek)
 - en-au (English - Australia)
 - en-ca (English - Canada)
 - en-gb (English - Great Britain)
 - en-ie (English - Ireland)
 - en-nz (English - New Zealand)
 - en-us (English - United States)
 - es-do (Spanish - Dominican Republic)
 - es (Spanish)
 - eu (Basque)
 - fa (Farsi - Persian)
 - fi (Finnish)
 - fo (Faroese)
 - fr-ca (French - Canada)
 - fr-ch (French - Switzerland)
 - fr (French)
 - gd (Gaelic)
 - he (Hebrew)
 - hi (Hindi)
 - hr (Croatian)(
 - hu (Hungarian)
 - hy-am (Armenian)
 - id (Indonesian)
 - is (Icelandic)
 - it (Italian)
 - ja (Japanese)
 - ka (Georgian)
 - kk (Kazakh)
 - km (Khmer)
 - kn (Kannada)
 - ko (Korean)
 - lo (Lao)
 - lt (Lithuanian)
 - lv (Latvian)
 - mk (Maori)
 - ml (Malayalam)
 - mr (Marathi)
 - ms-my (Malay - Malaysia)
 - ms (Malay)
 - my (Burmese)
 - nb (Norwegian)
 - ne (Nepali)
 - nl-be (Dutch - Belgium)
 - nl (Dutch)
 - pa-in (Punjabi)
 - pl (Polish)
 - pt-br (Portuguese - Brazil)
 - pt (Portuguese)
 - ro (Romanian)
 - ru (Russian)
 - sd (Sindhi)
 - sk (Slovak)
 - sl (Slovenian)
 - sq (Albanian)
 - sr-cyrl (Serbian - Cyrillic)
 - sr (Serbian)
 - sv (Swedish)
 - sw (Swahili)
 - ta (Tamil)
 - te (Telugu)
 - th (Thai)
 - ttl-phh
 - tr (Turkish)
 - uk (Ukrainian)
 - ur (Urdu)
 - uz-latn
 - uz (Uzbek)
 - vi (Vietnamese)
 - yo (Yoruba)
 - zh-cn (Chinese - Simplified)
 - zh-hk (Chinese - Hong Kong)
 - zh-tw (Chinese - Taiwan)