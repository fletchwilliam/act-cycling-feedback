# ACT Cycling Feedback Tool

## Project Overview

The ACT Cycling Feedback Tool is a browser-based interactive map application designed to visualize cycling infrastructure data and collect georeferenced feedback from the public. The tool enables better-informed advocacy decisions by sourcing structured feedback from the population about cycling paths, lanes, and related infrastructure in the Australian Capital Territory.

### Core Purpose
- **Primary Use Case**: Sourcing feedback from the public to inform cycling advocacy decisions
- **Data Sources**: ACT Government Open Data Portal (ArcGIS Feature Services)
- **Technology**: Single-file HTML application using Leaflet.js

### Key Capabilities
1. Visualize Community Path Assets and On-Road Cycle Lane Assets
2. Load and display custom GeoJSON layers (crossings, bike racks, etc.)
3. Filter data by multiple attributes with real-time updates
4. Color-code features by any categorical field
5. Select areas and analyze infrastructure statistics
6. Collect georeferenced feedback with ratings and categories
7. Export feedback as GeoJSON for aggregation and analysis

---

## Technical Architecture

### Technology Stack
| Component | Technology | Version/Source |
|-----------|------------|----------------|
| Mapping | Leaflet.js | 1.9.4 (CDN) |
| Basemaps | OpenStreetMap, CartoDB, Esri, OpenTopoMap | Various |
| Data Format | GeoJSON | RFC 7946 |
| Styling | Inline CSS | N/A |
| Runtime | Browser JavaScript | ES6+ |

### File Structure
The entire application is contained in a single HTML file (`canberra_cycling_map.html`, approximately 3,700 lines) which includes:
- HTML structure
- CSS styles (inline `<style>` block)
- JavaScript application logic (inline `<script>` block)

### Data Flow
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GeoJSON Files  │────▶│  Browser/Leaflet │────▶│  Map Display    │
│  (User Upload)  │     │  (Client-side)   │     │  (Interactive)  │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │ Feedback GeoJSON │
                        │   (Download)     │
                        └──────────────────┘
