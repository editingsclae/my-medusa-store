# Fonts

`urbanist-latin.woff2` is the Urbanist variable font (weights 100-900), latin
subset, downloaded once from Google Fonts and committed so that `next build`
does not depend on fonts.googleapis.com or fonts.gstatic.com.

- Source: https://fonts.google.com/specimen/Urbanist
- License: SIL Open Font License 1.1 (see the font's Google Fonts page).
- Loaded in `app/layout.tsx` with `next/font/local`.

To update it, download the latin file of the Urbanist CSS from Google Fonts and
replace `urbanist-latin.woff2`.
