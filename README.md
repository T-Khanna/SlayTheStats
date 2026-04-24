# SlayTheStats

Analytics tooling for Slay the Spire 2 run data.

## Usage

Parse a single run:

```
python parse_run.py data/run_history/1774082384.run
```

Parse all runs into `out/simplified/`:

```
python parse_run.py data/run_history/ out/simplified/
```

Use `--compact` to minify the output (no whitespace):

```
python parse_run.py --compact data/run_history/ out/simplified/
```

Output files are written to `out/` which is excluded from version control — regenerate them locally as needed.

## Data

Raw run files are stored in `data/run_history/` as `.run` files (binary JSON exported by STS2). Each file is named by Unix timestamp and represents a single complete or abandoned run.