```

### Browser Compatibility
The application uses standard ES6+ JavaScript and should work in all modern browsers:
- **Tested**: Safari (macOS), Chrome, Firefox
- **Expected Compatible**: Edge, Opera, and other Chromium-based browsers
- **Not Supported**: Internet Explorer

**Note**: Performance may vary with large datasets. The application has been designed to handle GeoJSON files up to 100MB, though optimal performance is achieved with files under 50MB.

---

## Feature Documentation

### 1. Core Data Layers

#### Community Path Assets
- **Source**: ACT Government ArcGIS Feature Service
- **Geometry**: LineString/MultiLineString
- **Key Attributes**: ASSET_TYPE, ASSET_SUB_TYPE, PATH_SURFACE, SUBURB, AVERAGE_WIDTH, PATH_LENGTH, TRAVEL_DIRECTION, TRAVEL_RESTRICTION, OWNERSHIP
- **Default Styling**: Color-coded by ASSET_SUB_TYPE (Cyclepath, Separated Cyclepath, Footpath, Shared Path)

#### On-Road Cycle Lane Assets
- **Source**: ACT Government ArcGIS Feature Service
- **Geometry**: LineString/MultiLineString
- **Key Attributes**: ASSET_TYPE, ASSET_SUB_TYPE, SURFACE_TYPE, ROAD_LOCATION_TYPE
- **Default Styling**: Color-coded by ASSET_SUB_TYPE (Green Pavement Paint, Standard Pavement)

### 2. Custom Layers
Users can add unlimited custom GeoJSON layers with:
- Preset configurations (Crossings, Bike Racks, Traffic Lights)
- Custom color selection
- Automatic geometry type detection (Point, Line, Polygon)
- Per-layer visibility toggle, zoom-to-extent, and removal

### 3. Filtering System
- **Categorical Filters**: Auto-generated checkboxes for fields with 2-50 unique values
- **Numeric Filters**: Range inputs (min/max) for numeric fields
- **Real-time Updates**: Map and statistics update immediately when filters change
- **Per-Layer Filtering**: Each dataset has independent filter controls
- **Color-by-Field**: Any categorical field can be used to color features with custom color pickers

### 4. Area Selection & Analysis
- **Selection Tool**: Draw rectangle to select features
- **Analysis Panel**: Shows selected feature counts, total lengths, breakdowns by type/surface/suburb
- **Export**: Download selected features as CSV

### 5. Feedback System
- **Selection**: Click within 50m of any path to select location (snaps to nearest path)
- **Rating**: Binary good (👍) or bad (👎)
- **Categories**: Surface Quality, Safety Concern, Lighting, Other
- **Optional Fields**: Comment, Name, Email
- **Output**: Downloads GeoJSON file containing feedback point with all metadata
- **Loading**: Dedicated "Load Feedback" section to import feedback GeoJSON files
- **Feedback Filtering**: Filter loaded feedback by rating and category

### 6. Layer Styling
- **Basemap Options**: Streets, Light, Dark, Satellite, Terrain, None
- **Quick Presets**: Default, High Contrast, Subtle, Thick Lines, Thin Lines, Neon
- **Per-Layer Customization**: Color, width, opacity, dash pattern, line cap, line join

---

## Strengths

### Technical Strengths
1. **Zero Dependencies on Backend**: Entire application runs client-side; no server required for basic operation
2. **Single-File Deployment**: Easy to distribute, host, or run locally
3. **Offline Capable**: Once loaded, works without internet (except basemap tiles)
4. **No Build Process**: Plain HTML/CSS/JS requires no compilation or bundling
5. **Standard Data Formats**: Uses GeoJSON, which is widely supported and human-readable
6. **Responsive Filtering**: Real-time updates provide immediate visual feedback
7. **Flexible Color Coding**: Any categorical field can be used for visualization

### User Experience Strengths
1. **Low Barrier to Entry**: Users only need a web browser
2. **Intuitive Feedback Flow**: Simple thumbs up/down with guided form
3. **Generous Click Tolerance**: 50m tolerance eliminates frustration with precise clicking
4. **Structured Feedback Data**: Consistent GeoJSON output enables easy aggregation
5. **Multiple Basemap Options**: Users can choose visualization that suits their needs
6. **Collapsible Panels**: Keeps interface clean while providing access to advanced features

### Data Management Strengths
1. **Privacy-Preserving**: All processing happens locally; no data sent to external servers
2. **Portable Feedback**: GeoJSON files can be shared via any method (email, cloud storage, etc.)
3. **Aggregatable**: Multiple feedback files can be loaded simultaneously
4. **Filterable Feedback**: Can isolate good/bad ratings or specific categories

---

## Weaknesses

### Technical Weaknesses
1. **Large File Size**: Single 3,700-line file is difficult to maintain and navigate
2. **No Code Modularity**: All JavaScript in one scope makes testing and reuse difficult
3. **Memory Usage**: Large datasets (approaching 100MB) may cause performance issues on lower-spec devices
4. **No Data Persistence**: Refreshing the page loses all loaded data and state
5. **Limited Error Handling**: Some edge cases may produce unclear errors
6. **No Automated Testing**: No test suite to catch regressions
7. **Inline Styles**: CSS is not easily themeable or maintainable

### User Experience Weaknesses
1. **Manual Data Loading**: Users must download GeoJSON files from ACT Open Data separately
2. **No Feedback Submission**: Users must manually manage feedback file delivery
3. **No Mobile Optimization**: Interface works but is not optimized for small screens
4. **No Undo for Feedback**: Accidentally closing the panel loses entered data
5. **No Progress Indicators**: Large file loading provides no feedback until complete

### Data Management Weaknesses
1. **No Data Validation**: Invalid GeoJSON files may cause silent failures
2. **No Duplicate Detection**: Same feedback can be loaded multiple times
3. **No Feedback Editing**: Cannot modify feedback after download
4. **Manual Aggregation Required**: No built-in way to merge multiple feedback files

---

## Suggestions

### Simplification of Code

#### High Priority
1. **Modularize JavaScript**: Split into separate files/modules:
   - `map-core.js` - Map initialization and basemap handling
   - `layers.js` - Layer loading, styling, and management
   - `filters.js` - Filter panel and filter logic
   - `feedback.js` - Feedback system
   - `analysis.js` - Area selection and statistics
   - `utils.js` - Shared utility functions

2. **Extract CSS**: Move styles to separate `styles.css` file with organized sections

3. **Use Configuration Object**: Centralize magic numbers and settings:
   ```javascript
   const CONFIG = {
       CLICK_TOLERANCE_METERS: 50,
       MAX_FILTER_VALUES: 50,
       DEFAULT_MAP_CENTER: [-35.2809, 149.1300],
       DEFAULT_ZOOM: 12,
       COLOR_PALETTE: [...],
   };
   ```

4. **Reduce Duplication**: Several functions have repeated patterns:
   - Layer creation for paths/lanes/custom could share more code
   - Filter building has repetitive HTML generation
   - Style application has similar logic across layer types

#### Medium Priority
5. **Implement State Management**: Create a central state object to track:
   - Loaded layers and their visibility
   - Current filters
   - Selection state
   - Feedback form state

6. **Use Template Literals More Consistently**: Some HTML is built with concatenation, some with templates

7. **Add JSDoc Comments**: Document function parameters and return values

8. **Remove Dead Code**: Audit for any unused functions from removed features

#### Low Priority
9. **Consider a Build Process**: If the codebase grows, tools like Vite or esbuild could:
   - Bundle modules
   - Minify output
   - Add TypeScript support

10. **Use CSS Custom Properties**: Enable easier theming:
    ```css
    :root {
        --primary-color: #4CAF50;
        --panel-bg: white;
        --text-color: #333;
    }
    ```

### Possible Feature Additions

#### High Value / Lower Effort
1. **Auto-Load ACT Data**: Add buttons to fetch directly from ACT ArcGIS endpoints (requires CORS handling or proxy)

2. **Local Storage Persistence**: Save loaded layer references and filter state to localStorage

3. **Feedback Preview on Map**: Show feedback point on map before downloading

4. **Bulk Feedback Export**: Combine all loaded feedback into single downloadable file

5. **Search/Geocoding**: Add address search to quickly navigate to locations

6. **URL Parameters**: Allow sharing links with specific view state (center, zoom, visible layers)

#### High Value / Higher Effort
7. **Image Attachments** (Previously Discussed):
   - Allow photos up to 10MB
   - Compress/resize on client-side before embedding
   - Consider separate image hosting with URL reference in GeoJSON

8. **Direct Feedback Submission** (Previously Discussed):
   - Backend API to receive feedback
   - Database storage (PostgreSQL with PostGIS)
   - Admin interface to review/export feedback

9. **Mobile-Optimized Interface**:
   - Responsive layout for phones/tablets
   - Touch-friendly controls
   - GPS location integration

10. **Offline Basemap Support**: Cache map tiles for fully offline operation

11. **Route Planning**: Calculate routes between points using path network

12. **Comparative Analysis**: Side-by-side comparison of different areas or time periods

#### Community Features
13. **Upvote/Downvote Existing Feedback**: Allow users to support others' feedback

14. **Heatmap Visualization**: Show density of feedback or ratings

15. **Time-Based Filtering**: Filter feedback by submission date

---

## Deployment Options

### Option 1: Static File Hosting (Free - Low Cost)

#### GitHub Pages (Free)
- **Cost**: $0
- **Setup**: Push HTML file to GitHub repository, enable Pages
- **URL**: `https://username.github.io/repository-name/`
- **Pros**: Free, automatic HTTPS, version control integration
- **Cons**: Public repository required for free tier, 1GB storage limit
- **Best For**: Open-source advocacy projects

