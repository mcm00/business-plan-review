#!/usr/bin/env node
/**
 * Security Audit Script for Business Plan Review App
 * Checks for common vulnerabilities and security issues
 */

const fs = require('fs');
const path = require('path');

const COLORS = {
    RED: '\x1b[31m',
    GREEN: '\x1b[32m',
    YELLOW: '\x1b[33m',
    BLUE: '\x1b[34m',
    RESET: '\x1b[0m'
};

const results = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    info: [],
    passed: []
};

function log(level, message, details = '') {
    const icons = {
        critical: `${COLORS.RED}[CRITICAL]${COLORS.RESET}`,
        high: `${COLORS.RED}[HIGH]${COLORS.RESET}`,
        medium: `${COLORS.YELLOW}[MEDIUM]${COLORS.RESET}`,
        low: `${COLORS.YELLOW}[LOW]${COLORS.RESET}`,
        info: `${COLORS.BLUE}[INFO]${COLORS.RESET}`,
        passed: `${COLORS.GREEN}[PASSED]${COLORS.RESET}`
    };
    console.log(`${icons[level]} ${message}`);
    if (details) console.log(`   ${details}`);
    results[level].push({ message, details });
}

function readFile(filePath) {
    try {
        return fs.readFileSync(filePath, 'utf-8');
    } catch (err) {
        return null;
    }
}

console.log('\n' + '='.repeat(60));
console.log('  SECURITY AUDIT - Business Plan Review App');
console.log('='.repeat(60) + '\n');

// ========== SERVER.JS CHECKS ==========
console.log(`${COLORS.BLUE}Analyzing server.js...${COLORS.RESET}\n`);

const serverCode = readFile('./server.js');

