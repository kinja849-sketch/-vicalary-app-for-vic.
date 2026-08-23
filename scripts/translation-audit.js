const fs = require('fs');
const path = require('path');

const TRANSLATIONS_DIR = path.join(__dirname, '../lib/translations');

function runAudit() {
    console.log('\n🔍 Starting Translation Audit...\n');
    
    if (!fs.existsSync(TRANSLATIONS_DIR)) {
        console.error('❌ Could not find translations directory:', TRANSLATIONS_DIR);
        process.exit(1);
    }

    const files = fs.readdirSync(TRANSLATIONS_DIR).filter(f => f.endsWith('.ts'));
    
    if (!files.includes('en.ts')) {
        console.error('❌ Base translation file (en.ts) is missing!');
        process.exit(1);
    }

    // Extract keys using regex
    function getKeys(filePath) {
        const content = fs.readFileSync(filePath, 'utf-8');
        const keys = [];
        const regex = /^\s*([a-zA-Z0-9_]+)\s*:/gm;
        let match;
        while ((match = regex.exec(content)) !== null) {
            keys.push(match[1]);
        }
        return keys;
    }

    const enKeys = getKeys(path.join(TRANSLATIONS_DIR, 'en.ts'));
    let hasMissingKeys = false;

    console.log(`Base language (English) has ${enKeys.length} keys.\n`);

    for (const file of files) {
        if (file === 'en.ts') continue;
        
        const filePath = path.join(TRANSLATIONS_DIR, file);
        const keys = getKeys(filePath);
        const missing = enKeys.filter(k => !keys.includes(k));
        
        if (missing.length > 0) {
            hasMissingKeys = true;
            console.log(`⚠️  ${file} is missing ${missing.length} keys:`);
            console.log(`   ${missing.join(', ')}\n`);
        } else {
            console.log(`✅ ${file} is up to date.`);
        }
    }

    if (hasMissingKeys) {
        console.log('\n❌ Audit Failed: Found missing translation keys across locales. Please update them to ensure parity.');
        process.exit(1);
    } else {
        console.log('\n🎉 Audit Passed: 100% Translation Parity Achieved!');
        process.exit(0);
    }
}

runAudit();