#### Netlify (Free Tier)
- **Cost**: $0 (free tier) / $19/month (pro)
- **Setup**: Drag-and-drop deploy or Git integration
- **URL**: `https://project-name.netlify.app/` or custom domain
- **Pros**: Free SSL, global CDN, form handling (100 submissions/month free)
- **Cons**: 100GB bandwidth/month on free tier
- **Best For**: Quick deployment with potential for growth

#### Cloudflare Pages (Free)
- **Cost**: $0
- **Setup**: Git integration or direct upload
- **URL**: `https://project-name.pages.dev/` or custom domain
- **Pros**: Unlimited bandwidth, fast global CDN, free SSL
- **Cons**: Build minutes limited (but not relevant for static HTML)
- **Best For**: High-traffic public tools

#### Vercel (Free Tier)
- **Cost**: $0 (hobby) / $20/month (pro)
- **Setup**: Git integration
- **URL**: `https://project-name.vercel.app/`
- **Pros**: Excellent performance, easy deployment
- **Cons**: Commercial use requires pro plan
- **Best For**: Developer-focused projects

### Option 2: Cloud Storage Static Hosting (Low Cost)

#### AWS S3 + CloudFront
- **Cost**: ~$1-5/month for moderate traffic
- **Setup**: Create S3 bucket, enable static hosting, optional CloudFront CDN
- **Pros**: Highly scalable, pay-per-use, professional infrastructure
- **Cons**: More complex setup, AWS knowledge required
- **Best For**: Organizations with AWS experience

