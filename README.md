# Fitness

## Download fitness data

Use one command to download matching Cronometer nutrition and Hevy workouts:

```sh
npm run pull
npm run pull -- --date 2026-09-05
npm run pull -- --all
```

With no options it downloads today. `--date` downloads one day, and `--all`
downloads every day from September 5, 2026 through today. Credentials are read
from the gitignored `.env` file. Today and `--date` update only the selected day
in the saved history; `--all` rebuilds the full history.

## Pull workouts from Hevy

The exporter downloads workouts from September 5, 2026 onward from the
paginated Hevy API and saves the result to `data/hevy-workouts.json`. The
generated file is gitignored because it contains personal data.

1. A Hevy Pro account is required. Create an API key in the
   [Hevy developer settings](https://hevy.com/settings?developer).
2. Add the key to the gitignored `.env` file:

```sh
HEVY_API_KEY=your-api-key
```

3. Run the exporter:

```sh
npm run hevy:pull
```

To choose a different destination:

```sh
npm run hevy:pull -- --output exports/workouts.json
```

The JSON output has this shape:

```json
{
  "exported_at": "2026-09-06T12:00:00.000Z",
  "workouts_since": "2026-09-05T00:00:00.000Z",
  "workout_count": 1,
  "workouts": []
}
```

## Pull food data from Cronometer

Cronometer does not provide a public API for personal accounts. The included
script signs in through the same HTTP flow as the web app and downloads the
official CSV exports.

Add your login to the gitignored `.env` file:

```sh
CRONOMETER_USERNAME=you@example.com
CRONOMETER_PASSWORD=your-password
```

The script reads this file automatically and never writes your credentials.

The script has a hard lower bound of September 5, 2026: it will never request
older Cronometer data. By default, it downloads from that date through today and
writes `data/cronometer/nutrition.csv` with date, calories, protein, carbs, fat,
fiber, and weight:

```sh
npm run cronometer:pull
```

If either value is missing, the terminal prompts for it and masks your password.
For an explicit date range:

```sh
npm run cronometer:pull -- --start 2026-01-01 --end 2026-09-06
```

To limit the date range:

```sh
npm run cronometer:pull -- --days 7
```

Calories come directly from Cronometer's Energy History dashboard data; protein,
carbs, fat, and fiber come from the daily nutrition export; weight comes from
the biometrics export and retains Cronometer's source unit.

Interactive runs also ask for an optional two-factor authentication code. For
unattended runs, provide the current code in `CRONOMETER_OTP`.

Run `npm run cronometer:pull -- --help` for every option. The export uses an
undocumented Cronometer web protocol, so it may need updating after Cronometer
changes its web app. If only the public GWT identifiers changed, override them
with `CRONOMETER_GWT_PERMUTATION` and `CRONOMETER_GWT_HEADER`.

The generated files are intentionally gitignored because they contain private
health information.

## Development

```sh
npm install
npm run dev
npm run typecheck
npm test
npm run build
```
