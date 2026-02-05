const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== SECURITY CONFIG ==========
// Set these as environment variables on Render for production!
const APP_PASSWORD = process.env.APP_PASSWORD || 'family2026';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// ========== SECURITY MIDDLEWARE ==========

// Helmet - Secure HTTP headers
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false // Allow Google Fonts
}));

// Rate limiting - prevent brute force attacks
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per window
    message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many requests. Please slow down.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting
app.use('/api/login', loginLimiter);
app.use('/api/', apiLimiter);

// ========== SECURITY LOGGING ==========
// Log suspicious activities
const securityLog = [];
const MAX_LOG_SIZE = 1000;

function logSecurityEvent(type, details, req) {
    const event = {
        timestamp: new Date().toISOString(),
        type,
        details,
        ip: req?.ip || req?.connection?.remoteAddress || 'unknown',
        userAgent: req?.headers?.['user-agent'] || 'unknown'
    };
    securityLog.unshift(event);
    if (securityLog.length > MAX_LOG_SIZE) {
        securityLog.pop();
    }
    console.log(`[SECURITY] ${type}: ${JSON.stringify(details)}`);
}

// Simple session store (in-memory)
const sessions = new Map();

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function createSession() {
    const token = generateToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days
    sessions.set(token, { expiresAt });
    return token;
}

function validateSession(token) {
    if (!token) return false;
    const session = sessions.get(token);
    if (!session) return false;
    if (Date.now() > session.expiresAt) {
        sessions.delete(token);
        return false;
    }
    return true;
}

// Timing-safe password comparison to prevent timing attacks
function secureCompare(input, secret) {
    if (typeof input !== 'string' || typeof secret !== 'string') {
        return false;
    }
    const inputBuffer = Buffer.from(input);
    const secretBuffer = Buffer.from(secret);

    // If lengths differ, still do comparison to prevent timing leak
    if (inputBuffer.length !== secretBuffer.length) {
        // Compare with itself to maintain constant time
        crypto.timingSafeEqual(inputBuffer, inputBuffer);
        return false;
    }

    return crypto.timingSafeEqual(inputBuffer, secretBuffer);
}

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || true, // In production, set specific origin
    credentials: true
}));
app.use(cookieParser()); // Parse cookies for httpOnly auth
app.use(express.json({ limit: '10kb' })); // Limit body size

// Auth middleware - protect all routes except login
function requireAuth(req, res, next) {
    // Allow login routes
    if (req.path === '/login' || req.path === '/api/login' || req.path === '/api/verify') {
        return next();
    }

    // Check for token in httpOnly cookie (preferred) or header (fallback)
    const token = req.cookies?.auth_token || req.headers['x-auth-token'];

    if (!validateSession(token)) {
        // For API requests, return 401
        if (req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        // For page requests, serve login page
        return res.sendFile(path.join(__dirname, 'public', 'login.html'));
    }

    // Add user session info to request for logging
    req.sessionToken = token;
    next();
}

app.use(requireAuth);
app.use(express.static(path.join(__dirname, 'public')));

// ========== AUTH ROUTES ==========
app.post('/api/login', (req, res) => {
    const { password } = req.body;

    // Use timing-safe comparison to prevent timing attacks
    if (secureCompare(password || '', APP_PASSWORD)) {
        const token = createSession();

        // Log successful login
        logSecurityEvent('LOGIN_SUCCESS', { message: 'User logged in successfully' }, req);

        // Set httpOnly cookie (more secure - not accessible via JavaScript)
        res.cookie('auth_token', token, {
            httpOnly: true,           // Prevents XSS attacks from stealing token
            secure: process.env.NODE_ENV === 'production', // HTTPS only in production
            sameSite: 'strict',       // Prevents CSRF attacks
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/'
        });

        res.json({ success: true, token });
    } else {
        // Log failed login attempt
        logSecurityEvent('LOGIN_FAILED', { message: 'Invalid password attempt' }, req);

        // Add small random delay to further prevent timing attacks
        setTimeout(() => {
            res.status(401).json({ error: 'Invalid password' });
        }, Math.random() * 100);
    }
});

app.get('/api/verify', (req, res) => {
    const token = req.headers['x-auth-token'] || req.cookies?.auth_token;
    if (validateSession(token)) {
        res.json({ valid: true });
    } else {
        res.status(401).json({ valid: false });
    }
});

app.post('/api/logout', (req, res) => {
    const token = req.headers['x-auth-token'] || req.cookies?.auth_token;
    if (token) {
        sessions.delete(token);
    }

    // Clear the httpOnly cookie
    res.clearCookie('auth_token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    });

    res.json({ success: true });
});

// Security log endpoint (view recent security events)
app.get('/api/security-log', (req, res) => {
    // Only return last 50 events
    res.json(securityLog.slice(0, 50));
});

// ========== JSON FILE DATABASE ==========
const DB_FILE = path.join(__dirname, 'data.json');

function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        }
    } catch (err) {
        console.error('Error loading database:', err);
    }
    return initializeDB();
}

function saveDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function initializeDB() {
    const data = {
        sections: getBusinessPlanSections(),
        discussions: [],
        notifications: [],
        nextId: { discussion: 1, reply: 1, notification: 1 }
    };
    saveDB(data);
    return data;
}

function getBusinessPlanSections() {
    return [
        {
            id: 1,
            title: "Executive Summary",
            level: 1,
            content: `## 1.1 VISION & MISSION

### Vision Statement
Build a portfolio of 3-5 independent subscription SaaS companies solving pain points for small business owners, democratizing AI capabilities to help them compete with larger enterprises, generating $15,000-50,000/month passive income, with exit opportunities valued at $2M-5M+ by 2030.

### Mission Statement
Empower small businesses with AI-powered tools that are affordable, easy to use, and deliver 10x value compared to existing solutions, while building sustainable wealth for our family and creating exit opportunities within 5 years.

### Core Values
- **Customer Obsession:** Build what customers actually need, not what we think is cool
- **Simplicity:** 3 features done perfectly > 30 features done poorly
- **Speed:** Ship weekly, iterate constantly, fail fast
- **Transparency:** Honest pricing, clear communication, authentic brand
- **Family First:** Build business that supports family life, not consumes it`
        },
        {
            id: 2,
            title: "Business Model Overview",
            level: 1,
            content: `### Structure
**Holding Company Model:** One parent LLC owns 3-5 subsidiary LLCs (one per product)

**Why This Structure:**
- Risk isolation (if one product fails, others unaffected)
- Separate exits (sell Company 1 without selling Company 2)
- Clean accounting (P&L per product)
- Easier valuation (buyers can value each independently)
- Tax flexibility (allocate expenses strategically)

### Revenue Model
**B2B/B2C Subscription SaaS**

**Characteristics:**
- Monthly recurring revenue (MRR)
- Month-to-month billing (no long contracts)
- 14-day free trial (no credit card required)
- Self-serve signup (no sales calls)
- Credit card payments (Stripe)

**Pricing Range:**
- **Low-End Products:** $29-39/month (solopreneurs, very small businesses)
- **Mid-Range Products:** $49-69/month (5-25 employee businesses) ← Primary target
- **High-End Products:** $79-99/month (premium features or high ROI)

**Unit Economics Target (Per Product):**
- Customer Acquisition Cost (CAC): $50-150
- Lifetime Value (LTV): $500-1,500 (12-24 month avg retention)
- LTV:CAC Ratio: 5:1 minimum (world-class is 3:1)
- Monthly Churn: <10% (industry average is 5-7%)`
        },
        {
            id: 3,
            title: "Market Focus",
            level: 1,
            content: `**Primary:** Small businesses in United States, 5-25 employees, $250K-2M annual revenue

**Why Small Businesses:**
- Underserved (enterprise tools too complex/expensive)
- Large market (31.7M businesses <50 employees in US)
- Decision-maker accessible (owner/manager, no procurement)
- Willing to pay for time savings ($50-100/month affordable)
- Self-serve buyers (no sales team needed)

**Why NOT Enterprise:**
- Require sales team (expensive, Francisco hates cold outreach)
- Long sales cycles (6-12 months)
- Complex requirements (feature bloat)
- High expectations (24/7 support, SLAs, compliance)
- Risk concentration (lose one customer = lose 20% revenue)

### Go-to-Market Approach
**NO COLD OUTREACH (Critical Constraint)**

**Allowed Channels:**
- ✅ Content marketing (blog posts, YouTube videos)
- ✅ SEO (organic search traffic)
- ✅ Paid ads (Google, Facebook - they come to us)
- ✅ Product Hunt launches
- ✅ App store distribution
- ✅ Reddit/forum participation (helpful, not promotional)
- ✅ Referral programs (customers bring customers)

**Prohibited:**
- ❌ Cold calling
- ❌ Cold emailing
- ❌ LinkedIn cold DMs
- ❌ Door-to-door sales
- ❌ Trade show booths (talking to strangers)`
        },
        {
            id: 4,
            title: "Ownership Structure",
            level: 1,
            content: `### Equity Distribution (All Companies)

| Member | Ownership % | Voting Rights | Role |
|--------|-------------|---------------|------|
| **Ivone** | 51% | Yes (majority control) | Managing Member, WBE Certification, Strategic Decisions, Customer Relations, Support |
| **Francisco** | 39% | Yes | Managing Member, Technology, Product, Development, Operations |
| **Son 1 (Age 17)** | 5% | No (until age 25) | Development Assistant, QA Testing |
| **Son 2 (Age 13)** | 5% | No (until age 25) | Testing, User Feedback |

### Ownership Rationale

**Ivone 51% (Women-Owned Business Qualification):**

**Benefits:**
- **WOSB Certification:** Federal government set-asides for women-owned small businesses
- **WBE Certification:** Corporate vendor diversity programs (Fortune 500s)
- **SBA Loan Priority:** Better terms, higher approval rates
- **Grant Access:** Women entrepreneur grants (state/federal/private)
- **Investor Appeal:** Some VCs prioritize women-owned (if we ever raise)

**Francisco 39% (Primary Operator):**
- Builds products (40+ hours/week Year 1-2)
- Makes all technical decisions
- Day-to-day operations
- Largest time investment (sweat equity)

**Sons 5% Each (Future Incentive):**
- Learning experience (entrepreneurship education)
- Skin in the game (when old enough to help)
- Generational wealth (if companies succeed)
- No voting until age 25 (avoid immature decisions)`
        },
        {
            id: 5,
            title: "Five-Year Success Metrics",
            level: 1,
            content: `### Year 1 (2026): Foundation & Launch

**Company 1:**
- ✅ MVP launched (Month 6)
- ✅ 30-50 paying customers (Month 12)
- ✅ $1,500-3,000 MRR (end of year)
- ✅ Product-market fit validated (>50% trial-to-paid conversion)
- ✅ NPS >40 (customers would recommend)

**Business:**
- ✅ LLC formed, all compliance complete
- ✅ WBE certification obtained
- ✅ Revenue: $6,000-12,000 (second half of year)
- ✅ Expenses: $18,000-22,000
- ✅ Net: -$6,000 to -$16,000 (expected loss)

### Year 2 (2027): Scale Company 1, Launch Company 2

**Company 1:**
- ✅ 100-150 customers
- ✅ $5,000-9,000 MRR
- ✅ Revenue: $60,000-108,000
- ✅ Profitability achieved (Month 18-20)

**Company 2:**
- ✅ MVP launched (Month 18)
- ✅ 15-30 customers (end of Year 2)
- ✅ $750-1,500 MRR

### Year 3 (2028): Profitability & Company 3 Launch

**Business:**
- ✅ Combined MRR: $18,000-29,500
- ✅ Combined Revenue: $216,000-354,000
- ✅ Net Profit: $156,000-274,000
- ✅ Francisco QUITS full-time job (Month 30-36)

### Year 4 (2029): Optimization & Scale

**Business:**
- ✅ Combined MRR: $39,500-60,000
- ✅ Combined Revenue: $474,000-720,000
- ✅ Net Profit: $354,000-540,000

### Year 5 (2030): Exit Preparation

**Business:**
- ✅ Combined MRR: $55,000-87,000
- ✅ Combined Revenue: $660,000-1,044,000
- ✅ Valuation (5-8x EBITDA): $2.25M-6M

**Exit Options:**
1. **Sell Portfolio:** $2.5M-6M (all three companies together)
2. **Sell Company 1:** $1.5M-3.2M (largest, most mature)
3. **Keep & Harvest:** $40K-65K/month passive income
4. **Partial Exit:** Sell Company 1, keep 2 & 3 (diversify)`
        },
        {
            id: 6,
            title: "Investment Summary",
            level: 1,
            content: `### Total Capital Required

**Year 1 Cash Needs:**
- Infrastructure/subscriptions: $18,000 ($1,500/month × 12)
- Marketing (Months 6-12): $3,000-4,000 ($500/month × 6-8)
- **Total:** $21,000-22,000

**Funding Sources:**

| Source | Amount | Terms |
|--------|--------|-------|
| **Small Business Loan** | $15,000-20,000 | 5-year term, 6-12% interest |
| **Francisco Cash Contribution** | $5,000-7,000 | Owner capital |
| **Total Cash** | $20,000-27,000 | |

**Non-Cash Contributions:**

| Source | Amount | Type |
|--------|--------|------|
| **Francisco Equipment** | $7,500 | Homelab servers, computers, network gear |
| **Francisco Sweat Equity (Year 1)** | $288,000 | 1,920 hours × $150/hour |
| **Ivone Sweat Equity (Year 1)** | $62,400 | 624 hours × $100/hour |

### Return on Investment (ROI) Projections

| Year | Revenue | Net Profit | Cash ROI |
|------|---------|------------|----------|
| 1 | $6K-12K | -$12K to -$16K | Negative (investment year) |
| 2 | $69K-126K | $29K-$86K | 85%-350% |
| 3 | $216K-354K | $156K-$274K | 865%-1,720% |
| 4 | $474K-720K | $354K-$540K | 2,635%-4,420% |
| 5 | $660K-1,044K | $480K-$784K | 5,000%-8,350% |

**Exit ROI (Year 5):**
- Investment: $20,000-27,000
- Exit Value: $2.25M-6M
- **ROI: 11,250%-30,000%**`
        },
        {
            id: 7,
            title: "Company Structure",
            level: 1,
            content: `### Parent Company (Holding Company)

**Name:** [Last Name] Tech Holdings LLC
**Type:** Georgia Limited Liability Company (LLC)
**Tax Classification:** Multi-Member Partnership (default)
**Fiscal Year:** January 1 - December 31
**Formation Date:** February 2026

### Formation Process

**Week 1 Actions:**
1. ✅ Choose registered agent service (Northwest Registered Agent - $125/year)
2. ✅ Register LLC with Georgia Secretary of State ($100)
3. ✅ Obtain EIN (Employer Identification Number) - Free
4. ✅ Open business bank account (Relay - free)
5. ✅ Apply for business credit card (Capital One Spark Cash)

### Subsidiary Companies (Future)

**Company 1:** [To be named] LLC - Formation Month 4-5
**Company 2:** [To be named] LLC - Formation Month 16-18
**Company 3:** [To be named] LLC - Formation Month 28-30

**Why Separate LLCs for Each Product:**

**Legal Protection:**
- If Company 1 gets sued, Companies 2-3 protected
- Liability isolated to specific product

**Financial Clarity:**
- Separate P&L for each product
- Easy to see which products are profitable

**Exit Flexibility:**
- Sell Company 1 individually without affecting 2-3
- Different buyers for different products`
        },
        {
            id: 8,
            title: "Decision-Making Framework",
            level: 1,
            content: `### Authority Levels

**Francisco (Sole Authority):**
- Technology stack choices
- Development priorities
- Tool/software purchases <$1,000/month
- Hiring contractors (within budget)
- Code deployment decisions
- Infrastructure decisions

**Ivone (Sole Authority):**
- Customer communication standards
- Marketing message approval
- Support policies
- Community engagement approach

**Joint Approval (Both Required):**
- Pricing changes
- Major features (>40 hours development)
- Marketing budget >$500/month
- Contracts >$5,000
- Partnerships/integrations
- Employee hiring

**Supermajority (75%+ Required):**
- Selling any company
- Dissolving LLC
- Loans >$50,000
- Changing ownership structure
- Adding new members
- Major pivots (changing target market/product)

### Protection Against Deadlock
- If cannot agree on major decision: 30-day mediation
- If still unresolved: Binding arbitration
- Arbitrator selected jointly
- Decision is final`
        },
        {
            id: 9,
            title: "Development Approach",
            level: 1,
            content: `### AI-First Development (90% AI-Generated Code)

**Process:**
- Francisco designs architecture (10-15 hours/week)
- AI (Claude via Cursor IDE) generates code (90% of lines)
- Francisco reviews/refines (10-20 hours/week)
- Son assists with testing (5-10 hours/week)
- Ship MVP in 8 weeks

**Why This Works:**
- 10x faster than traditional development
- No need to hire developers ($100K+/year saved)
- Francisco's 28 years experience guides AI effectively
- Quality remains high (human oversight critical)

### Tech Stack

**Frontend:**
- React or Vue.js
- TailwindCSS for styling
- Vercel for hosting

**Backend:**
- Node.js / Express
- PostgreSQL or Supabase
- Stripe for payments

**Infrastructure:**
- Vercel for deployment
- GitHub for version control
- Sentry for error monitoring`
        },
        {
            id: 10,
            title: "Exit Strategy",
            level: 1,
            content: `### Timeline: 2029-2030 (Years 4-5)

**Options:**
1. **Sell Individual Companies:** $500K-2M each (5-10x ARR for profitable SaaS)
2. **Sell Portfolio:** $2M-5M+ (premium for diversified revenue)
3. **Keep & Harvest:** $30K-50K/month passive income (if no good offers)

### Target Buyers

- Private equity firms (buying profitable SMB SaaS)
- Strategic acquirers (competitors, adjacent companies)
- Individual buyers (via MicroAcquire, Acquire.com)
- Holding companies (aggregating related products)

### Valuation Metrics

**SaaS Valuation Formula:**
- Revenue Multiple: 3-8x ARR (depending on growth rate)
- EBITDA Multiple: 5-10x (for profitable companies)

**What Increases Valuation:**
- Low churn (<5% monthly)
- High growth (>50% YoY)
- Diversified customer base
- Recurring revenue
- Strong unit economics

**Preparation for Exit:**
- Clean financials (3 years of books)
- Documented processes
- Minimal owner dependency
- Growth trajectory maintained`
        }
    ];
}