#### Google Cloud Storage
- **Cost**: ~$1-5/month for moderate traffic
- **Setup**: Create bucket, configure for web hosting
- **Pros**: Integrates with Google ecosystem, reliable
- **Cons**: Requires Google Cloud account setup
- **Best For**: Organizations already using Google Cloud

#### Azure Blob Storage
- **Cost**: ~$1-5/month for moderate traffic
- **Setup**: Create storage account, enable static website
- **Pros**: Enterprise-grade, integrates with Microsoft ecosystem
- **Cons**: More complex than simple static hosts
- **Best For**: Government/enterprise with Azure presence

### Option 3: Full Backend Deployment (For Direct Feedback Submission)

If implementing direct feedback submission without GeoJSON download:

#### Minimal Backend (Low Cost)
- **Stack**: Node.js/Express or Python/Flask + SQLite
- **Hosting**: Railway, Render, or Fly.io
- **Cost**: $5-20/month
- **Pros**: Simple, low maintenance
- **Cons**: Limited scalability

#### Production Backend (Medium Cost)
- **Stack**: Node.js or Python + PostgreSQL/PostGIS
- **Hosting**: DigitalOcean, Linode, or AWS
- **Cost**: $20-100/month
- **Pros**: Full control, scalable, spatial queries
- **Cons**: Requires ongoing maintenance

#### Serverless Backend (Variable Cost)
- **Stack**: AWS Lambda + API Gateway + DynamoDB
- **Cost**: Pay-per-request (~$0 for low traffic, scales with usage)
- **Pros**: No server management, auto-scaling
- **Cons**: More complex architecture, vendor lock-in

### Deployment Recommendation

For initial public deployment focused on collecting feedback:

**Recommended: Cloudflare Pages (Free)**
1. Zero cost
2. Unlimited bandwidth handles viral sharing
3. Global CDN ensures fast loading across Australia
4. Simple custom domain setup
5. Easy updates via Git or dashboard upload

**Migration Path:**
1. **Phase 1**: Deploy static HTML to Cloudflare Pages
2. **Phase 2**: Add Cloudflare Workers for feedback API ($5/month for paid tier)
3. **Phase 3**: Add database (PlanetScale free tier or Cloudflare D1) for feedback storage

---

## Feedback Collection Strategy for Broader Population

### Distribution Methods

1. **Direct Link Sharing**
   - Share URL via social media, cycling groups, community forums
   - QR codes on physical signage at key cycling locations

2. **Embedded in Existing Websites**
   - Iframe embed on advocacy group websites
   - Local council community engagement pages

3. **Email Campaigns**
   - Cycling club newsletters
   - Local community group mailing lists

### Feedback Aggregation Workflow

