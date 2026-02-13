# Local Fonts

Place the self-hosted font files in this folder so the app can load them without
reaching Google Fonts during build or runtime.

Expected filenames:
- Geist-Variable.woff2
- GeistMono-Variable.woff2
- Cinzel-Variable.woff2

If you prefer static weights instead of variable fonts, update
`app/globals.css` to point at your chosen filenames and weights.