// Load database
let db = loadDB();

// ========== API ROUTES ==========

// Get all sections
app.get('/api/sections', (req, res) => {
    res.json(db.sections);
});

// Get section by ID
app.get('/api/sections/:id', (req, res) => {
    const section = db.sections.find(s => s.id === parseInt(req.params.id));
    if (!section) return res.status(404).json({ error: 'Section not found' });
    res.json(section);
});

// Update section
app.put('/api/sections/:id', (req, res) => {
    const { title, content } = req.body;
    const section = db.sections.find(s => s.id === parseInt(req.params.id));
    if (section) {
        section.title = title;
        section.content = content;
        section.updated_at = new Date().toISOString();
        saveDB(db);
    }
    res.json({ success: true });
});

// Get all discussions
app.get('/api/discussions', (req, res) => {
    const discussions = db.discussions.map(d => {
        const section = db.sections.find(s => s.id === d.section_id);
        return { ...d, section_title: section ? section.title : null };
    });
    res.json(discussions);
});

// Get discussions for a section
app.get('/api/sections/:id/discussions', (req, res) => {
    const discussions = db.discussions.filter(d => d.section_id === parseInt(req.params.id));
    res.json(discussions);
});

// Create discussion
app.post('/api/discussions', (req, res) => {
    const { section_id, type, text, author } = req.body;

    const discussion = {
        id: db.nextId.discussion++,
        section_id: section_id ? parseInt(section_id) : null,
        type,
        text,
        author,
        resolved: false,
        resolved_by: null,
        resolved_at: null,
        created_at: new Date().toISOString(),
        replies: []
    };

    db.discussions.push(discussion);

    // Create notification for the other user
    const otherUser = author === 'Francisco' ? 'Wife' : 'Francisco';
    db.notifications.push({
        id: db.nextId.notification++,
        user: otherUser,
        type,
        message: `${author} added a ${type}`,
        discussion_id: discussion.id,
        read: false,
        created_at: new Date().toISOString()
    });

    saveDB(db);
    res.json({ id: discussion.id, success: true });
});

