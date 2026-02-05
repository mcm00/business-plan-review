# Business Plan Review App

A collaborative app for Francisco and wife to review the business plan together, add questions and comments.

## Features

Based on 2026 best practices from trusted sources:

- **Threaded Comments** - Reply to comments and questions
- **Resolve/Reopen** - Track what's been addressed
- **User Switching** - Toggle between Francisco and Wife with colored avatars
- **Section-Specific Feedback** - Attach feedback to specific sections
- **Smart Filtering** - Filter by type, status, or user
- **Notifications** - Get notified when your partner adds feedback
- **Progress Stats** - Track comments, questions, resolved items
- **Responsive Design** - Works great on macOS and iPhone
- **Dark Mode** - Automatic based on system preference
- **PWA Ready** - Add to iPhone home screen for app-like experience

## Quick Start

### 1. Install Dependencies

```bash
cd /Users/franciscocadena/businessplan/app
npm install
```

### 2. Start the Server

```bash
npm start
```

### 3. Open in Browser

- **On your Mac:** http://localhost:3000
- **On your iPhone:** http://<your-mac-ip>:3000

To find your Mac's IP address:
```bash
ipconfig getifaddr en0
```

## Accessing from iPhone

1. Make sure your Mac and iPhone are on the same WiFi network
2. Find your Mac's IP address (run the command above)
3. Open Safari on iPhone and go to `http://<your-mac-ip>:3000`
4. Tap the Share button and "Add to Home Screen" for an app-like experience

## Project Structure

```
app/
├── server.js          # Express.js backend
├── package.json       # Dependencies
├── business_plan.db   # SQLite database (auto-created)
└── public/
    ├── index.html     # Main HTML
    ├── styles.css     # Responsive CSS
    └── app.js         # Frontend JavaScript
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/sections | Get all business plan sections |
| GET | /api/discussions | Get all discussions |
| POST | /api/discussions | Create a new comment/question |
| POST | /api/discussions/:id/replies | Add reply to discussion |
| PATCH | /api/discussions/:id/resolve | Resolve/unresolve discussion |
| GET | /api/notifications/:user | Get notifications for user |
| PATCH | /api/notifications/:user/read-all | Mark all as read |
| GET | /api/stats | Get stats summary |

## Tech Stack

- **Backend:** Node.js + Express.js
- **Database:** SQLite (better-sqlite3)
- **Frontend:** Vanilla HTML/CSS/JS
- **Styling:** Custom CSS with CSS Variables
- **Responsive:** Mobile-first design with safe areas for iPhone notch

## Business Plan Sections

The app comes pre-loaded with your business plan:

1. Executive Summary
2. Business Model Overview
3. Market Focus
4. Ownership Structure
5. Five-Year Success Metrics
6. Investment Summary
7. Company Structure
8. Decision-Making Framework
9. Development Approach
10. Exit Strategy

## Sources

Built using best practices from:
- [Digital Project Manager - Document Collaboration Tools 2026](https://thedigitalprojectmanager.com/tools/document-collaboration-tools/)
- [Filestage - Document Collaboration](https://filestage.io/blog/document-collaboration/)
- [WordPress 6.9 Collaboration Features](https://humanmade.com/wordpress-for-enterprise/wordpress-6-9-the-collaboration-release-that-changes-everything/)
- [Velt - Commenting SDK Use Cases](https://velt.dev/blog/best-commenting-sdk-use-cases)