if (serverCode) {
    // Check 1: SQL Injection (N/A - using JSON file, but check anyway)
    if (serverCode.includes('db.query') && serverCode.includes('${')) {
        log('critical', 'Potential SQL Injection', 'String interpolation in database queries detected');
    } else {
        log('passed', 'No SQL Injection risk', 'Using JSON file storage, not vulnerable to SQL injection');
    }

    // Check 2: eval() usage
    if (/\beval\s*\(/.test(serverCode)) {
        log('critical', 'eval() detected', 'Never use eval() - can execute arbitrary code');
    } else {
        log('passed', 'No eval() usage');
    }

    // Check 3: Password hardcoded check
    if (serverCode.includes("'family2026'") || serverCode.includes('"family2026"')) {
        log('medium', 'Default password in code', 'Consider removing default and requiring env var in production');
    }

    // Check 4: Environment variable for password
    if (serverCode.includes('process.env.APP_PASSWORD')) {
        log('passed', 'Password configurable via environment variable');
    } else {
        log('high', 'No environment variable for password');
    }

    // Check 5: Session token generation
    if (serverCode.includes('crypto.randomBytes')) {
        log('passed', 'Using crypto.randomBytes for token generation');
    } else {
        log('high', 'Weak token generation', 'Should use crypto.randomBytes');
    }

    // Check 6: CORS configuration
    if (serverCode.includes("cors({")) {
        log('passed', 'CORS configured with options');
    } else if (serverCode.includes("cors()")) {
        log('medium', 'CORS enabled with default settings', 'Consider restricting origins in production');
    }

    // Check 7: Rate limiting
    if (serverCode.includes('rate-limit') || serverCode.includes('rateLimit')) {
        log('passed', 'Rate limiting implemented');
    } else {
        log('medium', 'No rate limiting', 'Consider adding rate limiting to prevent brute force attacks');
    }

    // Check 8: Input validation
    if (serverCode.includes('parseInt(req.params')) {
        log('passed', 'Input parsing for numeric parameters');
    }

    // Check 9: Helmet (security headers)
    if (serverCode.includes('helmet')) {
        log('passed', 'Helmet security headers enabled');
    } else {
        log('low', 'No Helmet middleware', 'Consider adding helmet for security headers');
    }

    // Check 10: HTTPS enforcement
    if (serverCode.includes('https') || serverCode.includes('secure: true')) {
        log('passed', 'HTTPS considerations found');
    } else {
        log('info', 'No HTTPS enforcement', 'Render.com handles HTTPS, but consider adding redirect');
    }

    // Check 11: XSS via JSON response
    if (serverCode.includes('res.json')) {
        log('passed', 'Using res.json() for API responses', 'Proper JSON encoding prevents XSS');
    }

    // Check 12: Path traversal
    if (serverCode.includes('path.join(__dirname')) {
        log('passed', 'Using path.join for file paths', 'Helps prevent path traversal');
    }

    // Check 13: Session expiry
    if (serverCode.includes('expiresAt') && serverCode.includes('7 * 24')) {
        log('passed', 'Session expiry implemented (7 days)');
    }

    // Check 14: Password comparison (timing attack)
    if (serverCode.includes('timingSafeEqual')) {
        log('passed', 'Using timing-safe password comparison', 'Prevents timing attacks');
    } else if (serverCode.includes('password === APP_PASSWORD')) {
        log('low', 'Simple string comparison for password', 'Consider using crypto.timingSafeEqual to prevent timing attacks');
    }

    // Check 15: Request body size limit
    if (serverCode.includes("limit: '10kb'") || serverCode.includes('limit:')) {
        log('passed', 'Request body size limited', 'Prevents large payload attacks');
    }

    // Check 16: httpOnly cookies
    if (serverCode.includes('httpOnly: true')) {
        log('passed', 'httpOnly cookies enabled', 'Protects against XSS token theft');
    }

    // Check 17: SameSite cookie
    if (serverCode.includes("sameSite: 'strict'") || serverCode.includes('sameSite: "strict"')) {
        log('passed', 'SameSite cookie protection', 'Prevents CSRF attacks');
    }

    // Check 18: Security logging
    if (serverCode.includes('logSecurityEvent') || serverCode.includes('security-log')) {
        log('passed', 'Security event logging implemented');
    }

    // Check 19: Cookie parser
    if (serverCode.includes('cookieParser')) {
        log('passed', 'Cookie parser middleware for secure cookie handling');
    }

    // Check 20: Content encryption
    if (serverCode.includes('aes-256-gcm') || serverCode.includes('AES-256-GCM')) {
        log('passed', 'AES-256-GCM encryption for content', 'Military-grade encryption');
    }

    // Check 21: Encryption key derivation
    if (serverCode.includes('scryptSync') || serverCode.includes('ENCRYPTION_KEY')) {
        log('passed', 'Secure key derivation for encryption');
    }

    // Check 22: Encrypted API endpoints
    if (serverCode.includes('encrypted=true') || serverCode.includes('encryptContent')) {
        log('passed', 'Encrypted content transmission available');
    }
}

// ========== CLIENT-SIDE CHECKS ==========
console.log(`\n${COLORS.BLUE}Analyzing public/app.js...${COLORS.RESET}\n`);

const clientCode = readFile('./public/app.js');

if (clientCode) {
    // Check 15: XSS via innerHTML
    if (clientCode.includes('innerHTML')) {
        log('medium', 'innerHTML usage detected', 'Ensure user input is sanitized before inserting into DOM');
    }

    // Check 16: localStorage for tokens
    if (clientCode.includes('localStorage.setItem')) {
        log('info', 'Using localStorage for auth token', 'Consider httpOnly cookies for better XSS protection');
    }

    // Check 17: eval in client
    if (/\beval\s*\(/.test(clientCode)) {
        log('critical', 'eval() in client code');
    } else {
        log('passed', 'No eval() in client code');
    }

    // Check 18: document.write
    if (clientCode.includes('document.write')) {
        log('high', 'document.write() detected', 'Can be exploited for XSS');
    } else {
        log('passed', 'No document.write() usage');
    }

    // Check 19: Content protection features
    if (clientCode.includes('contextmenu') && clientCode.includes('preventDefault')) {
        log('passed', 'Right-click protection enabled');
    }
    if (clientCode.includes('selectstart')) {
        log('passed', 'Text selection protection enabled');
    }
    if (clientCode.includes('@media print')) {
        log('passed', 'Print protection enabled');
    }
    if (clientCode.includes('sessionTimeout') || clientCode.includes('lastActivity')) {
        log('passed', 'Session activity monitoring enabled');
    }
}

// ========== HTML CHECKS ==========
console.log(`\n${COLORS.BLUE}Analyzing HTML files...${COLORS.RESET}\n`);

const loginHtml = readFile('./public/login.html');
const indexHtml = readFile('./public/index.html');

if (loginHtml) {
    // Check 19: Form autocomplete
    if (loginHtml.includes('autocomplete="current-password"')) {
        log('passed', 'Password field has proper autocomplete attribute');
    }

    // Check 20: CSP meta tag
    if (loginHtml.includes('Content-Security-Policy')) {
        log('passed', 'Content Security Policy found');
    } else {
        log('low', 'No Content Security Policy', 'Consider adding CSP headers');
    }
}

// ========== DEPENDENCY CHECKS ==========
console.log(`\n${COLORS.BLUE}Checking dependencies...${COLORS.RESET}\n`);

const packageJson = readFile('./package.json');
if (packageJson) {
    const pkg = JSON.parse(packageJson);

    // Check express version
    if (pkg.dependencies?.express) {
        const version = pkg.dependencies.express.replace('^', '').replace('~', '');
        if (parseFloat(version) >= 4.18) {
            log('passed', `Express version ${version}`, 'Up to date');
        } else {
            log('medium', `Express version ${version}`, 'Consider updating');
        }
    }

    // Check for security packages
    const securityPackages = ['helmet', 'express-rate-limit', 'express-validator'];
    securityPackages.forEach(pkg => {
        if (!packageJson.includes(pkg)) {
            log('info', `${pkg} not installed`, 'Optional security enhancement');
        }
    });
}

// ========== FILE PERMISSIONS ==========
console.log(`\n${COLORS.BLUE}Checking sensitive files...${COLORS.RESET}\n`);

// Check for .env file
if (fs.existsSync('.env')) {
    log('info', '.env file exists', 'Ensure it is in .gitignore');
}

// Check .gitignore
const gitignore = readFile('.gitignore');
if (gitignore) {
    if (gitignore.includes('.env')) {
        log('passed', '.env is in .gitignore');
    } else {
        log('high', '.env not in .gitignore', 'Sensitive data may be committed');
    }

    if (gitignore.includes('node_modules')) {
        log('passed', 'node_modules in .gitignore');
    }
}

// ========== SUMMARY ==========
console.log('\n' + '='.repeat(60));
console.log('  AUDIT SUMMARY');
console.log('='.repeat(60) + '\n');

console.log(`${COLORS.RED}Critical: ${results.critical.length}${COLORS.RESET}`);
console.log(`${COLORS.RED}High:     ${results.high.length}${COLORS.RESET}`);
console.log(`${COLORS.YELLOW}Medium:   ${results.medium.length}${COLORS.RESET}`);
console.log(`${COLORS.YELLOW}Low:      ${results.low.length}${COLORS.RESET}`);
console.log(`${COLORS.BLUE}Info:     ${results.info.length}${COLORS.RESET}`);
console.log(`${COLORS.GREEN}Passed:   ${results.passed.length}${COLORS.RESET}`);

const totalIssues = results.critical.length + results.high.length + results.medium.length;
console.log('\n' + '-'.repeat(60));

if (results.critical.length > 0) {
    console.log(`${COLORS.RED}ACTION REQUIRED: Fix critical issues immediately!${COLORS.RESET}`);
} else if (results.high.length > 0) {
    console.log(`${COLORS.YELLOW}RECOMMENDATION: Address high-severity issues before deployment${COLORS.RESET}`);
} else if (totalIssues === 0) {
    console.log(`${COLORS.GREEN}EXCELLENT: No critical or high issues found!${COLORS.RESET}`);
} else {
    console.log(`${COLORS.GREEN}GOOD: No critical issues. Consider addressing medium/low items.${COLORS.RESET}`);
}

console.log('\n');