#### Current (Manual) Process
```
User submits feedback → Downloads GeoJSON → Emails/uploads file → 
Admin collects files → Loads into tool → Analyzes patterns
```

#### Recommended Improvements
1. **Shared Cloud Folder**: Provide Dropbox/Google Drive link for feedback uploads
2. **Feedback Merge Script**: Simple script to combine multiple GeoJSON files:
   ```bash
   # Example using jq
   jq -s '{ type: "FeatureCollection", features: [.[].features[]] }' *.geojson > merged.geojson
   ```
3. **Regular Analysis Reports**: Weekly/monthly summaries of feedback patterns

### Maximizing Response Quality

1. **Clear Instructions**: Add help text explaining what makes useful feedback
2. **Example Feedback**: Show sample submissions demonstrating good detail
3. **Feedback Confirmation**: Visual confirmation that feedback was saved
4. **Progress Tracking**: Public dashboard showing total feedback received

---

## Data Sources Reference

### ACT Government Open Data Portal

**Community Path Assets**
- Portal: https://www.data.act.gov.au/
- Service: ArcGIS Feature Service
- Endpoint: `https://services1.arcgis.com/E5n4f1VY84i0xSjy/arcgis/rest/services/ACTGOV_Community_Path_Assets/FeatureServer/1/query`
- Note: API returns paginated results; full dataset requires multiple requests or increased limit

**On Road Cycle Lane Assets**
- Service: ArcGIS Feature Service
- Endpoint: `https://services1.arcgis.com/E5n4f1VY84i0xSjy/arcgis/rest/services/ACTGOV_On_Road_Cycle_Lane_Assets/FeatureServer/1/query`

### Query Parameters for Full Data Download
```
?where=1%3D1
&outFields=*
&f=geojson
&resultRecordCount=100000
```

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-15 | 1.0 | Initial development including: map visualization, filtering, area selection, feedback system, layer styling |

---

## Future Development Notes

### Deferred Features (For Future Implementation)

1. **Image Attachments**
   - Challenge: Modern smartphone images are 5-10MB+
   - Approach: Client-side compression using Canvas API or library like browser-image-compression
   - Storage: Either embed compressed base64 or upload to object storage with URL reference

2. **Direct Feedback Submission**
   - Eliminates need for file download/email workflow
   - Requires backend API and database
   - Consider: Rate limiting, spam prevention, moderation workflow

3. **Mobile Companion App**
   - **Concept**: Native mobile app that uses device GPS to automatically link feedback to nearest path
   - **Key Features**:
     - Capture photo directly in app
     - Auto-extract GPS coordinates from device location (more accurate than photo EXIF)
     - Snap location to nearest path segment using same 50m tolerance logic
     - Add rating (good/bad) and category selection
     - Optional comment field
     - Submit directly to backend or export as GeoJSON
   - **Technical Approach**:
     - Cross-platform: React Native or Flutter for iOS/Android from single codebase
     - Offline capability: Cache path network data for GPS snapping without connectivity
     - Background location: Option to record GPS track while cycling for route-based feedback
     - Photo handling: Compress images on-device before upload (target 500KB-1MB)
   - **Advantages over Web Interface**:
     - Real-time GPS eliminates need to manually click on map
     - Camera integration is seamless
     - Can submit feedback while on the path (not just after returning home)
     - Push notifications for feedback status or community updates
   - **Integration with Web Tool**:
     - Same backend API serves both web and mobile
     - Feedback from mobile appears identically in web tool
     - Web tool remains primary interface for analysis and administration
   - **Development Estimate**: Medium-high effort (4-8 weeks for basic version)

### Technical Debt to Address

1. Single-file architecture limits maintainability
2. No automated testing suite
3. Error handling could be more robust
4. Performance optimization needed for 100MB+ files

---

## Contact & Contribution

This tool was developed to support cycling advocacy in the ACT. For questions, suggestions, or contributions, feedback can be submitted through the tool itself or via the distribution channels established for the project.

---

*Documentation generated: January 15, 2026*
*Tool Version: 1.0*
