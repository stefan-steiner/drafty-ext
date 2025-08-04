# Drafty Chrome Extension

A Chrome extension that provides fantasy football draft insights and analysis within ESPN, Sleeper and Yahoo.

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Setup

1. **Install dependencies**:

   ```bash
   cd drafty-ext
   npm install
   ```

2. **Build the extension**:

   ```bash
   npm run build
   ```

3. **Load in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" in the top right
   - Click "Load unpacked" and select the `dist` folder from this project

## Privacy & Data

This extension collects minimal data necessary to provide fantasy football draft insights:

- **Account Information**: Email address for authentication
- **Fantasy Football Data**: Player names and draft information from supported platforms
- **Usage Analytics**: Basic usage data to improve functionality

**We do not collect:**

- Personal information beyond email
- Financial information
- Browsing history outside fantasy football sites
- Location data

For complete details, see our [Privacy Policy](PRIVACY_POLICY.md).

## Supported Platforms

- ESPN Fantasy Football
- Yahoo Fantasy Football
- Sleeper Fantasy Football

## Features

- Real-time player insights during drafts
- Pick assistant recommendations
- Integration with major fantasy football platforms
- Secure authentication and data handling