// Add reply to discussion
app.post('/api/discussions/:id/replies', (req, res) => {
    const { text, author } = req.body;
    const discussion = db.discussions.find(d => d.id === parseInt(req.params.id));

    if (discussion) {
        const reply = {
            id: db.nextId.reply++,
            text,
            author,
            created_at: new Date().toISOString()
        };
        discussion.replies.push(reply);

        // Notify both users (except the replier)
        ['Francisco', 'Wife'].filter(u => u !== author).forEach(user => {
            db.notifications.push({
                id: db.nextId.notification++,
                user,
                type: 'reply',
                message: `${author} replied to a discussion`,
                discussion_id: discussion.id,
                read: false,
                created_at: new Date().toISOString()
            });
        });

        saveDB(db);
        res.json({ id: reply.id, success: true });
    } else {
        res.status(404).json({ error: 'Discussion not found' });
    }
});

// Resolve/unresolve discussion
app.patch('/api/discussions/:id/resolve', (req, res) => {
    const { resolved, resolved_by } = req.body;
    const discussion = db.discussions.find(d => d.id === parseInt(req.params.id));

    if (discussion) {
        discussion.resolved = resolved;
        discussion.resolved_by = resolved ? resolved_by : null;
        discussion.resolved_at = resolved ? new Date().toISOString() : null;
        saveDB(db);
    }

    res.json({ success: true });
});

