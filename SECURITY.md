# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security issues seriously. If you discover a security vulnerability in PDFLens, please report it responsibly.

### How to Report

1. **Do NOT** open a public GitHub issue for security vulnerabilities
2. Email the maintainers directly or use GitHub's private vulnerability reporting
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Assessment**: We will assess the vulnerability and its impact
- **Updates**: We will keep you informed of our progress
- **Fix**: We will work on a fix and coordinate disclosure
- **Credit**: We will credit you in the release notes (unless you prefer anonymity)

### Scope

This security policy applies to:
- The PDFLens npm package
- The official GitHub repository

### Out of Scope

- Vulnerabilities in dependencies (report to the respective project)
- Vulnerabilities in PDF files themselves
- Issues that require physical access to a user's machine

## Security Best Practices

When using PDFLens:

1. **Validate PDF sources** - Only process PDFs from trusted sources
2. **Sandbox processing** - Consider running PDF processing in isolated environments
3. **Keep updated** - Use the latest version of PDFLens
4. **Review dependencies** - Regularly audit your dependency tree

## Dependencies

PDFLens relies on:
- **pdfjs-dist** (Mozilla's pdf.js) - Well-maintained, security-conscious library
- **tesseract.js** (optional) - For OCR functionality
- **canvas** (optional) - For image rendering

We monitor these dependencies for security updates.

Thank you for helping keep PDFLens secure!
