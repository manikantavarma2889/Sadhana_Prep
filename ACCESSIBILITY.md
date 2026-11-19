# Accessibility

## Project accessibility statement

Sadhana Prep aims to make technical learning and interview practice usable through different input methods and assistive technologies. Accessibility is part of ongoing development, with WCAG 2.2 Level AA as a target.

**Status:** the application has not received a complete accessibility audit or a verified WCAG conformance assessment. The checks below cover specific tasks, not every page or assistive technology.

**Scope:** the public website, account forms, candidate workspace, Prep Hub, interview setup, live interview, and reports.

### Features in the current implementation

- Text chat provides an alternative to spoken interview answers. Interview questions also appear as text.
- Live voice captions show draft speech text. Final transcript verification is available when a hosted speech provider is configured.
- Forms use visible labels, password visibility controls, and textual validation messages.
- Icon controls have accessible names; navigation and progress indicators use descriptive labels.
- The candidate workspace includes a **Skip to main content** link and visible keyboard focus styles.
- Learning and interview dialogs use the browser's native dialog element, with named controls and Escape handling.
- The homepage, walkthrough, system design course, and footer respond to reduced-motion preferences.
- Layouts adapt to smaller viewports. Diagram lessons include written steps and notes alongside visual material.

These features describe implementation intent. They do not establish that all controls work with every screen reader or input method.

### Known limitations and areas to review

- A full keyboard and screen-reader review has not been completed. NVDA, JAWS, VoiceOver, and TalkBack coverage is pending.
- Visual architecture diagrams and animated connections may need richer text descriptions to convey all relationships.
- Speech recognition currently focuses on English. Accuracy varies with pronunciation, technical vocabulary, microphone quality, background noise, browser support, and provider availability. Typed answers remain available.
- Interviews are timed. A longer session can be chosen before starting, but the timer cannot currently be extended during an active session.
- Dense coding tables and diagrams can require horizontal navigation on small screens. Detailed reflow and browser zoom testing is still pending.
- Color contrast, forced-colors/high-contrast modes, screen-reader announcements for live transcripts, and all dialog focus paths need a dedicated audit.
- The public landing page does not currently provide the workspace's skip-to-main-content link.

### Report an accessibility barrier

[Open an accessibility issue](https://github.com/manikantavarma2889/Sadhana_Prep/issues/new?title=Accessibility%3A%20) with the page or task, expected behavior, observed barrier, and any browser, operating-system, or assistive-technology details you are comfortable sharing.

Screenshots and recordings are optional. You do not need to disclose a disability. Avoid including passwords, API keys, private resumes, or interview transcripts.

The repository maintainer reviews reports, records confirmed barriers, and tracks fixes through GitHub issues. No fixed response time is promised.

### Contributor expectations

Use semantic elements and visible labels, preserve keyboard access and focus indicators, provide text alternatives for meaningful images, and respect reduced-motion settings. Describe accessibility checks and known gaps when changing an interactive feature.

## Test record

**Recorded:** 19 November 2026. **Application revision:** `7bcba76` before this documentation update.

The [detailed test record](docs/TEST_RECORD.md) separates automated functional checks, targeted browser checks, earlier live integration checks, and work that remains untested.

Targeted checks cover responsive layout, the scroll walkthrough, image loading, account form labels, keyboard focus, reduced motion, and a guest learning dialog. These are limited checks rather than an accessibility certification.

**Assistive-technology testing:** not yet recorded for NVDA, JAWS, VoiceOver, or TalkBack.

When updating this statement, record the date, tested revision, environment, tasks, results, and limitations. Report failures alongside successful checks.