// Delete discussion
app.delete('/api/discussions/:id', (req, res) => {
    db.discussions = db.discussions.filter(d => d.id !== parseInt(req.params.id));
    saveDB(db);
    res.json({ success: true });
});

// Get notifications for user
app.get('/api/notifications/:user', (req, res) => {
    const notifications = db.notifications
        .filter(n => n.user === req.params.user)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 50);
    res.json(notifications);
});

// Mark notification as read
app.patch('/api/notifications/:id/read', (req, res) => {
    const notification = db.notifications.find(n => n.id === parseInt(req.params.id));
    if (notification) {
        notification.read = true;
        saveDB(db);
    }
    res.json({ success: true });
});

// Mark all notifications as read for user
app.patch('/api/notifications/:user/read-all', (req, res) => {
    db.notifications.filter(n => n.user === req.params.user).forEach(n => n.read = true);
    saveDB(db);
    res.json({ success: true });
});

// Get stats
app.get('/api/stats', (req, res) => {
    const stats = {
        totalSections: db.sections.length,
        totalComments: db.discussions.filter(d => d.type === 'comment').length,
        totalQuestions: db.discussions.filter(d => d.type === 'question').length,
        resolved: db.discussions.filter(d => d.resolved).length,
        pending: db.discussions.filter(d => !d.resolved).length,
        franciscoItems: db.discussions.filter(d => d.author === 'Francisco').length,
        wifeItems: db.discussions.filter(d => d.author === 'Wife').length
    };
    res.json(stats);
});

// Serve the main app
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get local IP address
function getLocalIP() {
    const interfaces = require('os').networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Start server
app.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║     🔐 Business Plan Review App (Password Protected)          ║
║                                                               ║
║     Server running!                                           ║
║                                                               ║
║     📱 Access the app:                                        ║
║        • Mac:    http://localhost:${PORT}                       ║
║        • iPhone: http://${localIP}:${PORT}                    ║
║                                                               ║
║     🔑 Default password: family2026                           ║
║        (Change via APP_PASSWORD env var)                      ║
║                                                               ║
║     Press Ctrl+C to stop                                      ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
});
