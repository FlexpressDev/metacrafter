# MetaCrafter

**MetaCrafter** is an Enfocus Switch app that transforms private data fields using advanced rule-based logic.

## Features
- ✅ Exact, numeric, and REGEX matching
- ✅ Multi-field support with custom separator
- ✅ Capture group substitution in REGEX (`$1`, `$2`, etc.)
- ✅ Debug mode via `debug_` flow element name

## Usage
Define your rules in the `Rules` property of the app using a syntax like:

```
*** fpInput = fpOutput
EXACT test = matched
NUMERIC >10 = big
REGEX ID-(\d+) = $1
DEFAULT = unknown
```

To enable debug logging, rename the flow element in Switch to start with `debug_`.

## Packaging
To create a `.enfpack`, submit these files to Enfocus or use their internal App Creator tools.
