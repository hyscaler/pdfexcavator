# Contributing to PDFExcavator

Thank you for your interest in contributing to PDFExcavator! This document provides guidelines and instructions for contributing.

## Ways to Contribute

- **Report bugs** - Open an issue describing the bug
- **Suggest features** - Open an issue with your idea
- **Submit pull requests** - Fix bugs or add features
- **Improve documentation** - Fix typos, add examples, clarify explanations

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/hyscaler/pdfexcavator.git
   cd pdfexcavator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run in development mode** (watches for changes)
   ```bash
   npm run dev
   ```

## Project Structure

```
pdfexcavator/
├── src/
│   ├── index.ts          # Main exports
│   ├── PDFExcavator.ts   # PDF document class
│   ├── Page.ts           # Page class
│   ├── PageImage.ts      # Image rendering
│   ├── cli.ts            # CLI tool
│   ├── types.ts          # TypeScript types
│   ├── extractors/       # Extraction modules
│   │   ├── text.ts       # Text extraction
│   │   ├── table.ts      # Table extraction
│   │   ├── chars.ts      # Character extraction
│   │   └── ...
│   └── utils/            # Utility functions
│       ├── bbox.ts       # Bounding box utilities
│       ├── geometry.ts   # Geometry helpers
│       └── ...
├── dist/                 # Compiled output
├── examples/             # Example scripts
└── tests/                # Test files
```

## Code Style

- Use TypeScript for all source files
- Use ES modules (`import`/`export`)
- Follow existing code formatting
- Add JSDoc comments for public APIs
- Keep functions focused and small

## Submitting Changes

1. **Fork the repository**

2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write clear, concise commit messages
   - Add tests if applicable
   - Update documentation if needed

4. **Build and test**
   ```bash
   npm run build
   npm test
   ```

5. **Submit a pull request**
   - Describe what your changes do
   - Reference any related issues

## Reporting Bugs

When reporting bugs, please include:

- PDFExcavator version (`npm list pdfexcavator`)
- Node.js version (`node --version`)
- Operating system
- Minimal code to reproduce the issue
- Sample PDF file (if possible and not confidential)
- Expected vs actual behavior

## Suggesting Features

When suggesting features:

- Check if the feature already exists
- Check if there's an existing issue for it
- Describe the use case
- Provide examples of how it would work

## Code of Conduct

- Be respectful and inclusive
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

## Questions?

Open an issue with your question or reach out to the maintainers.

Thank you for contributing!
