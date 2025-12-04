# CLI Tool Guide

Command-line interface for PDF extraction.

## Installation

```bash
# Global installation
npm install -g pdfexcavator

# Or use with npx
npx pdfexcavator document.pdf
```

## Basic Usage

```bash
# Extract all objects (default)
pdfexcavator document.pdf

# Extract text only
pdfexcavator text document.pdf

# Extract tables
pdfexcavator tables document.pdf
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
pdfexcavator document.pdf --pages 1,3,5

# Page range
pdfexcavator document.pdf --pages 1-10

# Combined
pdfexcavator document.pdf --pages 1,3-5,10
```

### Output Format

```bash
# JSON output
pdfexcavator document.pdf --format json

# CSV output (tables)
pdfexcavator tables document.pdf --format csv

# Text output
pdfexcavator text document.pdf --format text
```

### Other Options

```bash
# JSON indentation
pdfexcavator document.pdf -f json --indent 4

# Coordinate precision
pdfexcavator chars document.pdf --precision 3

# Password for encrypted PDFs
pdfexcavator document.pdf --password secret123
```

## Examples

### Extract Text

```bash
# All pages
pdfexcavator text document.pdf

# Specific pages
pdfexcavator text document.pdf --pages 1-5

# Save to file
pdfexcavator text document.pdf > output.txt
```

### Extract Tables

```bash
# As CSV
pdfexcavator tables document.pdf --format csv

# As JSON
pdfexcavator tables document.pdf --format json > tables.json

# From specific pages
pdfexcavator tables document.pdf --pages 2,4,6 --format csv
```

### Get Metadata

```bash
pdfexcavator metadata document.pdf
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
pdfexcavator info document.pdf
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
pdfexcavator chars document.pdf --pages 1 --format json
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
pdfexcavator document.pdf --types char,rect

# Characters, lines, and images
pdfexcavator document.pdf --types char,line,image
```

## Piping and Scripting

### Pipe to Other Tools

```bash
# Search in extracted text
pdfexcavator text document.pdf | grep "important"

# Count words
pdfexcavator text document.pdf | wc -w

# Process with jq
pdfexcavator tables document.pdf -f json | jq '.[0].rows'
```

### Batch Processing

```bash
# Process multiple PDFs
for pdf in *.pdf; do
  pdfexcavator text "$pdf" > "${pdf%.pdf}.txt"
done
```

### With xargs

```bash
# Extract text from all PDFs
find . -name "*.pdf" | xargs -I {} pdfexcavator text {} > all_text.txt
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
pdfexcavator --help

# Show version
pdfexcavator --version
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
