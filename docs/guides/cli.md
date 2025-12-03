# CLI Tool Guide

Command-line interface for PDF extraction.

## Installation

```bash
# Global installation
npm install -g pdflens

# Or use with npx
npx pdflens document.pdf
```

## Basic Usage

```bash
# Extract all objects (default)
pdflens document.pdf

# Extract text only
pdflens text document.pdf

# Extract tables
pdflens tables document.pdf
```

## Commands

| Command | Description |
|---------|-------------|
| `text` | Extract text content |
| `tables` | Extract tables |
| `chars` | Extract character data |
| `words` | Extract word data |
| `lines` | Extract line graphics |
| `rects` | Extract rectangles |
| `curves` | Extract curves |
| `images` | Extract image metadata |
| `annots` | Extract annotations |
| `metadata` | Show PDF metadata |
| `info` | Show page information |

## Options

### Page Selection

```bash
# Specific pages
pdflens document.pdf --pages 1,3,5

# Page range
pdflens document.pdf --pages 1-10

# Combined
pdflens document.pdf --pages 1,3-5,10
```

### Output Format

```bash
# JSON output
pdflens document.pdf --format json

# CSV output (tables)
pdflens tables document.pdf --format csv

# Text output
pdflens text document.pdf --format text
```

### Other Options

```bash
# JSON indentation
pdflens document.pdf -f json --indent 4

# Coordinate precision
pdflens chars document.pdf --precision 3

# Password for encrypted PDFs
pdflens document.pdf --password secret123
```

## Examples

### Extract Text

```bash
# All pages
pdflens text document.pdf

# Specific pages
pdflens text document.pdf --pages 1-5

# Save to file
pdflens text document.pdf > output.txt
```

### Extract Tables

```bash
# As CSV
pdflens tables document.pdf --format csv

# As JSON
pdflens tables document.pdf --format json > tables.json

# From specific pages
pdflens tables document.pdf --pages 2,4,6 --format csv
```

### Get Metadata

```bash
pdflens metadata document.pdf
```

Output:
```
Title: Annual Report 2024
Author: John Doe
Pages: 42
PDF Version: 1.7
Encrypted: No
```

### Page Information

```bash
pdflens info document.pdf
```

Output:
```
Page 1: 612 x 792 (portrait)
Page 2: 612 x 792 (portrait)
Page 3: 792 x 612 (landscape)
...
```

### Extract Characters

```bash
# Get character positions
pdflens chars document.pdf --pages 1 --format json
```

Output:
```json
[
  {
    "text": "H",
    "x0": 72.0,
    "y0": 100.5,
    "fontName": "Helvetica",
    "size": 12
  },
  ...
]
```

### Extract with Custom Types

```bash
# Only characters and rectangles
pdflens document.pdf --types char,rect

# Characters, lines, and images
pdflens document.pdf --types char,line,image
```

## Piping and Scripting

### Pipe to Other Tools

```bash
# Search in extracted text
pdflens text document.pdf | grep "important"

# Count words
pdflens text document.pdf | wc -w

# Process with jq
pdflens tables document.pdf -f json | jq '.[0].rows'
```

### Batch Processing

```bash
# Process multiple PDFs
for pdf in *.pdf; do
  pdflens text "$pdf" > "${pdf%.pdf}.txt"
done
```

### With xargs

```bash
# Extract text from all PDFs
find . -name "*.pdf" | xargs -I {} pdflens text {} > all_text.txt
```

## Output Formats

### JSON Format

```json
{
  "pageNumber": 1,
  "objects": [
    {
      "type": "char",
      "text": "H",
      "x0": 72.0,
      "y0": 100.5
    }
  ]
}
```

### CSV Format (Tables)

```csv
Column1,Column2,Column3
Value1,Value2,Value3
Value4,Value5,Value6
```

### Text Format

Plain text output with basic formatting.

## Help

```bash
# Show help
pdflens --help

# Show version
pdflens --version
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (file not found, invalid PDF, etc.) |

## Tips

1. **Use JSON for scripting**: Easier to parse programmatically
2. **Pipe to files**: Large PDFs produce lots of output
3. **Page ranges**: Process only needed pages for speed
4. **Combine with jq**: Process JSON output efficiently
