# Drafty Chrome Extension

A Chrome extension that provides fantasy football draft insights and analysis on ESPN's fantasy football draft page.

## Features

- **Authentication**: Secure login/signup flow with token-based authentication
- **ESPN Integration**: Automatically detects and enhances ESPN fantasy football draft pages
- **Player Insights**: Click on player rows to get detailed insights and analysis
- **Extensible Architecture**: Easy to add support for other fantasy football platforms
- **Real-time Updates**: Efficiently handles dynamic content loading

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

## Development

### Project Structure

```
drafty-ext/
├── src/
│   ├── types/           # TypeScript interfaces and types
│   ├── services/        # API and storage services
│   ├── parsers/         # Site-specific parsers
│   ├── content.ts       # Content script for ESPN pages
│   ├── popup.ts         # Extension popup logic
│   ├── background.ts    # Background script
│   ├── popup.html       # Popup HTML template
│   └── popup.css        # Popup styles
├── dist/                # Built extension files
├── manifest.json        # Chrome extension manifest
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
└── webpack.config.js    # Build configuration
```

### Available Scripts

- `npm run build` - Build the extension for production
- `npm run dev` - Build in development mode with watch
- `npm run clean` - Clean the dist folder
- `npm run type-check` - Run TypeScript type checking

### Adding New Parsers

The extension is designed to be easily extensible. To add support for a new fantasy football platform:

1. Create a new parser class implementing the `SiteParser` interface:

```typescript
import { SiteParser, PlayerRow, PlayerData } from '../types';

export class NewPlatformParser implements SiteParser {
  name = 'New Platform';

  canParse(url: string): boolean {
    return url.includes('newplatform.com/draft');
  }

  getPlayerRows(): PlayerRow[] {
    // Implement player row detection logic
  }

  async getPlayerData(playerName: string): Promise<PlayerData | null> {
    // Implement player data fetching logic
  }
}
```

2. Register the parser in `src/parsers/parser-manager.ts`:

```typescript
import { NewPlatformParser } from './new-platform-parser';

private registerParsers(): void {
  this.parsers.push(new ESPNParser());
  this.parsers.push(new NewPlatformParser()); // Add your new parser
}
```

3. Update the manifest.json to include the new site in content script matches.

## API Integration

The extension integrates with the Drafty backend API. Configure the API base URL in `src/services/api.ts`:

```typescript
const API_BASE_URL = 'https://api.drafty.com';
```

### Required API Endpoints

- `POST /auth/login` - User authentication
- `POST /auth/signup` - User registration
- `POST /auth/logout` - User logout
- `GET /user/profile` - Get current user profile
- `GET /players/by-name?name={playerName}` - Get player data by name

## Usage

1. **Install and load the extension** (see Installation section)
2. **Click the extension icon** in Chrome's toolbar
3. **Sign up or log in** to your Drafty account
4. **Navigate to ESPN Fantasy Football Draft** page
5. **Click the 📊 button** next to any player to get insights

## Security

- Authentication tokens are stored securely in Chrome's local storage
- All API communication uses HTTPS
- Tokens are automatically validated and refreshed
- No sensitive data is logged or stored insecurely

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details 