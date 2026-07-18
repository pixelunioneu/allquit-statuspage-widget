# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities privately — do not open a public issue.

Email **support@pixelunion.eu** with:

- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal HTML page or feed payload is ideal, since this
  widget's whole attack surface is untrusted feed JSON rendered into the page)
- The affected version or commit

We'll acknowledge your report within a few business days and follow up as we
investigate and fix the issue. We'll credit you in the release notes unless you'd
prefer to stay anonymous.

## Supported versions

There's a single rolling release line (see [README § Distribution &
releases](README.md#distribution--releases)) — only the latest published version
receives security fixes.

## Scope

In scope: the widget code in this repository (`src/`) and its built output
(`dist/allquiet-status-widget.js`) — e.g. XSS via a malicious/compromised feed,
prototype pollution, `localStorage` handling, or anything that could let feed data
run script or break out of the widget's Shadow DOM.

Out of scope: AllQuiet's own status-page service, and any CORS proxy you put in
front of it — report those to their respective maintainers.
